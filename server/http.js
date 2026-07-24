import crypto from "node:crypto";

export function createHttpErrorHandler(log = console.error) {
  return (error, _req, res, _next) => {
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({
        error: "Malformed JSON request body.",
        phase: "Tier-0",
        recoverable: true,
      });
    }
    if (error?.type === "entity.too.large") {
      return res.status(413).json({
        error: "Request body is too large.",
        phase: "Tier-0",
        recoverable: true,
      });
    }
    const errorId = crypto.randomUUID();
    log(`Unexpected HTTP error (${errorId})`, {
      name: error?.name || "Error",
      message: error?.message || "Unknown error",
    });
    return res.status(500).json({
      error: "Unexpected server error.",
      phase: "Tier-0",
      recoverable: false,
      errorId,
    });
  };
}
