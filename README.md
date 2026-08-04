# AgriSense

**An evidence-aware AI farm companion for practical decisions in Bangladesh and beyond.**

AgriSense turns a farmer's everyday question into a grounded next step. People can write or speak naturally, share a plant image, ask for a seasonal plan, compare suppliers, or revise a budget without restarting the conversation. The product combines a conversational model with deterministic safety checks, local agricultural references, live weather and market sources, and compact long-term farm memory.

The interface is designed for Android-first use and supports English and natural Bangla. The codebase is MIT-licensed so other teams can adapt the workflow to their own crops, languages, and evidence sources.

## What it does

- **Natural farmer chat** — asks only for missing context, understands mixed Bangla/English input, and keeps the conversation human rather than form-driven.
- **Crop and season planning** — ranks suitable crops and creates a dated calendar from land preparation through harvest, including sowing, fertilizer, irrigation, weed, pest, and harvest checkpoints.
- **Weather-aware scheduling** — uses a fresh Bangladesh forecast to adjust irrigation and explain the change.
- **Market intelligence** — searches current sources for market prices, marketplace options, and supplier comparisons when the feature is enabled.
- **Plant-image assistance** — accepts an image and returns a cautious likely-cause assessment with uncertainty and safe next steps.
- **Voice interaction** — offers Bangla/English realtime voice with an editable transcript fallback.
- **Persistent memory** — stores a token-efficient farm summary and separate conversations in PostgreSQL so a returning farmer can continue where they left off.
- **Transparent agent activity** — shows bounded tool calls, sources, retrieved records, timing, and API-provided summaries without exposing private chain-of-thought.
- **Safety-first outputs** — does not present chemical recommendations without current official registry evidence and labels generated estimates separately from retrieved facts.

## Product boundaries

AgriSense is decision support, not a substitute for an agronomist, laboratory diagnosis, emergency service, or government advisory. Weather, prices, disease signals, and financial projections can be incomplete or stale. Confirm dates, quantities, chemical labels, and high-impact actions with a qualified local source before acting.

The core planning path works without a model key by using the local evidence corpus and deterministic fallbacks. OpenAI, PostgreSQL, weather, payment, market-search, image, and realtime voice integrations are opt-in server-side capabilities. No credential belongs in the browser bundle or repository.

## Architecture

```text
React + Vite farmer workspace
          |
          v
Express API and conversational orchestrator
   |       |          |          |
   |       |          |          +--> OpenAI Responses / Realtime (optional)
   |       |          +-------------> Open-Meteo weather (optional)
   |       +------------------------> PostgreSQL memory, auth, sessions
   +--------------------------------> local provenance-rich agriculture corpus
                                      |
                                      +--> optional bdapps payment adapter
```

The model interprets intent and chooses among bounded tools. JavaScript remains responsible for validation, safety rules, deterministic calculations, persistence, and executing approved calls. This keeps the experience flexible without allowing a model response to bypass application invariants.

## Stack

- Node.js 22+, Express 5, PostgreSQL (`pg`)
- React 19, Vite 7, `react-markdown` with GFM and raw HTML disabled
- OpenAI Responses API and Realtime API (optional)
- Open-Meteo weather API (optional)
- Local JSON agriculture corpus with source, page/reference, category, and confidence metadata
- Optional `services/bdapps-payment` Express/React adapter for Bangladesh CaaS/OTP flows

## Run locally

Requires Node.js 22 or newer and npm.

```powershell
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run check
npm.cmd start
```

Open <http://localhost:3001>. For an interactive development session, run `npm.cmd run dev` instead.

The server can run in a clearly labeled process-memory fallback when PostgreSQL is not configured. Configure PostgreSQL before evaluating durable accounts, recovery-linked sessions, or cross-device memory.

### Environment

Copy `.env.example` and fill only the values required for the capabilities you want to exercise:

```text
OPENAI_API_KEY=server-side-only
OPENAI_MODEL=gpt-5.6
OPENAI_REASONING_EFFORT=auto
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
OPENAI_REALTIME_VOICE=marin
DATABASE_URL=postgres://...
AUTH_SESSION_SECRET=use-a-long-random-value
PAYMENT_SERVICE_URL=http://127.0.0.1:4317/api/bdapps
PAYMENT_ADMIN_TOKEN=server-side-only
```

Keep `DATABASE_SSL_REJECT_UNAUTHORIZED=true` for managed databases. Never commit `.env`, provider keys, payment credentials, OTPs, session tokens, or database URLs that contain passwords.

## Optional payment adapter

`services/bdapps-payment/` is a separately runnable Express/React adapter for OTP, CaaS balance, payment instruments, callbacks, and one-time prototype charges. It is intentionally isolated from the farmer client and keeps provider credentials server-side.

```powershell
cd services/bdapps-payment
Copy-Item .env.example .env
npm.cmd install
docker compose up -d db
npm.cmd run db:migrate
npm.cmd test
```

The automated suite mocks provider calls. It does not send SMS, request OTPs, or debit an account.

## Verification

From the repository root:

```powershell
npm.cmd run check
npm.cmd audit --omit=dev
git diff --check
```

The tests cover validation, intent routing, memory/session lifecycle, weather and evidence handling, streamed agent activity, Markdown, themes, authentication, payment contracts, image assistance, and realtime voice contracts. Provider-backed calls and real charges require separate, explicit manual approval.

## Repository map

```text
src/                 React application, chat, themes, voice, Markdown, evidence UI
server/              Express routes, orchestration, validation, persistence, providers
shared/              Server/client-safe redaction and assistant contracts
data/structured/     Provenance-rich agriculture reference records
tests/               Unit, contract, integration, and hostile-input tests
services/            Optional bdapps payment adapter
docs/                Architecture, deployment, and contributor guidance
```

## Deployment notes

See [`docs/deployment-vps.md`](docs/deployment-vps.md) for a provider-neutral release runbook. The live application, when configured, uses a versioned Node release, PostgreSQL, HTTPS, and a separate payment service. Deployment credentials and production `.env` files stay outside Git.

## Contributing

Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a change. Contributions should preserve source provenance, explicit safety boundaries, keyboard accessibility, reduced-motion behavior, and the distinction between retrieved facts, team assumptions, and model-generated text.

## Security

Please report security issues privately as described in [`SECURITY.md`](SECURITY.md). Do not open a public issue containing credentials, personal data, payment details, or a reproducible account takeover path.

## License

AgriSense is released under the [MIT License](LICENSE).
