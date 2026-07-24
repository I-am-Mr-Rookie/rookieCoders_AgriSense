# RAG evaluation

Run `node --test tests/rag.test.js` for the root-cause regression suite. It verifies full corpus parsing, Gazipur mustard fertilizer evidence, potato calendar evidence, Boro rice irrigation evidence with safety flags, strict Bangladesh/Rabi/crop filters, no-evidence behavior, citation metadata, and answer sensitivity to evidence changes.

Run PostgreSQL ingestion twice:

```bash
node scripts/ingest-rag.js
node scripts/ingest-rag.js
```

The second JSON result must report `parsed: 3163`, `stored: 3163`, `inserted: 0`, `updated: 0`, and `unchanged: 3163`.

Target-environment gates remain: PostgreSQL persistence after PM2 restart, live Open-Meteo trace, OpenAI Responses execution when configured, public browser journey, exact deployed SHA, and secret scan.
