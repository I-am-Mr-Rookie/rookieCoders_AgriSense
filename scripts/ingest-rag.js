import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createGunzip } from "node:zlib";
import pg from "pg";

const corpusRoot = path.resolve(process.env.RAG_CORPUS_PATH || "data");
const corpusPaths = fs.statSync(corpusRoot).isDirectory()
  ? fs.readdirSync(corpusRoot).filter((name) => /^chunks-\d+\.jsonl(?:\.gz)?$/.test(name)).sort().map((name) => path.join(corpusRoot, name))
  : [corpusRoot];
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for PostgreSQL RAG ingestion");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const hash = crypto.createHash("sha256");
for (const corpusPath of corpusPaths) hash.update(fs.readFileSync(corpusPath));
const corpusHash = `sha256:${hash.digest("hex")}`;

const migration = fs.readFileSync(new URL("../server/migrations/002_rag_chunks.sql", import.meta.url), "utf8");
await pool.query(migration);

let parsed = 0;
let inserted = 0;
let updated = 0;
let unchanged = 0;
const started = Date.now();

for (const corpusPath of corpusPaths) {
  const source = fs.createReadStream(corpusPath);
  const input = readline.createInterface({ input: corpusPath.endsWith(".gz") ? source.pipe(createGunzip()) : source, crlfDelay: Infinity });
  for await (const line of input) {
    if (!line.trim()) continue;
  parsed += 1;
  let row;
  try { row = JSON.parse(line); } catch (error) { throw new Error(`Invalid JSON at line ${parsed}: ${error.message}`); }
  const metadata = { geo_code: row.geo_code, variety: row.variety, license_status: row.license_status, transform_notes: row.transform_notes };
  const result = await pool.query(
    `INSERT INTO rag_chunks (
       record_id, text, corpus_lane, content_type, provenance_class, publisher, source_title, source_url,
       source_file, source_page_or_table, publication_date, retrieved_at_utc, effective_from, effective_to,
       language, country, geo_level, geo_name, crop, season, topics, source_unit, normalized_unit,
       confidence, raw_content_hash, quality_flags, searchable_metadata
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22,$23,$24,$25,$26::jsonb,$27::jsonb
     )
     ON CONFLICT (record_id) DO UPDATE SET
       text=EXCLUDED.text, corpus_lane=EXCLUDED.corpus_lane, content_type=EXCLUDED.content_type,
       provenance_class=EXCLUDED.provenance_class, publisher=EXCLUDED.publisher, source_title=EXCLUDED.source_title,
       source_url=EXCLUDED.source_url, source_file=EXCLUDED.source_file, source_page_or_table=EXCLUDED.source_page_or_table,
       publication_date=EXCLUDED.publication_date, retrieved_at_utc=EXCLUDED.retrieved_at_utc,
       effective_from=EXCLUDED.effective_from, effective_to=EXCLUDED.effective_to, language=EXCLUDED.language,
       country=EXCLUDED.country, geo_level=EXCLUDED.geo_level, geo_name=EXCLUDED.geo_name, crop=EXCLUDED.crop,
       season=EXCLUDED.season, topics=EXCLUDED.topics, source_unit=EXCLUDED.source_unit,
       normalized_unit=EXCLUDED.normalized_unit, confidence=EXCLUDED.confidence, raw_content_hash=EXCLUDED.raw_content_hash,
       quality_flags=EXCLUDED.quality_flags, searchable_metadata=EXCLUDED.searchable_metadata, content_updated_at=NOW()
     WHERE rag_chunks.raw_content_hash IS DISTINCT FROM EXCLUDED.raw_content_hash
     RETURNING (xmax = 0) AS inserted`,
    [row.record_id, row.text, row.corpus_lane, row.content_type, row.provenance_class, row.publisher, row.source_title,
     row.source_url, row.source_file, row.source_page_or_table, row.publication_date, row.retrieved_at_utc || null,
     row.effective_from, row.effective_to, row.language, row.country, row.geo_level, row.geo_name, row.crop, row.season,
     JSON.stringify(row.topics ?? []), row.source_unit, row.normalized_unit, row.confidence, row.raw_content_hash,
     JSON.stringify(row.quality_flags ?? []), JSON.stringify(metadata)],
  );
  if (!result.rowCount) unchanged += 1;
    else if (result.rows[0].inserted) inserted += 1;
    else updated += 1;
  }
}

if (parsed !== 3163) throw new Error(`Corpus count mismatch: expected 3163, parsed ${parsed}`);
await pool.query(
  `INSERT INTO rag_ingestions (corpus_hash, source_path, parsed_count, inserted_count, updated_count, unchanged_count, completed_at)
   VALUES ($1,$2,$3,$4,$5,$6,NOW())
   ON CONFLICT (corpus_hash) DO UPDATE SET parsed_count=$3, inserted_count=$4, updated_count=$5, unchanged_count=$6, completed_at=NOW()`,
  [corpusHash, corpusRoot, parsed, inserted, updated, unchanged],
);
const count = await pool.query("SELECT COUNT(*)::int AS count FROM rag_chunks");
console.log(JSON.stringify({ corpusHash, parsed, inserted, updated, unchanged, stored: count.rows[0].count, durationMs: Date.now() - started }));
await pool.end();
