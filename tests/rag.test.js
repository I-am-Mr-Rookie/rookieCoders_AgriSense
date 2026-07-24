import test from "node:test";
import assert from "node:assert/strict";

import { createLexicalRetriever, loadCorpus } from "../server/rag.js";

const records = await loadCorpus();
const retrieve = createLexicalRetriever(records);

test("bundled corpus is fully parseable and has the validated count", () => {
  assert.equal(records.length, 3163);
  assert.ok(records.every((row) => row.record_id && row.text && row.raw_content_hash));
});

test("Gazipur mustard fertilizer retrieval applies Bangladesh Rabi crop and lane filters", () => {
  const rows = retrieve("mustard fertilizer nutrient soil test recommendation", {
    crop: "mustard", season: "Rabi", location: "Gazipur", corpusLanes: ["core", "bd_expansion"],
  }, 8);
  assert.ok(rows.length >= 3);
  assert.ok(rows.every((row) => ["Bangladesh", "BD"].includes(row.country)));
  assert.ok(rows.every((row) => !row.crop || row.crop === "mustard"));
  assert.ok(rows.some((row) => row.source_title.includes("Fertilizer Recommendation Guide")));
  assert.ok(rows.every((row) => row.record_id && row.publisher && row.source_page_or_table));
});

test("potato calendar retrieval returns potato Rabi evidence and excludes other crops", () => {
  const rows = retrieve("potato crop weather calendar sowing harvest", { crop: "potato", season: "Rabi", location: "Gazipur" }, 8);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => !row.crop || row.crop === "potato"));
  assert.ok(rows.some((row) => row.content_type === "calendar" || row.topics?.includes("calendar")));
});

test("Boro rice irrigation retrieval preserves revalidation flags instead of hiding them", () => {
  const rows = retrieve("Boro rice irrigation water management critical period", { crop: "boro_rice", season: "Rabi", location: "Gazipur" }, 8);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => !row.crop || row.crop === "boro_rice"));
  assert.ok(rows.some((row) => row.topics?.includes("irrigation") || row.text.toLowerCase().includes("irrigation")));
  assert.ok(rows.every((row) => Array.isArray(row.quality_flags)));
});

test("irrelevant query returns no evidence rather than arbitrary citations", () => {
  const rows = retrieve("martian coffee greenhouse cryptocurrency", { crop: "mustard", season: "Rabi", location: "Gazipur" }, 5);
  assert.deepEqual(rows, []);
});

test("retrieval output changes when the evidence changes", () => {
  const base = [{ record_id: "a", text: "mustard fertilizer sulfur", corpus_lane: "core", country: "Bangladesh", crop: "mustard", season: "Rabi", quality_flags: [] }];
  const changed = [{ ...base[0], text: "mustard irrigation only" }, { record_id: "b", text: "mustard fertilizer boron", corpus_lane: "core", country: "Bangladesh", crop: "mustard", season: "Rabi", quality_flags: [] }];
  assert.equal(createLexicalRetriever(base)("mustard fertilizer", { crop: "mustard", season: "Rabi" }, 1)[0].record_id, "a");
  assert.equal(createLexicalRetriever(changed)("mustard fertilizer", { crop: "mustard", season: "Rabi" }, 1)[0].record_id, "b");
});
