import test from "node:test";
import assert from "node:assert/strict";

import {
  createMarketIntelligenceService,
  Tier2UnavailableError,
} from "../server/market-intelligence.js";

const request = {
  kind: "supplier_comparison",
  crop: "Maize",
  location: "Gazipur",
  query: "Compare current seed suppliers and prices",
};

test("uses low-latency hosted web search and returns visible deduplicated citations", async () => {
  let captured;
  const client = {
    responses: {
      async create(payload) {
        captured = payload;
        return {
          output_text: "## Current comparison\n\n| Supplier | Price |\n|---|---|",
          output: [
            {
              type: "web_search_call",
              action: {
                type: "search",
                sources: [
                  { url: "https://example.com/prices?b=2&a=1", title: "Supplier prices" },
                  { url: "https://example.com/prices?a=1&b=2#today", title: "Duplicate" },
                  { url: "javascript:alert(1)", title: "Unsafe" },
                ],
              },
            },
            {
              type: "message",
              content: [{
                type: "output_text",
                text: "Comparison",
                annotations: [
                  {
                    type: "url_citation",
                    url: "https://market.example.org/today",
                    title: "Wholesale market",
                  },
                ],
              }],
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        };
      },
    },
  };
  const service = createMarketIntelligenceService({
    client,
    model: "gpt-5.6",
    now: () => new Date("2026-07-25T01:00:00.000Z"),
  });

  const result = await service.research(request);

  assert.equal(captured.model, "gpt-5.6");
  assert.equal(captured.reasoning.effort, "low");
  assert.deepEqual(captured.tools, [{
    type: "web_search",
    search_context_size: "low",
    user_location: {
      type: "approximate",
      country: "BD",
      city: "Gazipur",
    },
  }]);
  assert.deepEqual(captured.include, ["web_search_call.action.sources"]);
  assert.equal(captured.tool_choice.type, "web_search");
  assert.match(JSON.stringify(captured.input), /do not invent/i);
  assert.equal(result.kind, "supplier_comparison");
  assert.equal(result.freshness, "2026-07-25T01:00:00.000Z");
  assert.equal(result.sources.length, 2);
  assert.deepEqual(result.sources[0], {
    url: "https://example.com/prices?a=1&b=2",
    title: "Supplier prices",
  });
  assert.equal(result.summary.startsWith("## Current comparison"), true);
  assert.deepEqual(result.usage, { inputTokens: 100, outputTokens: 50 });
});

test("returns a bounded limitation when a search contains no usable source", async () => {
  const service = createMarketIntelligenceService({
    client: {
      responses: {
        async create() {
          return {
            output_text: "No current evidence found.",
            output: [],
            usage: null,
          };
        },
      },
    },
    now: () => new Date("2026-07-25T01:00:00.000Z"),
  });

  const result = await service.research({ ...request, kind: "market_price" });

  assert.deepEqual(result.sources, []);
  assert.match(result.limitations[0], /No citable current web source/);
  assert.deepEqual(result.items, []);
});

test("fails recoverably when OpenAI is not configured", async () => {
  const service = createMarketIntelligenceService({ client: null });

  await assert.rejects(
    service.research(request),
    (error) => error instanceof Tier2UnavailableError
      && error.statusCode === 503
      && error.recoverable === true,
  );
});
