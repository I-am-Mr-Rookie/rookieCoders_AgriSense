import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createGunzip } from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CORPUS_PATH = path.resolve(__dirname, "../data");
const STOPWORDS = new Set(["a", "an", "and", "are", "at", "bd", "bangladesh", "for", "from", "in", "is", "of", "on", "or", "the", "to", "with"]);
let corpusCache;
let corpusPathCache;

function clean(value) {
  return String(value ?? "").trim().toLowerCase();
}

function tokens(value) {
  return clean(value).match(/[a-z0-9]+/g)?.filter((token) => token.length > 1 && !STOPWORDS.has(token)) ?? [];
}

export function normalizeCrop(value) {
  const crop = clean(value).replaceAll("-", "_").replaceAll(" ", "_");
  if (["boro", "boro_rice", "rice"].includes(crop)) return "boro_rice";
  if (["maize", "rabi_maize", "corn"].includes(crop)) return "rabi_maize";
  return crop;
}

function readableStream(corpusPath) {
  const source = fs.createReadStream(corpusPath);
  return corpusPath.endsWith(".gz") ? source.pipe(createGunzip()) : source;
}

export async function loadCorpus(corpusPath = process.env.RAG_CORPUS_PATH || DEFAULT_CORPUS_PATH) {
  if (corpusCache && corpusPathCache === corpusPath) return corpusCache;
  const files = fs.statSync(corpusPath).isDirectory()
    ? fs.readdirSync(corpusPath).filter((name) => /^chunks-\d+\.jsonl(?:\.gz)?$/.test(name)).sort().map((name) => path.join(corpusPath, name))
    : [corpusPath];
  const rows = [];
  let lineNumber = 0;
  for (const file of files) {
    const input = readline.createInterface({ input: readableStream(file), crlfDelay: Infinity });
    for await (const line of input) {
      lineNumber += 1;
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line));
      } catch (error) {
        throw new Error(`Invalid corpus JSON at line ${lineNumber}: ${error.message}`);
      }
    }
  }
  corpusCache = rows;
  corpusPathCache = corpusPath;
  return rows;
}

function matchesFilters(record, filters) {
  const sourceFile = clean(record.source_file);
  if (sourceFile.includes("/initial_partial/") || sourceFile.includes("/prior_thread/") || sourceFile.includes("/command_center/")) return false;
  const country = clean(record.country);
  if (filters.country && ![clean(filters.country), "bd", "bangladesh"].includes(country)) return false;

  const lane = clean(record.corpus_lane);
  if (filters.corpusLanes?.length && !filters.corpusLanes.map(clean).includes(lane)) return false;

  const requestedSeason = clean(filters.season);
  const recordSeason = clean(record.season);
  if (requestedSeason && recordSeason && !recordSeason.includes(requestedSeason)) return false;

  const requestedCrop = normalizeCrop(filters.crop);
  const recordCrop = normalizeCrop(record.crop);
  if (requestedCrop && recordCrop && requestedCrop !== recordCrop) return false;

  const location = clean(filters.location).split(",")[0];
  const geoName = clean(record.geo_name);
  const geoLevel = clean(record.geo_level);
  const isNational = !geoName || geoName === "bangladesh" || geoLevel.includes("national");
  if (location && !isNational && !geoName.includes(location)) return false;

  if (filters.contentTypes?.length && !filters.contentTypes.map(clean).includes(clean(record.content_type))) return false;
  return true;
}

function scoreRecord(record, query, filters) {
  const queryTokens = tokens(query);
  const title = clean(record.source_title);
  const text = clean(record.text);
  const metadata = clean([
    record.content_type,
    record.publisher,
    record.crop,
    record.season,
    record.geo_name,
    ...(record.topics ?? []),
  ].join(" "));
  let matchedTerms = 0;
  let score = 0;
  for (const token of queryTokens) {
    const textHits = Math.min(4, text.split(token).length - 1);
    const metadataHit = metadata.includes(token) ? 1 : 0;
    const titleHit = title.includes(token) ? 1 : 0;
    if (textHits || metadataHit || titleHit) matchedTerms += 1;
    score += textHits * 0.55 + metadataHit * 1.4 + titleHit * 1.1;
  }
  if (matchedTerms < Math.min(2, queryTokens.length)) return null;
  score *= 0.6 + 0.4 * (matchedTerms / Math.max(queryTokens.length, 1));
  if (normalizeCrop(record.crop) && normalizeCrop(record.crop) === normalizeCrop(filters.crop)) score += 2.5;
  if (clean(record.geo_name).includes(clean(filters.location).split(",")[0]) && filters.location) score += 2;
  if (record.corpus_lane === "core") score += 2.5;
  if (["raw_official", "derived_normalized", "official_snapshot"].includes(clean(record.provenance_class))) score += 2;
  if (clean(record.provenance_class) === "prior_partial") score -= 5;
  if (clean(record.publisher).includes("agrisense research artifact")) score -= 5;
  if (clean(record.confidence) === "high") score += 0.75;
  if (record.source_url) score += 0.25;
  if (record.quality_flags?.includes("REVALIDATE_PRIOR_NORMALIZATION_AGAINST_RAW_SOURCE")) score -= 2;
  return Math.max(0, score);
}

export function createLexicalRetriever(records) {
  return function retrieve(query, filters = {}, limit = 8) {
    const effectiveFilters = {
      country: "Bangladesh",
      corpusLanes: ["core", "bd_expansion"],
      ...filters,
    };
    return records
      .filter((record) => matchesFilters(record, effectiveFilters))
      .map((record) => ({ record, score: scoreRecord(record, query, effectiveFilters) }))
      .filter(({ score }) => score !== null && score > 0)
      .sort((a, b) => b.score - a.score || String(a.record.record_id).localeCompare(String(b.record.record_id)))
      .slice(0, limit)
      .map(({ record, score }) => ({ ...record, retrieval_score: Number(score.toFixed(4)) }));
  };
}

function toCitation(row) {
  return {
    record_id: row.record_id,
    text: row.text,
    corpus_lane: row.corpus_lane,
    content_type: row.content_type,
    provenance_class: row.provenance_class,
    publisher: row.publisher,
    source_title: row.source_title,
    source_url: row.source_url,
    source_file: row.source_file,
    source_page_or_table: row.source_page_or_table,
    publication_date: row.publication_date,
    retrieved_at_utc: row.retrieved_at_utc,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    language: row.language,
    country: row.country,
    geo_level: row.geo_level,
    geo_name: row.geo_name,
    crop: row.crop,
    season: row.season,
    topics: row.topics,
    source_unit: row.source_unit,
    normalized_unit: row.normalized_unit,
    confidence: row.confidence,
    quality_flags: row.quality_flags ?? [],
    retrieval_score: Number(row.retrieval_score ?? 0),
  };
}

async function retrievePostgres(pool, query, filters, limit) {
  const crop = normalizeCrop(filters.crop) || null;
  const season = clean(filters.season) || null;
  const location = clean(filters.location).split(",")[0] || null;
  const lanes = filters.corpusLanes?.length ? filters.corpusLanes : ["core", "bd_expansion"];
  const result = await pool.query(
    `SELECT *, ts_rank_cd(search_vector, websearch_to_tsquery('english', $1)) AS retrieval_score
       FROM rag_chunks
      WHERE country IN ('Bangladesh', 'BD')
        AND corpus_lane = ANY($2::text[])
        AND coalesce(source_file, '') NOT LIKE '%/initial_partial/%'
        AND coalesce(source_file, '') NOT LIKE '%/prior_thread/%'
        AND coalesce(source_file, '') NOT LIKE '%/command_center/%'
        AND ($3::text IS NULL OR season IS NULL OR lower(season) LIKE '%' || $3 || '%')
        AND ($4::text IS NULL OR crop IS NULL OR crop = $4)
        AND ($5::text IS NULL OR geo_name IS NULL OR lower(geo_name) = 'bangladesh'
             OR lower(coalesce(geo_level, '')) LIKE '%national%' OR lower(geo_name) LIKE '%' || $5 || '%')
        AND search_vector @@ websearch_to_tsquery('english', $1)
      ORDER BY retrieval_score DESC, (crop = $4) DESC NULLS LAST, record_id
      LIMIT $6`,
    [query, lanes, season, crop, location, limit],
  );
  return result.rows.map(toCitation);
}

export async function retrieveEvidence({ query, filters = {}, limit = 8, pool = null }) {
  if (pool) {
    try {
      const rows = await retrievePostgres(pool, query, filters, limit);
      if (rows.length) return { mode: "postgresql-full-text", rows, fallbackReason: null };
    } catch (error) {
      const records = await loadCorpus();
      const rows = createLexicalRetriever(records)(query, filters, limit).map(toCitation);
      return { mode: "in-process-lexical", rows, fallbackReason: `PostgreSQL retrieval unavailable: ${error.message}` };
    }
  }
  const records = await loadCorpus();
  return { mode: "in-process-lexical", rows: createLexicalRetriever(records)(query, filters, limit).map(toCitation), fallbackReason: pool ? "No PostgreSQL matches" : "PostgreSQL unavailable" };
}

export async function getRagStatus(pool = null) {
  if (pool) {
    try {
      const result = await pool.query("SELECT COUNT(*)::int AS count FROM rag_chunks");
      if (result.rows[0].count > 0) return { mode: "postgresql-full-text", corpusCount: result.rows[0].count, semantic: false };
    } catch {
      // Truthfully report the restart-safe lexical fallback below.
    }
  }
  const records = await loadCorpus();
  return { mode: "in-process-lexical", corpusCount: records.length, semantic: false };
}
