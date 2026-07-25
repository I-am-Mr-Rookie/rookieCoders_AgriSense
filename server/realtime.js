import crypto from "node:crypto";

import { Tier2UnavailableError } from "./market-intelligence.js";

const DEFAULT_MODEL = "gpt-realtime-2.1";
const DEFAULT_VOICE = "marin";

export const REALTIME_INSTRUCTIONS = `
# Role and objective
You are AgriSense's low-latency farm companion for farmers in Bangladesh.

# Language
Speak primarily in natural Bangla. Accept Bangla mixed with familiar English agricultural words, product names, numbers, and place names. If the farmer speaks English, answer in the same language unless they ask for Bangla.

# Personality and tone
Sound like a calm, capable Bangladeshi farm adviser, not a call-centre script. Use warm, varied sentence rhythm and everyday words. Speak one thought at a time. Never read Markdown symbols, table syntax, URLs, or source metadata aloud.

# Verbosity
Direct answers use one or two short spoken sentences. Ask one clear question at a time. For tool results, state the result first and then the single most useful next action.

# Preambles
Give one brief spoken preamble before a tool call or any task that may take noticeable time. Describe the action, never hidden reasoning. Vary the wording and avoid filler.

# Heavy work
For market research, supplier comparison, price intelligence, farm-plan work, or any request requiring external evidence, call run_agrisense_task. Do not independently invent its result. When the tool result arrives, summarize and read that verified result naturally.

# Confirmation
Confirm uncertain prices, dates, quantities, farm sizes, budget figures, locations, and chemical or product names before treating them as facts. When audio is unclear, ask for a repeat instead of guessing.

# Unclear audio
Treat silence, background speech, television, and partial words as unclear audio. Do not fill gaps or combine them with an earlier turn. Briefly ask the farmer to repeat only the missing detail.

# Safety
Never reveal hidden reasoning or chain-of-thought. Never claim a tool completed before its result arrives. Never prescribe agricultural chemicals without current official registry evidence. Do not perform purchases, payments, or other irreversible actions.
`.trim();

export function createSafetyIdentifier(memoryId = "", sessionId = "", secret = "") {
  const stableInput = `${String(memoryId).slice(0, 200)}:${String(sessionId).slice(0, 200)}`;
  const digest = crypto
    .createHmac("sha256", String(secret || "agrisense-local-safety"))
    .update(stableInput || "anonymous-session")
    .digest("hex")
    .slice(0, 48);
  return `agrisense_${digest}`;
}

function sessionConfiguration(model, voice) {
  return {
    session: {
      type: "realtime",
      model,
      reasoning: { effort: "low" },
      instructions: REALTIME_INSTRUCTIONS,
      audio: {
        input: {
          turn_detection: {
            type: "semantic_vad",
            eagerness: "low",
            create_response: true,
            interrupt_response: true,
          },
          transcription: {
            model: "gpt-4o-mini-transcribe",
            prompt: "Bangla farm conversation with occasional English agricultural terms, Bangladesh locations, BDT prices, crop names, and measurements.",
          },
        },
        output: { voice },
      },
      tools: [{
        type: "function",
        name: "run_agrisense_task",
        description: "Hand market research, supplier comparison, price intelligence, or farm-planning work to the evidence-grounded heavy AgriSense workflow.",
        parameters: {
          type: "object",
          properties: {
            task: {
              type: "string",
              description: "The farmer's complete requested task with confirmed location, crop, and constraints.",
            },
          },
          required: ["task"],
          additionalProperties: false,
        },
      }],
      tool_choice: "auto",
    },
  };
}

export function createRealtimeService({
  apiKey = "",
  fetchImpl = globalThis.fetch,
  model = DEFAULT_MODEL,
  voice = DEFAULT_VOICE,
  safetySecret = "",
} = {}) {
  return {
    async createClientSecret({ memoryId = "", sessionId = "" } = {}) {
      if (!apiKey || typeof fetchImpl !== "function") throw new Tier2UnavailableError();
      const response = await fetchImpl("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Safety-Identifier": createSafetyIdentifier(
            memoryId,
            sessionId,
            safetySecret || apiKey,
          ),
        },
        body: JSON.stringify(sessionConfiguration(model, voice)),
      });
      if (!response.ok) {
        throw new Tier2UnavailableError("Realtime voice could not start. Typed chat remains available.");
      }
      const data = await response.json();
      if (typeof data?.value !== "string" || !data.value) {
        throw new Tier2UnavailableError("Realtime voice returned an invalid session credential.");
      }
      return {
        value: data.value,
        expiresAt: data.expires_at ?? null,
        model,
        voice,
      };
    },
  };
}
