import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import { assistantText } from "../shared/assistant.js";
import { createNdjsonWriter } from "./activity.js";
import { createAuthHandlers } from "./auth-http.js";
import { createAuthService, createBdappsOtpClient } from "./auth.js";
import { buildSeasonPlan, createTraceEntry, getMissingFields, rankCrops } from "./core.js";
import { interpretConversationTurn } from "./conversation.js";
import {
  createAuthSession,
  createLoginChallenge,
  claimDailyAccess,
  completeDailyAccess,
  databaseMode,
  deleteAuthSession,
  deleteLoginChallenge,
  deleteSession,
  initializeDatabase,
  loadAuthSession,
  loadAuthUserByMobileHash,
  loadDailyAccess,
  loadSession,
  saveSession,
  setAuthPassword,
  consumeLoginChallenge,
  upsertAuthUser,
} from "./db.js";
import { createMemoryService } from "./memory.js";
import { createDailyAccessService } from "./daily-access.js";
import {
  createOpenAiClient,
  answerGeneralFarmerQuestion,
  briefCropCandidates,
  explainRecommendation,
  extractProfilePatch,
  openAiMode,
} from "./openai.js";
import { createHttpErrorHandler } from "./http.js";
import { createDiseaseDiagnosisService } from "./disease-diagnosis.js";
import { createMarketIntelligenceService } from "./market-intelligence.js";
import { createPaymentGateway } from "./payment-gateway.js";
import { createPaymentStatusHandler, createSubscriptionCancelHandler } from "./payment-http.js";
import { getCropEvidence, getPlanEvidence, loadCorpus, retrieveFacts } from "./rag.js";
import { createRealtimeService } from "./realtime.js";
import { createPersistenceGuard, summarizeError } from "./recovery.js";
import { getReleaseRevision } from "./revision.js";
import { buildInputSchedule } from "./scheduler.js";
import { createTier2Handlers } from "./tier2-http.js";
import { ValidationError, validateProfilePatch } from "./validation.js";
import { getWeather } from "./weather.js";
import { createPlanningWorkflow } from "./workflow.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const otpFormParser = express.urlencoded({ extended: false, limit: "4kb" });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "../dist");
const memoryService = createMemoryService({ loadSession, saveSession, deleteSession });
const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || "https://rookiecoders.tech/api/bdapps";
const paymentDashboardUrl = process.env.PAYMENT_DASHBOARD_URL || "https://rookiecoders.tech/payments/";
const paymentGateway = createPaymentGateway({
  serviceUrl: paymentServiceUrl,
  dashboardUrl: paymentDashboardUrl,
  adminToken: process.env.PAYMENT_ADMIN_TOKEN,
});
const dailyAccessService = createDailyAccessService({
  store: { loadDailyAccess, claimDailyAccess, completeDailyAccess },
  gateway: paymentGateway,
  // The hackathon prototype charges once during OTP enrollment. Returning
  // password logins must never trigger another provider debit, even if an old
  // deployment environment still contains DAILY_BILLING_ENABLED=true.
  enabled: false,
});
const authService = createAuthService({
  store: {
    upsertUser: upsertAuthUser,
    createSession: createAuthSession,
    loadSession: loadAuthSession,
    deleteSession: deleteAuthSession,
    createLoginChallenge,
    deleteLoginChallenge,
    consumeLoginChallenge,
    loadUserByMobileHash: loadAuthUserByMobileHash,
    setPassword: setAuthPassword,
  },
  otpClient: createBdappsOtpClient({
    serviceUrl: paymentServiceUrl,
    adminToken: process.env.PAYMENT_ADMIN_TOKEN,
  }),
  secret: process.env.AUTH_SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  dailyAccessService,
});
const authHandlers = createAuthHandlers({
  authService,
  memoryService,
  secureCookies: process.env.NODE_ENV === "production",
  persistenceMode: databaseMode,
});
const paymentStatusHandler = createPaymentStatusHandler(paymentGateway);
const subscriptionCancelHandler = createSubscriptionCancelHandler({ authService, gateway: paymentGateway });
const tier2Client = createOpenAiClient();
const tier2Handlers = createTier2Handlers({
  marketService: createMarketIntelligenceService({
    client: tier2Client,
    model: process.env.OPENAI_MODEL || "gpt-5.6",
  }),
  diseaseService: createDiseaseDiagnosisService({
    client: tier2Client,
    model: process.env.OPENAI_MODEL || "gpt-5.6",
  }),
  realtimeService: createRealtimeService({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1",
    voice: process.env.OPENAI_REALTIME_VOICE || "marin",
    safetySecret: process.env.OPENAI_SAFETY_SECRET,
  }),
});

app.post("/api/tier2/disease", express.json({ limit: "7mb" }), tier2Handlers.disease);
app.use(express.json({ limit: "64kb" }));
app.post("/api/tier2/market", tier2Handlers.market);
app.post("/api/realtime/client-secret", tier2Handlers.realtime);
app.post("/api/auth/otp/request", authHandlers.requestOtp);
app.post("/api/auth/otp/verify", otpFormParser, authHandlers.verifyOtp);
app.post("/api/auth/password/setup", authHandlers.passwordSetup);
app.post("/api/auth/password/login", authHandlers.passwordLogin);
app.get("/api/auth/session", authHandlers.session);
app.post("/api/auth/logout", authHandlers.logout);
app.get("/api/payments/status", paymentStatusHandler);
app.post("/api/subscription/cancel", subscriptionCancelHandler);

app.get("/api/health", (_req, res) => {
  const corpus = loadCorpus().report;
  res.json({
    ok: true,
    phase: "Tier-2",
    releaseRevision: getReleaseRevision(),
    database: databaseMode(),
    model: openAiMode(),
    capabilities: {
      persistentMemory: true,
      inputScheduler: true,
      activityStream: true,
      marketIntelligence: true,
      imageDiagnosis: true,
      realtimeVoice: true,
      mobileOtpAuthentication: true,
      accountBoundMemory: true,
      paymentGateway: true,
      externalNotifications: false,
    },
    rag: corpus,
  });
});

app.get(["/evaluation", "/evaluation.html"], (_req, res) => {
  res.sendFile(path.resolve(__dirname, "../evaluation.html"));
});

function workflowFor(persistence) {
  return createPlanningWorkflow({
    loadSession,
    saveSession: (session) => persistence.saveMergedProfile(session),
    extractProfilePatch,
    interpretConversationTurn,
    validateProfilePatch,
    getMissingFields,
    getWeather,
    getCropEvidence,
    retrieveFacts,
    rankCrops,
    getPlanEvidence,
    buildSeasonPlan,
    buildInputSchedule,
    loadCorpus,
    createTraceEntry,
    answerGeneralFarmerQuestion,
    briefCropCandidates,
    explainRecommendation,
    openAiMode,
    memoryService,
    createSessionId: () => crypto.randomUUID(),
  });
}

app.post("/api/memory/create", async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || "");
    const session = sessionId ? await loadSession(sessionId) : { profile: {}, lastResult: null };
    const created = await memoryService.create({
      profile: session.profile,
      lastResult: session.lastResult,
      preferences: {
        autoAdjustIrrigation: req.body?.preferences?.autoAdjustIrrigation !== false,
      },
    });
    res.status(201).json({ ...created, database: databaseMode() });
  } catch (error) {
    const errorId = crypto.randomUUID();
    console.error(`AgriSense memory creation failed (${errorId})`, summarizeError(error));
    res.status(502).json({ error: "Could not create farmer memory.", errorId, recoverable: true });
  }
});

app.post("/api/memory/resume", async (req, res) => {
  try {
    const memory = await memoryService.load(req.body.memoryId);
    if (!memory) return res.status(404).json({ error: "Farmer memory was not found.", recoverable: true });
    return res.json({ memory, database: databaseMode() });
  } catch (error) {
    return res.status(400).json({ error: error.message, recoverable: true });
  }
});

app.post("/api/memory/reset", async (req, res) => {
  try {
    const reset = await memoryService.reset(req.body.memoryId);
    return res.json({ reset });
  } catch (error) {
    return res.status(400).json({ error: error.message, recoverable: true });
  }
});

app.post("/api/memory/preferences", async (req, res) => {
  try {
    const memory = await memoryService.updatePreferences(req.body.memoryId, req.body.preferences);
    if (!memory) return res.status(404).json({ error: "Farmer memory was not found.", recoverable: true });
    return res.json({ memory, database: databaseMode() });
  } catch (error) {
    return res.status(400).json({ error: error.message, recoverable: true });
  }
});

app.post("/api/memory/sessions", async (req, res) => {
  try {
    const memory = await memoryService.createConversationSession(
      req.body.memoryId,
      req.body.session,
    );
    return res.status(201).json({ memory, database: databaseMode() });
  } catch (error) {
    return res.status(400).json({ error: error.message, recoverable: true });
  }
});

app.post("/api/session/message", async (req, res) => {
  const persistence = createPersistenceGuard(saveSession);
  try {
    const result = await workflowFor(persistence)(req.body);
    return res.json({ ...result, assistant: assistantText(result.assistant) });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message, phase: "Tier-0", recoverable: true });
    }
    const errorId = crypto.randomUUID();
    console.error(`AgriSense Tier-1 request failed (${errorId})`, summarizeError(error));
    return res.status(502).json(persistence.failurePayload(errorId));
  }
});

app.post("/api/session/message/stream", async (req, res) => {
  const persistence = createPersistenceGuard(saveSession);
  const write = createNdjsonWriter(res);
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    const result = await workflowFor(persistence)(req.body, write, controller.signal);
    write({ type: "result", status: "completed", data: { ...result, assistant: assistantText(result.assistant) } });
  } catch (error) {
    if (controller.signal.aborted) return;
    const errorId = crypto.randomUUID();
    const payload = error instanceof ValidationError
      ? { error: error.message, phase: "Tier-0", recoverable: true }
      : persistence.failurePayload(errorId);
    if (!(error instanceof ValidationError)) {
      console.error(`AgriSense Tier-1 stream failed (${errorId})`, summarizeError(error));
    }
    write({
      id: "activity-error",
      type: "request.failed",
      label: "Request failed",
      status: "failed",
      timestamp: new Date().toISOString(),
      details: payload,
    });
  } finally {
    if (!res.destroyed) res.end();
  }
});

app.use(createHttpErrorHandler());

app.use(express.static(dist));
app.get("*path", (_req, res) => res.sendFile(path.join(dist, "index.html")));

initializeDatabase()
  .then((mode) => app.listen(port, () => console.log(`AgriSense Tier-2 listening on :${port} (${mode})`)))
  .catch((error) => {
    console.error("Database initialization failed", summarizeError(error));
    process.exitCode = 1;
  });
