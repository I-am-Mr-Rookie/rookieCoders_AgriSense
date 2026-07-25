import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  buildMarketRequest,
  createTier2CompletionEvents,
  createTier2StartEvent,
  isMarketIntelligenceRequest,
  marketKindFromText,
  tier2ResultMarkdown,
  validateAttachmentMetadata,
} from "../src/tier2.js";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const toolsUrl = new URL("../src/components/Tier2ComposerTools.jsx", import.meta.url);
const runUrl = new URL("../src/components/AgentRunMessage.jsx", import.meta.url);
const toolsSource = existsSync(toolsUrl) ? readFileSync(toolsUrl, "utf8") : "";
const runSource = readFileSync(runUrl, "utf8");
const i18nSource = readFileSync(new URL("../src/i18n.js", import.meta.url), "utf8");

test("validates a bounded browser image attachment", () => {
  assert.deepEqual(validateAttachmentMetadata({
    name: " leaf.JPG ",
    type: "image/jpeg",
    size: 1234,
  }), {
    name: "leaf.JPG",
    type: "image/jpeg",
    size: 1234,
  });
  assert.throws(
    () => validateAttachmentMetadata({ name: "leaf.svg", type: "image/svg+xml", size: 12 }),
    /JPEG, PNG, or WebP/,
  );
  assert.throws(
    () => validateAttachmentMetadata({ name: "leaf.jpg", type: "image/jpeg", size: 6 * 1024 * 1024 }),
    /5 MiB or smaller/,
  );
});

test("classifies supplier comparison separately from market-price intelligence", () => {
  assert.equal(isMarketIntelligenceRequest("আজ আলুর বাজার দাম কত?"), true);
  assert.equal(isMarketIntelligenceRequest("Please update my farm budget"), false);
  assert.equal(marketKindFromText("Compare maize seed suppliers near Gazipur"), "supplier_comparison");
  assert.equal(marketKindFromText("আজ আলুর বাজার দাম কত?"), "market_price");
  assert.deepEqual(buildMarketRequest({
    query: " Compare maize suppliers ",
    location: " Gazipur ",
    crop: " Maize ",
  }), {
    kind: "supplier_comparison",
    query: "Compare maize suppliers",
    location: "Gazipur",
    crop: "Maize",
  });
});

test("renders market evidence once and keeps freshness visible", () => {
  const markdown = tier2ResultMarkdown({
    kind: "supplier_comparison",
    summary: "## Comparison\n\nCurrent evidence.",
    sources: [
      { url: "https://example.com/prices", title: "Price board" },
      { url: "https://example.com/prices", title: "Duplicate" },
      { url: "javascript:alert(1)", title: "Unsafe" },
    ],
    freshness: "2026-07-25T02:00:00.000Z",
    limitations: ["Stock was not confirmed."],
  });

  assert.equal((markdown.match(/https:\/\/example\.com\/prices/g) ?? []).length, 1);
  assert.doesNotMatch(markdown, /javascript:/);
  assert.match(markdown, /Retrieved 25 Jul 2026/);
  assert.match(markdown, /Stock was not confirmed/);
});

test("renders disease uncertainty and an explicit no-chemical boundary", () => {
  const markdown = tier2ResultMarkdown({
    kind: "disease_diagnosis",
    summary: "Possible leaf disease.",
    likelyCauses: [{ name: "Late blight", confidence: "medium" }],
    observations: ["Dark lesions"],
    safeNextSteps: ["Isolate the plant"],
    limitations: ["Image-only assessment"],
  });

  assert.match(markdown, /Possible causes/);
  assert.match(markdown, /Late blight \| medium/);
  assert.match(markdown, /No chemical recommendation was generated/);
  assert.match(markdown, /Image-only assessment/);
});

test("Tier 2 activity events use measured timing and real source records", () => {
  assert.deepEqual(createTier2StartEvent({
    kind: "market_price",
    timestamp: "2026-07-25T02:00:00.000Z",
  }), {
    id: "tier2-market_price-started",
    type: "market_price.started",
    label: "Current market search started",
    status: "completed",
    timestamp: "2026-07-25T02:00:00.000Z",
    durationMs: 0,
    details: { provider: "OpenAI web search" },
  });
  const events = createTier2CompletionEvents({
    kind: "market_price",
    result: {
      sources: [{ url: "https://example.com", title: "Example market" }],
    },
    completedAt: "2026-07-25T02:00:02.500Z",
    durationMs: 2500,
  });
  assert.equal(events[0].durationMs, 2500);
  assert.equal(events[1].details.sourceUrl, "https://example.com");
});

test("chat composer exposes image, market, and Bangla voice as one coherent interface", () => {
  for (const expected of [
    'import Tier2ComposerTools from "./components/Tier2ComposerTools.jsx"',
    'from "./realtime.js"',
    "applyAssistantTranscript",
    '"/api/tier2/market"',
    "marketMode || isMarketIntelligenceRequest(message.trim())",
    '"/api/tier2/disease"',
    "tier2ResultMarkdown",
    "startRealtimeSession",
    "user_transcript",
    "heavy_task",
    "tier2-attachment-preview",
    "Attached leaf preview",
  ]) {
    assert.ok(appSource.includes(expected), `missing Tier 2 App contract: ${expected}`);
  }
  for (const expected of [
    "Attach leaf",
    "Market",
    "Bangla voice",
    'accept="image/jpeg,image/png,image/webp"',
    'aria-pressed={marketMode}',
  ]) {
    assert.ok(`${toolsSource}\n${i18nSource}`.includes(expected), `missing Tier 2 composer contract: ${expected}`);
  }
  for (const expected of [
    ".tier2-composer-tools",
    ".tier2-attachment-preview",
    ".voice-field-pulse",
    ".voice-transcript",
  ]) {
    assert.ok(cssSource.includes(expected), `missing Tier 2 visual contract: ${expected}`);
  }
  assert.ok(cssSource.includes("@media (prefers-reduced-motion: reduce)"));
  for (const expected of [
    "Researching current markets",
    "Assessing the leaf image",
    "Market research completed",
    "Image assessment completed",
  ]) {
    assert.ok(runSource.includes(expected), `missing Tier 2 run wording: ${expected}`);
  }
});
