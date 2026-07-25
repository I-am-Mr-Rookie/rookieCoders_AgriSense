import crypto from "node:crypto";

import { Tier2UnavailableError } from "./market-intelligence.js";
import { summarizeError } from "./recovery.js";
import { ValidationError } from "./validation.js";

function unavailableService() {
  throw new Tier2UnavailableError();
}

function sendError(error, res, label, log) {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: error.message,
      phase: "Tier-2",
      recoverable: true,
    });
  }
  if (error instanceof Tier2UnavailableError) {
    return res.status(error.statusCode).json({
      error: error.message,
      phase: "Tier-2",
      recoverable: true,
    });
  }
  const errorId = crypto.randomUUID();
  log(`AgriSense Tier-2 ${label} failed (${errorId})`, summarizeError(error));
  return res.status(502).json({
    error: "AgriSense could not complete this Tier 2 request.",
    errorId,
    phase: "Tier-2",
    recoverable: true,
  });
}

export function createTier2Handlers({
  marketService = { research: unavailableService },
  diseaseService = { diagnose: unavailableService },
  realtimeService = { createClientSecret: unavailableService },
  log = console.error,
} = {}) {
  return {
    async market(req, res) {
      try {
        return res.json(await marketService.research(req.body));
      } catch (error) {
        return sendError(error, res, "market research", log);
      }
    },
    async disease(req, res) {
      try {
        return res.json(await diseaseService.diagnose(req.body));
      } catch (error) {
        return sendError(error, res, "disease diagnosis", log);
      }
    },
    async realtime(req, res) {
      try {
        return res.json(await realtimeService.createClientSecret(req.body));
      } catch (error) {
        return sendError(error, res, "realtime session", log);
      }
    },
  };
}
