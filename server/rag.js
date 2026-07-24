import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { districtFromLocation } from "./validation.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "structured");
const DATASETS = [
  "crop_calendar",
  "crop_suitability",
  "farm_economics",
  "fertilizer_recommendation",
  "irrigation_checkpoint",
  "pest_disease_checkpoint",
  "soil_observation",
  "weather_timeseries",
  "yield_statistic",
];

let cached;

function tokens(value) {
  return String(value ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function cropKey(value) {
  const key = String(value ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  return key === "boro_rice" ? "boro" : key === "maize" ? "rabi_maize" : key;
}

function provenance(row) {
  return {
    publisher: row.publisher ?? null,
    sourceTitle: row.source_title ?? null,
    sourceUrl: row.source_url ?? null,
    sourcePage: row.source_page_or_table ?? null,
    provenanceClass: row.provenance_class ?? null,
    confidence: row.confidence ?? null,
    publicationDate: row.publication_date ?? null,
    retrievedAt: row.retrieved_at_utc ?? null,
    qualityFlags: row.quality_flags ?? [],
  };
}

function searchableText(dataset, row) {
  const values = Object.entries(row)
    .filter(([key]) => !/hash|source_file|listed_product/i.test(key))
    .flatMap(([, value]) => {
      if (value === null || value === undefined) return [];
      if (typeof value === "object") return [JSON.stringify(value)];
      return [String(value)];
    });
  return `${dataset.replaceAll("_", " ")} ${values.join(" ")}`.replace(/\s+/g, " ").trim();
}

export function loadCorpus() {
  if (cached) return cached;
  const docs = [];
  let excludedBlocked = 0;

  for (const dataset of DATASETS) {
    const rows = JSON.parse(fs.readFileSync(path.join(ROOT, `${dataset}.json`), "utf8"));
    for (const row of rows) {
      if (/BLOCKED/i.test(String(row.coverage_status ?? ""))) {
        excludedBlocked += 1;
        continue;
      }
      docs.push({
        id: row.record_id,
        kind: "fact_card",
        dataset,
        crop: cropKey(row.crop),
        season: String(row.season ?? "").toLowerCase(),
        geo: row.geo_name ?? row.district_source ?? row.country ?? "Bangladesh",
        text: searchableText(dataset, row),
        record: row,
        provenance: provenance(row),
      });
    }
  }
  cached = {
    docs,
    report: { datasetCount: DATASETS.length, totalIndexed: docs.length, excludedBlocked },
  };
  return cached;
}

export function retrieveFacts(query, { crop, dataset, geo, topK = 5 } = {}) {
  const queryTokens = new Set(tokens(query));
  const wantedCrop = cropKey(crop);
  const results = loadCorpus().docs
    .filter((doc) => !dataset || doc.dataset === dataset)
    .filter((doc) => !crop || doc.crop === wantedCrop)
    .filter((doc) => !geo || String(doc.geo).toLowerCase().includes(String(geo).toLowerCase()))
    .map((doc) => {
      const documentTokens = new Set(tokens(doc.text));
      const score = [...queryTokens].reduce((sum, token) => sum + (documentTokens.has(token) ? 1 : 0), 0);
      return { ...doc, score };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, Math.min(Number(topK) || 5, 20)));
  return { query, results, report: loadCorpus().report };
}

function source(doc) {
  return {
    id: doc.id,
    publisher: doc.provenance.publisher,
    title: doc.provenance.sourceTitle,
    url: doc.provenance.sourceUrl,
    page: doc.provenance.sourcePage,
    confidence: doc.provenance.confidence,
    warning: doc.provenance.qualityFlags?.join("; ") || null,
    text: doc.text.slice(0, 420),
  };
}

export function getCropEvidence(profile, cropId) {
  const district = districtFromLocation(profile.location) ?? "__unknown_district__";
  const result = retrieveFacts(`${cropId} suitability ${district}`, {
    crop: cropId,
    dataset: "crop_suitability",
    geo: district,
    topK: 20,
  });
  const weights = { "Very Suitable": 100, Suitable: 80, "Moderately Suitable": 55, "Marginally Suitable": 25, "Not Suitable": 0 };
  let area = 0;
  let weighted = 0;
  for (const doc of result.results) {
    for (const [label, value] of Object.entries(doc.record.suitability_area_source_values ?? {})) {
      area += Number(value) || 0;
      weighted += (Number(value) || 0) * (weights[label] ?? 50);
    }
  }
  return {
    suitabilityScore: area ? Math.round((weighted / area) * 10) / 10 : 50,
    basis: area ? "BARC area-weighted zoning classes" : "No district zoning row; neutral prior",
    sources: result.results.map(source),
  };
}

export function getPlanEvidence(cropId, profile = {}) {
  const make = (dataset, topK = 3) => retrieveFacts(
    `${cropId} ${profile.targetSeason ?? ""} ${profile.location ?? ""}`,
    { crop: cropId, dataset, topK },
  ).results.map(source);
  return {
    calendar: make("crop_calendar"),
    fertilizer: make("fertilizer_recommendation"),
    irrigation: make("irrigation_checkpoint"),
    pest: make("pest_disease_checkpoint"),
    yield: make("yield_statistic"),
    economics: make("farm_economics"),
  };
}
