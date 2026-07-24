# Current progress

Status: Tier-0 RAG is implemented, tested, documented, and pushed. VPS deployment remains blocked because the target resets this execution environment's SSH connection before authentication.

## Git state

- Repository: `I-am-Mr-Rookie/rookieCoders_AgriSense`.
- Branch: `feat/tier0-rag`.
- Baseline revision: `73ccf3ce57b5ddd2b34ad11cd08722295a697ee7`.
- Implementation commit: `e813c5929629de5c74c0edc1a555fc44d052847c`.
- Current remote head after four corpus-shard commits: `674bf51ea19a10ca50b7b3fcfb63650f5e96ee4a`.

## Implemented and verified

- Corpus: validated 3,163-chunk Bangladesh/Rabi archive bundled as four `data/chunks-*.jsonl` files.
- Retrieval: PostgreSQL full-text path with strict metadata filters and restart-safe lexical fallback. Semantic retrieval is truthfully disabled until pgvector and a current official embedding model are verified.
- Evidence contract: citations expose publisher, source title, URL, page/table, dates, geography, units, confidence, quality flags, stable IDs, and retrieval scores.
- Agent path: live Open-Meteo, per-crop retrieval, evidence-aware deterministic ranking, selectable crop, dated plan, deterministic finance, saved session, and visible trace.
- Tests: 12 passed, 0 failed. The requested small no-evidence retrieval test also passed independently.
- Secrets scan: zero findings in the committed project.

## Deployment truth

- VPS target: supplied by the owner, but intentionally omitted from committed documentation.
- Direct SSH attempts consistently reached TCP port 22 and were reset before the SSH banner or password prompt.
- UFW and sshd were confirmed active by the owner; an upstream DigitalOcean firewall, source filter, or equivalent network policy still requires correction.
- PM2, Nginx, PostgreSQL ingestion, persistence-after-restart, HTTPS, and public browser verification are therefore not claimed as completed.
- Rollback target remains `73ccf3ce57b5ddd2b34ad11cd08722295a697ee7`; migration 002 is additive and safe to leave in place during application rollback.
