# AgriSense Tier 2 Multimodal Agent Design

## Objective

Extend the existing recovery-linked, chat-first AgriSense workspace with a bounded Tier 2 vertical slice:

- current marketplace and supplier research;
- current market-price intelligence;
- plant-disease image analysis;
- Bangla-first, English-tolerant realtime voice;
- explicit fallback behavior when OpenAI, microphone, evidence, or transcription confidence is unavailable.

The existing farm-plan workflow, persistent memory, multi-session chat, chemical-safety rules, and payment integration boundary remain intact.

## Architecture

The browser remains a single chat workspace. Tier 2 adds three composer controls—market research, image attachment, and voice—without creating a second dashboard.

The heavy lane uses the OpenAI Responses API. `gpt-5.6` is the documented default and remains configurable through `OPENAI_MODEL`. Market research enables the hosted `web_search` tool and returns source annotations. Image diagnosis sends a validated image as an `input_image`. Both lanes return sanitized, display-ready records rather than raw model output.

The conversational lane uses `gpt-realtime-2.1` through WebRTC. The browser requests a short-lived client secret from the trusted Express server; the standard API key never reaches client code. Realtime voice provides concise Bangla/English preambles, interruptions, and spoken delivery while the heavy lane performs evidence retrieval and planning.

## Contracts

### Market intelligence

Request:

```json
{
  "kind": "supplier_comparison",
  "crop": "maize",
  "location": "Gazipur",
  "query": "compare nearby seed suppliers",
  "memoryId": "farm_recovery_code",
  "memorySessionId": "session_id"
}
```

Response:

```json
{
  "kind": "supplier_comparison",
  "summary": "Markdown with inline numbered citations",
  "items": [
    {
      "supplier": "Supplier name",
      "product": "Product name",
      "location": "Gazipur",
      "priceBdt": 0,
      "unit": "kg",
      "availability": "unknown",
      "sourceUrl": "https://example.com",
      "sourceTitle": "Source title",
      "retrievedAt": "ISO-8601"
    }
  ],
  "sources": [
    {
      "url": "https://example.com",
      "title": "Source title"
    }
  ],
  "freshness": "ISO-8601",
  "limitations": []
}
```

The server rejects missing location/query input, strips unsafe URL schemes, deduplicates citations, and never invents unavailable prices.

### Disease diagnosis

The browser converts one JPEG, PNG, or WebP file up to 5 MiB into a data URL. The server validates the media type and decoded size before calling OpenAI.

Response:

```json
{
  "kind": "disease_diagnosis",
  "summary": "Markdown",
  "likelyCauses": [
    {
      "name": "Possible condition",
      "confidence": "low"
    }
  ],
  "observations": [],
  "safeNextSteps": [],
  "chemicalRecommendation": null,
  "limitations": [],
  "model": "gpt-5.6"
}
```

Diagnosis is decision support, not certainty. Chemical recommendations remain `null` unless a separate current official-registry evidence contract is satisfied.

### Realtime voice

`POST /api/realtime/client-secret` accepts the active memory/session identifiers and creates a short-lived OpenAI Realtime client secret server-side. The returned payload contains only the ephemeral value, expiry, model, and voice.

Realtime instructions:

- speak primarily in natural Bangla and preserve familiar English agricultural terms;
- use one short preamble before noticeable tool work;
- never reveal hidden reasoning;
- repeat and confirm uncertain prices, dates, quantities, farm sizes, and chemical names;
- hand heavy research and plan generation to the existing text workflow;
- read the verified final result instead of independently changing it.

If Realtime, microphone access, or audio understanding fails, the composer remains fully usable. The visible transcript can be edited and submitted as text.

## Visual direction

Preserve the approved forest-green/warm-paper themes, Newsreader headings, and Anek Bangla body text. New controls use a compact field-console treatment:

```text
┌──────────────────────────────────────────────────────────────┐
│ conversation and inline agent activity                       │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ [＋ photo] [⌕ market]  Ask AgriSense…             [mic] [↑] │
│ attached leaf preview / live Bangla transcript when present  │
└──────────────────────────────────────────────────────────────┘
```

The signature element is a single animated voice “field pulse” around the microphone. It uses transform and opacity only, stops under reduced-motion preferences, and never competes with agent activity.

## Fallback ladder

1. Use live OpenAI capability when configured and available.
2. Return a precise recoverable error with the existing plan/chat still intact.
3. Keep typed chat available.
4. Preserve uploaded image preview so the farmer can retry.
5. Never manufacture suppliers, prices, disease certainty, tool progress, or chemical instructions.

## Out of scope

- VPS or production deployment;
- stress/load testing;
- purchases or payment mutations;
- rebuilding payment code not present in this checkout;
- autonomous chemical prescriptions;
- storing raw uploaded images in PostgreSQL;
- claiming production-grade Bengali speech accuracy without field evaluation.
