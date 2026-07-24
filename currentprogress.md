# Current progress

Status: Tier-0 RAG implemented locally; target deployment requires authenticated GitHub and Droplet access.

- Baseline revision: `73ccf3ce57b5ddd2b34ad11cd08722295a697ee7`.
- Corpus: validated 3,163-chunk Bangladesh/Rabi archive bundled as four `data/chunks-*.jsonl` files.
- Retrieval: PostgreSQL full-text path with strict metadata filters; restart-safe lexical fallback; semantic retrieval truthfully disabled until pgvector and an official embedding model are verified.
- Evidence contract: citations expose provenance, URL, page/table, dates, geography, units, confidence, flags, stable IDs, and scores.
- Agent path: live Open-Meteo, per-crop retrieval, evidence-aware deterministic ranking, selectable crop, dated plan, deterministic finance, saved session, and visible trace.
- Regression suite: corpus parsing, target queries, filters, no-evidence behavior, citation integrity, and evidence-sensitivity tests added.
- Deployment blocker: no authenticated DigitalOcean route was available in this thread; GitHub integration access was requested.
