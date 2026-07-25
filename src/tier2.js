export const MAX_CLIENT_IMAGE_BYTES = 5 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SUPPLIER_PATTERN = /\b(?:supplier|vendor|seller|dealer|shop|compare|source)\b|সরবরাহকারী|বিক্রেতা|ডিলার/i;
const MARKET_INTENT_PATTERN = /\b(?:market|price|supplier|vendor|seller|dealer|wholesale|retail|stock|availability|compare)\b|বাজার|দাম|মূল্য|সরবরাহকারী|বিক্রেতা|ডিলার/i;

function cleanText(value, maximum = 500) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maximum)
    : "";
}

function markdownText(value) {
  return cleanText(value, 500).replace(/([\\`*_[\]<>|])/g, "\\$1");
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const normalized = url.toString();
    return url.pathname === "/" && !url.search && !url.hash
      ? normalized.slice(0, -1)
      : normalized;
  } catch {
    return null;
  }
}

export function validateAttachmentMetadata(file) {
  if (!file || typeof file !== "object") throw new Error("Choose a leaf image first.");
  const type = String(file.type || "").toLowerCase();
  if (!IMAGE_TYPES.has(type)) throw new Error("Attach a JPEG, PNG, or WebP leaf image.");
  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0) throw new Error("The attached image is empty.");
  if (size > MAX_CLIENT_IMAGE_BYTES) throw new Error("The attached image must be 5 MiB or smaller.");
  return {
    name: cleanText(file.name, 160) || "leaf-image",
    type,
    size,
  };
}

export function readAttachment(file, FileReaderClass = globalThis.FileReader) {
  const metadata = validateAttachmentMetadata(file);
  if (typeof FileReaderClass !== "function") {
    return Promise.reject(new Error("This browser cannot read image attachments."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReaderClass();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string" || !reader.result.startsWith(`data:${metadata.type};base64,`)) {
        reject(new Error("The browser could not prepare this image."));
        return;
      }
      resolve({ ...metadata, dataUrl: reader.result });
    });
    reader.addEventListener("error", () => reject(new Error("The browser could not read this image.")));
    reader.readAsDataURL(file);
  });
}

export function marketKindFromText(query) {
  return SUPPLIER_PATTERN.test(String(query || "")) ? "supplier_comparison" : "market_price";
}

export function isMarketIntelligenceRequest(query) {
  return MARKET_INTENT_PATTERN.test(String(query || ""));
}

export function buildMarketRequest({ query, location, crop }) {
  const normalizedQuery = cleanText(query);
  const normalizedLocation = cleanText(location, 120);
  if (!normalizedQuery) throw new Error("Ask a market-price or supplier question.");
  if (!normalizedLocation) throw new Error("Add a Bangladesh district before running a market search.");
  return {
    kind: marketKindFromText(normalizedQuery),
    query: normalizedQuery,
    location: normalizedLocation,
    crop: cleanText(crop, 80),
  };
}

function uniqueSources(sources) {
  const seen = new Set();
  return (Array.isArray(sources) ? sources : []).flatMap((source) => {
    const url = safeUrl(source?.url);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ url, title: markdownText(source?.title) || new URL(url).hostname }];
  });
}

function listSection(title, values) {
  const items = (Array.isArray(values) ? values : []).map(markdownText).filter(Boolean);
  return items.length ? [`### ${title}`, ...items.map((item) => `- ${item}`), ""] : [];
}

function formattedFreshness(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "time unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function tier2ResultMarkdown(result) {
  if (result?.kind === "disease_diagnosis") {
    const causes = (Array.isArray(result.likelyCauses) ? result.likelyCauses : [])
      .map((item) => {
        const name = markdownText(item?.name);
        const confidence = markdownText(item?.confidence) || "low";
        return name ? `| ${name} | ${confidence} |` : "";
      })
      .filter(Boolean);
    return [
      "## Leaf image assessment",
      "",
      cleanText(result.summary, 4_000) || "No reliable visible pattern was identified.",
      "",
      ...listSection("Visible observations", result.observations),
      ...(causes.length ? [
        "### Possible causes",
        "",
        "| Cause | Confidence |",
        "|---|---|",
        ...causes,
        "",
      ] : []),
      ...listSection("Safe next steps", result.safeNextSteps),
      "> **Chemical safety:** No chemical recommendation was generated because current official registry evidence was not attached.",
      "",
      ...listSection("Limitations", result.limitations),
    ].join("\n").trim();
  }

  const sources = uniqueSources(result?.sources);
  const limitations = listSection("Limitations", result?.limitations);
  return [
    cleanText(result?.summary, 16_000) || "No current market evidence was returned.",
    "",
    sources.length ? "### Sources" : "",
    ...sources.map((source, index) => `${index + 1}. [${source.title}](${source.url})`),
    sources.length ? "" : "",
    `> Retrieved ${formattedFreshness(result?.freshness)}. Prices and availability can change; confirm with the supplier or market before acting.`,
    "",
    ...limitations,
  ].filter((line, index, items) => line !== "" || items[index - 1] !== "").join("\n").trim();
}

function startConfiguration(kind) {
  if (kind === "disease_diagnosis") {
    return { label: "Leaf image validated", provider: "OpenAI vision" };
  }
  return { label: "Current market search started", provider: "OpenAI web search" };
}

export function createTier2StartEvent({ kind, timestamp }) {
  const config = startConfiguration(kind);
  return {
    id: `tier2-${kind}-started`,
    type: `${kind}.started`,
    label: config.label,
    status: "completed",
    timestamp,
    durationMs: 0,
    details: { provider: config.provider },
  };
}

export function createTier2CompletionEvents({
  kind,
  result,
  completedAt,
  durationMs,
}) {
  const market = kind !== "disease_diagnosis";
  const events = [{
    id: `tier2-${kind}-completed`,
    type: `${kind}.completed`,
    label: market ? "Current evidence retrieved" : "Image assessment completed",
    status: "completed",
    timestamp: completedAt,
    durationMs,
    details: market
      ? {
          provider: "OpenAI web search",
          sourceCount: result?.sources?.length ?? 0,
        }
      : {
          provider: "OpenAI vision",
          possibleCauseCount: result?.likelyCauses?.length ?? 0,
          chemicalRecommendation: "Prohibited without current registry evidence",
        },
  }];
  for (const [index, source] of uniqueSources(result?.sources).entries()) {
    events.push({
      id: `tier2-source-${index + 1}`,
      type: "web.source.cited",
      label: source.title,
      status: "completed",
      timestamp: completedAt,
      durationMs: 0,
      details: { sourceUrl: source.url, publisher: source.title },
    });
  }
  return events;
}
