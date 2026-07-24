# AgriSense Tier-0 RAG architecture

AgriSense uses a bounded hybrid design. Deterministic code validates farm fields, fetches current Open-Meteo weather, ranks crops, computes dates and finance, and persists session state. Retrieval supplies evidence; GPT-5.6 Sol may explain only the supplied inputs, tool results, deterministic outputs, and retrieved chunks.

## Retrieval ladder

1. PostgreSQL full-text search over `rag_chunks`, after country, corpus-lane, season, crop, and geography filtering.
2. Restart-safe in-process lexical retrieval over the bundled 3,163-chunk JSONL corpus when PostgreSQL or the indexed table is unavailable.

No vector capability is claimed. The migration does not create pgvector, and the health response labels semantic retrieval unavailable. An embedding model must be configured with `OPENAI_EMBEDDING_MODEL` only after the target environment and current official API model have been verified.

## Provenance and safety

Every result exposes record ID, publisher, title, URL, source file, page/table context, dates, geography, crop/season, units, confidence, and quality flags. `PRIOR_PARTIAL` or `REVALIDATE_PRIOR_NORMALIZATION_AGAINST_RAW_SOURCE` evidence is visibly flagged and cannot independently justify high-stakes advice. DAM snapshots are never treated as production costs; map legends are not field observations; elemental nutrients are not fertilizer-product rates; pesticide registration is not a chemical recommendation.

## Idempotency

`scripts/ingest-rag.js` applies the additive migration, parses every JSONL row, requires exactly 3,163 chunks, upserts by stable `record_id`, and updates content only when `raw_content_hash` changes. A second run reports all unchanged rows and creates no duplicates.
