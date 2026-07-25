import { normalizeSource, validateMarketRequest } from "./tier2-validation.js";

const DEFAULT_MODEL = "gpt-5.6";
const MAX_SUMMARY_LENGTH = 16_000;
const MAX_SOURCES = 12;

export class Tier2UnavailableError extends Error {
  constructor(message = "Live OpenAI intelligence is not configured.") {
    super(message);
    this.name = "Tier2UnavailableError";
    this.statusCode = 503;
    this.recoverable = true;
  }
}

function sourceCandidates(response) {
  const candidates = [];
  for (const item of response?.output ?? []) {
    if (item?.type === "web_search_call") {
      candidates.push(...(item.action?.sources ?? []));
    }
    if (item?.type === "message") {
      for (const content of item.content ?? []) {
        for (const annotation of content?.annotations ?? []) {
          if (annotation?.type === "url_citation") candidates.push(annotation);
        }
      }
    }
  }
  return candidates;
}

function collectSources(response) {
  const seen = new Set();
  const sources = [];
  for (const candidate of sourceCandidates(response)) {
    const source = normalizeSource(candidate);
    if (!source || seen.has(source.url)) continue;
    seen.add(source.url);
    sources.push(source);
    if (sources.length === MAX_SOURCES) break;
  }
  return sources;
}

function usageSummary(usage) {
  if (!usage) return null;
  return {
    inputTokens: Number(usage.input_tokens) || 0,
    outputTokens: Number(usage.output_tokens) || 0,
  };
}

function systemPrompt(kind, responseLanguage) {
  const objective = kind === "supplier_comparison"
    ? "Compare real suppliers and products that a Bangladesh farmer can evaluate."
    : "Report current Bangladesh market prices and their exact units and market scope.";
  return [
    "You are AgriSense's current-market research specialist.",
    objective,
    "Use live web search. Prefer current official Bangladesh government, established marketplace, manufacturer, and identifiable supplier pages.",
    "Return concise Markdown with a comparison table when at least two comparable records exist.",
    "For every price include currency, unit, location or market, retrieval date, and whether availability is confirmed.",
    "Clearly separate advertised retail prices, wholesale market prices, and computed unit conversions.",
    "Do not invent suppliers, prices, stock, contact information, citations, or freshness.",
    "If evidence is absent, stale, mismatched, or not comparable, say exactly that.",
    "Do not recommend a purchase and do not perform a transaction.",
    responseLanguage ? `Write the complete farmer-facing answer in ${responseLanguage}.` : "",
  ].join(" ");
}

export function createMarketIntelligenceService({
  client,
  model = DEFAULT_MODEL,
  now = () => new Date(),
} = {}) {
  return {
    async research(rawRequest, { signal } = {}) {
      if (!client?.responses?.create) throw new Tier2UnavailableError();
      const request = validateMarketRequest(rawRequest);
      const response = await client.responses.create({
        model,
        reasoning: { effort: "low" },
        tools: [{
          type: "web_search",
          search_context_size: "low",
          user_location: {
            type: "approximate",
            country: "BD",
            city: request.location,
          },
        }],
        tool_choice: { type: "web_search" },
        include: ["web_search_call.action.sources"],
        input: [
          { role: "system", content: systemPrompt(request.kind, request.responseLanguage) },
          {
            role: "user",
            content: JSON.stringify({
              location: request.location,
              crop: request.crop || undefined,
              request: request.query,
              currentDate: now().toISOString().slice(0, 10),
            }),
          },
        ],
      }, signal ? { signal } : undefined);
      const sources = collectSources(response);
      const summary = String(response?.output_text || "No current evidence found.")
        .trim()
        .slice(0, MAX_SUMMARY_LENGTH);
      return {
        kind: request.kind,
        summary,
        items: [],
        sources,
        freshness: now().toISOString(),
        limitations: sources.length
          ? []
          : ["No citable current web source was returned. Treat the result as unverified."],
        model,
        usage: usageSummary(response?.usage),
      };
    },
  };
}
