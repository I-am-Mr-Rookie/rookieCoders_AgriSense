# AgriSense architecture

AgriSense is a single farmer workspace backed by a small Express service. The browser owns presentation and input; the server owns orchestration, validation, safety rules, provider credentials, and persistence.

## Request flow

```text
Farmer input (text / Bangla voice / image)
        |
        v
Conversation API -> intent + missing context -> bounded tool loop
        |                         |
        |                         +--> weather / market / evidence / vision / realtime voice
        v
Validation + safety boundary -> plan, explanation, citations, compact memory update
        |
        +--> PostgreSQL (users, sessions, conversations, farm summary)
        +--> streamed NDJSON activity -> React chat message
```

The model decides how to interpret a request and which approved capability is useful. Deterministic code still validates locations, budgets, images, tool parameters, payment consent, and safety prohibitions. This division keeps natural conversation from turning into an unbounded or unauditable execution path.

## Evidence and memory

Local JSON records are indexed with provenance and confidence. Live sources carry a URL, publisher, retrieval timestamp, and bounded source excerpt. Duplicate URLs are grouped for readability while the underlying record IDs remain available for audit.

Farm memory is a short, token-efficient summary of durable preferences and facts, not a raw transcript. Conversations remain separate and can be resumed through the authenticated session/recovery flow. PostgreSQL is the durable path; the process-memory fallback is labeled for local development.

## Failure behavior

- Provider timeouts return a grounded fallback or a clear retry state; the UI never spins indefinitely.
- Weather and market freshness are visible in the answer.
- Image results are framed as likely causes and safe next steps, not definitive diagnoses.
- Chemical advice is withheld unless current official registry evidence is present.
- Payment calls are explicit, idempotent, server-side, and never automatically retried after an unknown result.
