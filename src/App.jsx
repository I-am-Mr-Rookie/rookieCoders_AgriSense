import React, { useEffect, useMemo, useRef, useState } from "react";
import { assistantText } from "../shared/assistant.js";
import {
  appendRunEvent,
  cancelAgentRun,
  completeAgentRun,
  createAgentRun,
  failAgentRun,
  toggleRunCollapsed,
} from "./agent-run.js";
import {
  focusTranscriptItem,
  isNearTranscriptBottom,
  pinTranscript,
} from "./chat-scroll.js";
import AgentRunMessage from "./components/AgentRunMessage.jsx";
import AuthDialog from "./components/AuthDialog.jsx";
import ConversationSidebar from "./components/ConversationSidebar.jsx";
import CropCandidateSelector from "./components/CropCandidateSelector.jsx";
import EvidenceGroupList from "./components/EvidenceGroupList.jsx";
import LandingPage from "./components/LandingPage.jsx";
import LanguageControl from "./components/LanguageControl.jsx";
import Markdown from "./components/Markdown.jsx";
import PaymentGatewayCard from "./components/PaymentGatewayCard.jsx";
import { PlanRevisionCard } from "./components/PlanRevisionCard.jsx";
import Tier2ComposerTools from "./components/Tier2ComposerTools.jsx";
import VoiceOrb from "./components/VoiceOrb.jsx";
import { loadLanguage, persistLanguage, responseLanguageName, t } from "./i18n.js";
import {
  appendChatTurn,
  canCreatePlanFrom,
  completePlanRevision,
  createRevisionState,
} from "./conversation.js";
import {
  createFreshDemoState,
  createInitialConversation,
  createSessionId,
  loadOrCreateSessionId,
  persistSessionId,
} from "./session.js";
import { redactRecoveryIds } from "../shared/redaction.js";
import { derivePlanBudgetView } from "./plan-budget.js";
import { createRunPresenter } from "./run-presenter.js";
import { applyAssistantTranscript, startRealtimeSession } from "./realtime.js";
import { consumeNdjsonStream } from "./stream.js";
import { applyTheme, loadThemePreference, persistThemePreference } from "./theme.js";
import {
  buildMarketRequest,
  createTier2CompletionEvents,
  createTier2StartEvent,
  isMarketIntelligenceRequest,
  readAttachment,
  tier2ResultMarkdown,
} from "./tier2.js";

const DEMO_PROFILE = {
  location: "Gazipur",
  farmSizeAcres: 1,
  soilType: "loam",
  waterAvailability: "irrigated",
  budgetBdt: 90000,
  targetSeason: "Rabi",
};

const BANGLA_TERMS = {
  Maize: "ভুট্টা",
  "Boro rice": "বোরো ধান",
  Potato: "আলু",
  Mustard: "সরিষা",
  low: "কম",
  medium: "মাঝারি",
  high: "বেশি",
  seed: "বীজ",
  seeds: "বীজ",
  fertilizer: "সার",
  irrigation: "সেচ",
  labor: "শ্রমিক",
  labour: "শ্রমিক",
  pesticide: "বালাইনাশক",
  harvest: "ফসল কাটা",
};

function localizedTerm(language, value) {
  const text = String(value ?? "");
  return language === "bn" ? (BANGLA_TERMS[text] || BANGLA_TERMS[text.toLowerCase()] || text) : text;
}

function localizedMessageText(language, value) {
  return [
    "How can I help you?",
    "Tell me about your farm. I will ask only for missing details.",
  ].includes(value)
    ? t(language, "greeting")
    : value;
}

function Money({ value }) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return <>—</>;
  return <>{new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(amount)}</>;
}

function wait(delayMs) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
}

function updateConversationRun(items, runId, update) {
  return items.map((item) => (
    item.run?.id === runId ? { ...item, run: update(item.run) } : item
  ));
}

function storedConversation(items = []) {
  return items.flatMap((item) => {
    if (item.role === "farmer" && item.text) return [{ role: "farmer", text: item.text }];
    if (item.role === "agent" && item.text) return [{ role: "agent", text: item.text }];
    if (item.role === "agent" && item.run?.status === "complete" && item.run.answer) {
      return [{ role: "agent", text: item.run.answer }];
    }
    return [];
  });
}

function MemoryPanel({
  connected,
  persistence,
  savedMemory,
  memoryInput,
  newMemoryId,
  autoAdjustIrrigation,
  busy,
  onInput,
  onCreate,
  onResume,
  onForget,
  onDismissRecovery,
  onAutoAdjust,
  language,
}) {
  return (
    <section className="panel memory-panel">
      <div className="section-heading">
        <div><span className="eyebrow">{t(language, "privateOptional")}</span><h2>{t(language, "savedMemory")}</h2></div>
        <span className={`memory-state ${connected ? "connected" : ""}`}>{connected ? t(language, "connected") : t(language, "notConnected")}</span>
      </div>
      <p>{t(language, "memoryIntro")}</p>
      {connected && persistence !== "postgresql" && (
        <p className="memory-warning">{t(language, "memoryWarning")}</p>
      )}
      {newMemoryId && (
        <aside className="recovery-code" role="status">
          <b>{t(language, "saveRecovery")}</b>
          <code>{newMemoryId}</code>
          <button type="button" onClick={onDismissRecovery}>{t(language, "savedIt")}</button>
        </aside>
      )}
      {!connected ? (
        <div className="memory-actions">
          <button type="button" disabled={busy} onClick={onCreate}>{t(language, "createMemory")}</button>
          <label htmlFor="memory-id">{t(language, "resumeMemory")}</label>
          <div>
            <input
              id="memory-id"
              name="memoryRecoveryCode"
              type="password"
              value={memoryInput}
              onChange={(event) => onInput(event.target.value)}
              placeholder="Paste farm_ recovery code…"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" disabled={busy || !memoryInput.trim()} onClick={onResume}>{t(language, "resume")}</button>
          </div>
        </div>
      ) : (
        <div className="connected-memory">
          <label>
            <input
              type="checkbox"
              name="autoAdjustIrrigation"
              checked={autoAdjustIrrigation}
              disabled={busy}
              onChange={(event) => onAutoAdjust(event.target.checked)}
            />
            {t(language, "autoAdjust")}
          </label>
          <details>
            <summary>{t(language, "viewMemory")}</summary>
            <dl>
              {Object.entries(savedMemory?.profile || {}).map(([name, value]) => (
                <div key={name}><dt>{name}</dt><dd>{String(value)}</dd></div>
              ))}
              <div><dt>{t(language, "chatSessions")}</dt><dd>{savedMemory?.sessions?.length ?? 0}</dd></div>
              {savedMemory?.conversationSummary && (
                <div><dt>{t(language, "compactContext")}</dt><dd>{savedMemory.conversationSummary}</dd></div>
              )}
              <div><dt>{t(language, "previousPlan")}</dt><dd>{savedMemory?.lastResult ? t(language, "available") : t(language, "notSaved")}</dd></div>
            </dl>
          </details>
          <button type="button" className="danger-quiet" disabled={busy} onClick={onForget}>{t(language, "forgetMemory")}</button>
        </div>
      )}
      <small>{t(language, "memoryPrivacy")}</small>
    </section>
  );
}

function Schedule({ items = [], language = "en" }) {
  if (!items.length) return null;
  return (
    <section className="panel" id="schedule">
      <div className="section-heading">
        <div><span className="eyebrow">{t(language, "inAppPlanning")}</span><h3>{t(language, "scheduler")}</h3></div>
        <span className="truth-pill assumption">{t(language, "noExternalDelivery")}</span>
      </div>
      <div className="schedule-grid">
        {items.map((item) => (
          <article key={item.id}>
            <div className="schedule-title">
              <strong>{localizedTerm(language, item.operation)}</strong>
              <span className={item.autoAdjusted ? "adjusted" : "planned"}>
                {item.autoAdjusted ? "Auto-adjusted" : "Planned"}
              </span>
            </div>
            <dl>
              <div><dt>{t(language, "date")}</dt><dd>{item.adjustedDate}</dd></div>
              {item.originalDate !== item.adjustedDate && <div><dt>{t(language, "original")}</dt><dd>{item.originalDate}</dd></div>}
              <div><dt>{t(language, "stage")}</dt><dd>{localizedTerm(language, item.growthStage)}</dd></div>
              <div><dt>{t(language, "estimatedCost")}</dt><dd><Money value={item.estimatedCostBdt} /></dd></div>
            {item.quantity !== null && <div><dt>{t(language, "evidenceQuantity")}</dt><dd>{item.quantity} {item.unit}</dd></div>}
            </dl>
            {item.quantityReason && <p className="quantity-reason"><b>{t(language, "quantityOmitted")}</b> {item.quantityReason}</p>}
            {item.adjustmentReason && <p className="schedule-reason">{item.adjustmentReason}</p>}
            {item.status === "REQUIRES_FARMER_CONFIRMATION" && (
              <p className="confirmation">{t(language, "confirmBeforeApply")}</p>
            )}
            <details className="schedule-evidence">
              <summary>{t(language, "evidenceSafety")}</summary>
              <p>{t(language, "advice")}: {item.adviceTruthLabel} · {t(language, "cost")}: {item.costTruthLabel}</p>
              <EvidenceGroupList
                records={item.evidence}
                emptyMessage={t(language, "noQuantityEvidence")}
              />
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [authState, setAuthState] = useState({ loading: true, authenticated: false, user: null });
  const [authMode, setAuthMode] = useState(null);
  const [language, setLanguage] = useState(loadLanguage);
  const [paymentStatus, setPaymentStatus] = useState({ state: "checking" });
  const [sessionId, setSessionId] = useState(() => loadOrCreateSessionId());
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState(createInitialConversation);
  const [result, setResult] = useState(null);
  const [candidateResult, setCandidateResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(loadThemePreference);
  const [memoryId, setMemoryId] = useState("");
  const [memoryInput, setMemoryInput] = useState("");
  const [newMemoryId, setNewMemoryId] = useState("");
  const [memoryPersistence, setMemoryPersistence] = useState("");
  const [savedMemory, setSavedMemory] = useState(null);
  const [autoAdjustIrrigation, setAutoAdjustIrrigation] = useState(true);
  const [planStartDate, setPlanStartDate] = useState("2026-11-01");
  const [revision, setRevision] = useState(createRevisionState);
  const [lastRequest, setLastRequest] = useState(null);
  const [marketMode, setMarketMode] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [voiceState, setVoiceState] = useState({
    status: "idle",
    userTranscript: "",
    assistantTranscript: "",
    assistantResponseId: "",
    error: "",
  });
  const requestController = useRef(null);
  const realtimeSessionRef = useRef(null);
  const realtimeAudioRef = useRef(null);
  const runSequence = useRef(0);
  const messagesRef = useRef(null);
  const keepMessagesPinnedRef = useRef(true);
  const transcriptInteractionRef = useRef(false);
  const best = useMemo(() => result?.crops?.[0], [result]);
  const planBudgetView = useMemo(
    () => derivePlanBudgetView(result, savedMemory?.profile, best),
    [result, savedMemory?.profile, best],
  );
  const conversationSessions = savedMemory?.sessions ?? [];
  const latestRun = useMemo(() => {
    for (let index = conversation.length - 1; index >= 0; index -= 1) {
      if (conversation[index].run) return conversation[index].run;
    }
    return null;
  }, [conversation]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    persistLanguage(language);
  }, [language]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : { authenticated: false })
      .then((data) => {
        if (data.authenticated) acceptAuthentication(data);
        else setAuthState({ loading: false, authenticated: false, user: null });
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setAuthState({ loading: false, authenticated: false, user: null });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!authState.authenticated) return undefined;
    const controller = new AbortController();
    setPaymentStatus({ state: "checking" });
    fetch("/api/payments/status", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Payment service unavailable");
        setPaymentStatus((current) => ({ ...data, access: current.access }));
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setPaymentStatus((current) => ({ available: false, access: current.access }));
        }
      });
    return () => controller.abort();
  }, [authState.authenticated]);

  useEffect(() => {
    const messages = messagesRef.current;
    if (messages && keepMessagesPinnedRef.current) {
      pinTranscript(messages);
    }
  }, [conversation]);

  useEffect(() => () => {
    realtimeSessionRef.current?.close();
    realtimeSessionRef.current = null;
    if (realtimeAudioRef.current) {
      realtimeAudioRef.current.pause();
      realtimeAudioRef.current.srcObject = null;
      realtimeAudioRef.current = null;
    }
  }, []);

  function markTranscriptInteraction() {
    transcriptInteractionRef.current = true;
  }

  function acceptAuthentication(data) {
    const memory = data.memory ?? null;
    setAuthState({ loading: false, authenticated: true, user: data.user });
    setAuthMode(null);
    setMemoryId(data.memoryId || "");
    setSavedMemory(memory);
    setMemoryPersistence(data.database || "postgresql");
    if (data.access) {
      setPaymentStatus((current) => ({ ...current, access: data.access }));
    }
    setAutoAdjustIrrigation(memory?.preferences?.autoAdjustIrrigation !== false);
    const latest = memory?.sessions?.at(-1);
    const restored = latest?.lastResult || memory?.lastResult || null;
    if (latest) {
      setSessionId(latest.id);
      persistSessionId(latest.id);
      setConversation(latest.messages?.length ? latest.messages : createInitialConversation());
      setResult(restored?.seasonPlan ? restored : null);
      setCandidateResult(restored?.candidates?.length === 4 ? restored : null);
    } else {
      setResult(restored?.seasonPlan ? restored : null);
      setCandidateResult(restored?.candidates?.length === 4 ? restored : null);
    }
  }

  async function logout() {
    requestController.current?.abort();
    realtimeSessionRef.current?.close();
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    setAuthState({ loading: false, authenticated: false, user: null });
    setMemoryId("");
    setSavedMemory(null);
    setResult(null);
    setCandidateResult(null);
    setConversation(createInitialConversation());
    setAuthMode(null);
  }

  const status = revision.readyToPlan
    ? {
        title: t(language, "planUpdateReady"),
        detail: t(language, "revisionSaved"),
      }
    : latestRun?.status === "running"
    ? {
        title: latestRun.events.at(-1)?.label || t(language, "requestInProgress"),
        detail: t(language, "progressInChat"),
      }
    : latestRun?.status === "failed"
      ? {
          title: t(language, "requestFailed"),
          detail: result ? t(language, "previousPlanVisible") : t(language, "noPlan"),
        }
      : latestRun?.status === "cancelled"
        ? {
            title: t(language, "requestCancelled"),
            detail: t(language, "cancelledInspect"),
          }
        : latestRun?.status === "complete"
          ? latestRun.outcome === "plan"
            ? {
                title: t(language, "planGenerated"),
                detail: result?.weather?.source || t(language, "weatherUnavailable"),
              }
            : {
                title: t(language, "detailsRequested"),
                detail: t(language, "detailsRequestedCopy"),
              }
        : error
          ? {
              title: t(language, "requestFailed"),
              detail: result ? t(language, "previousPlanVisible") : t(language, "noPlan"),
            }
          : result
            ? {
                title: t(language, "planGenerated"),
                detail: result?.weather?.source || t(language, "weatherUnavailable"),
              }
            : {
                title: t(language, "notStarted"),
                detail: t(language, "noLiveData"),
              };

  function changeTheme(nextTheme) {
    setTheme(persistThemePreference(nextTheme));
  }

  function focusCompletedRun(runId) {
    keepMessagesPinnedRef.current = false;
    globalThis.requestAnimationFrame?.(() => {
      const messages = messagesRef.current;
      const runElement = globalThis.document?.getElementById(`agent-run-${runId}`);
      focusTranscriptItem(messages, runElement?.closest(".message-row"));
    });
  }

  function focusLatestMessage() {
    keepMessagesPinnedRef.current = false;
    globalThis.requestAnimationFrame?.(() => {
      const messages = messagesRef.current;
      focusTranscriptItem(messages, messages?.querySelector?.(".message-row:last-child"));
    });
  }

  async function executeTier2({
    kind,
    query = "",
    requestedAttachment = attachment,
  }) {
    let endpoint;
    let body;
    let runKind;
    let farmerText;
    let farmerAttachment = null;
    try {
      if (kind === "disease_diagnosis") {
        if (!requestedAttachment?.dataUrl) throw new Error("Attach a leaf image first.");
        endpoint = "/api/tier2/disease";
        runKind = "disease_diagnosis";
        farmerText = query.trim() || "Check this leaf image for possible disease.";
        farmerAttachment = {
          dataUrl: requestedAttachment.dataUrl,
          name: requestedAttachment.name,
        };
        body = {
          imageDataUrl: requestedAttachment.dataUrl,
          crop: "",
          note: farmerText,
          responseLanguage: responseLanguageName(language),
        };
      } else {
        const activeProfile = result?.profile ?? savedMemory?.profile ?? {};
        body = buildMarketRequest({
          query,
          location: activeProfile.location,
          crop: "",
        });
        body.responseLanguage = responseLanguageName(language);
        endpoint = "/api/tier2/market";
        runKind = body.kind;
        farmerText = body.query;
      }
    } catch (requestError) {
      setError(requestError.message);
      return null;
    }

    const controller = new AbortController();
    const runId = `run-${Date.now()}-${++runSequence.current}`;
    const startedAt = Date.now();
    const startedTimestamp = new Date(startedAt).toISOString();
    const initialRun = appendRunEvent({
      ...createAgentRun({ id: runId, mode: "live", startedAt }),
      outcome: runKind === "disease_diagnosis" ? "diagnosis" : "market",
      tier2Request: { kind, query, requestedAttachment },
    }, createTier2StartEvent({ kind: runKind, timestamp: startedTimestamp }));
    requestController.current = { controller, runId, presenter: null };
    setConversation((items) => [
      ...items,
      {
        role: "farmer",
        text: farmerText,
        ...(farmerAttachment ? { attachment: farmerAttachment } : {}),
      },
      { role: "agent", run: initialRun },
    ]);
    setBusy(true);
    setError("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "AgriSense could not complete this Tier 2 request.");
      }
      const completedAt = Date.now();
      const completionEvents = createTier2CompletionEvents({
        kind: runKind,
        result: data,
        completedAt: new Date(completedAt).toISOString(),
        durationMs: completedAt - startedAt,
      });
      const answer = tier2ResultMarkdown(data);
      await wait(350);
      if (controller.signal.aborted) {
        const abortError = new Error("Request cancelled.");
        abortError.name = "AbortError";
        throw abortError;
      }
      setConversation((items) => updateConversationRun(items, runId, (currentRun) => {
        const progressed = completionEvents.reduce(
          (run, event) => appendRunEvent(run, event),
          currentRun,
        );
        return toggleRunCollapsed(completeAgentRun(progressed, {
          answer,
          reasoningSummaries: [],
          completedAt,
        }));
      }));
      if (runKind === "disease_diagnosis") setAttachment(null);
      if (kind !== "disease_diagnosis") setMarketMode(false);
      setMessage("");
      focusCompletedRun(runId);
      return answer;
    } catch (requestError) {
      const cancelled = requestError.name === "AbortError" || controller.signal.aborted;
      const failureMessage = cancelled
        ? "Request cancelled. You can retry when ready."
        : requestError.message;
      setConversation((items) => updateConversationRun(
        items,
        runId,
        (currentRun) => cancelled
          ? cancelAgentRun(currentRun, { completedAt: Date.now() })
          : failAgentRun(currentRun, { error: failureMessage, completedAt: Date.now() }),
      ));
      setError(failureMessage);
      return null;
    } finally {
      if (requestController.current?.controller === controller) requestController.current = null;
      setBusy(false);
    }
  }

  function retryAgentRun(run) {
    if (run?.tier2Request) {
      void executeTier2(run.tier2Request);
      return;
    }
    retryLastRequest();
  }

  async function selectLeafImage(file) {
    try {
      const nextAttachment = await readAttachment(file);
      setAttachment(nextAttachment);
      setMarketMode(false);
      setError("");
      if (!message.trim()) setMessage("What might be affecting this leaf?");
    } catch (attachmentError) {
      setError(attachmentError.message);
    }
  }

  function stopVoice() {
    realtimeSessionRef.current?.close();
    realtimeSessionRef.current = null;
    if (realtimeAudioRef.current) {
      realtimeAudioRef.current.pause();
      realtimeAudioRef.current.srcObject = null;
      realtimeAudioRef.current = null;
    }
    setVoiceState((current) => ({ ...current, status: "idle" }));
  }

  async function runVoiceHeavyTask(event) {
    setVoiceState((current) => ({
      ...current,
      assistantTranscript: "AgriSense is checking the evidence now.",
      error: "",
    }));
    const answer = isMarketIntelligenceRequest(event.task)
      ? await executeTier2({ kind: "market", query: event.task, requestedAttachment: null })
      : (await sendChat(event.task))?.assistant;
    try {
      realtimeSessionRef.current?.submitToolResult(
        event.callId,
        answer || "The heavy task could not complete. Ask the farmer to use typed chat or retry.",
      );
    } catch (voiceError) {
      setVoiceState((current) => ({
        ...current,
        error: voiceError.message,
      }));
    }
  }

  function handleRealtimeEvent(event) {
    if (event.type === "user_transcript") {
      setMessage(event.text);
      setVoiceState((current) => ({
        ...current,
        userTranscript: event.text,
        error: "",
      }));
      return;
    }
    if (event.type === "assistant_transcript") {
      setVoiceState((current) => {
        const transcript = applyAssistantTranscript({
          responseId: current.assistantResponseId,
          text: current.assistantTranscript,
        }, event);
        return {
          ...current,
          assistantTranscript: transcript.text,
          assistantResponseId: transcript.responseId,
        };
      });
      return;
    }
    if (event.type === "heavy_task") {
      void runVoiceHeavyTask(event);
      return;
    }
    if (event.type === "error") {
      setVoiceState((current) => ({ ...current, error: event.text }));
    }
  }

  async function startVoice() {
    setVoiceState({
      status: "connecting",
      userTranscript: "",
      assistantTranscript: "Connecting to AgriSense voice…",
      assistantResponseId: "",
      error: "",
    });
    try {
      const privateMemory = await ensurePrivateMemory(sessionId, conversation);
      const session = await startRealtimeSession({
        tokenRequest: {
          memoryId: privateMemory.memoryId,
          sessionId,
        },
        onEvent: handleRealtimeEvent,
        onRemoteStream: (stream) => {
          if (!stream) return;
          const audio = globalThis.document.createElement("audio");
          audio.autoplay = true;
          audio.srcObject = stream;
          realtimeAudioRef.current = audio;
          void audio.play().catch(() => {});
        },
      });
      realtimeSessionRef.current = session;
      setVoiceState((current) => ({
        ...current,
        status: "listening",
        assistantTranscript: "শুনছি—বাংলা বা English-এ বলুন।",
      }));
    } catch (voiceError) {
      stopVoice();
      setVoiceState((current) => ({
        ...current,
        status: "error",
        error: voiceError.message,
        assistantTranscript: "Voice is unavailable. Typed chat still works.",
      }));
    }
  }

  function toggleVoice() {
    if (voiceState.status === "connecting" || voiceState.status === "listening") {
      stopVoice();
    } else {
      void startVoice();
    }
  }

  async function send(payload, requestSessionId = sessionId, options = {}) {
    const requestMemoryId = Object.hasOwn(options, "memoryId") ? options.memoryId : memoryId;
    const mode = options.mode === "demo" ? "demo" : "live";
    const controller = new AbortController();
    const runId = `run-${Date.now()}-${++runSequence.current}`;
    const presenter = createRunPresenter({
      mode,
      reveal: (event) => {
        setConversation((items) => updateConversationRun(
          items,
          runId,
          (run) => appendRunEvent(run, event),
        ));
      },
    });
    requestController.current = { controller, presenter, runId };
    payload = {
      ...payload,
      ...(payload.message
        ? { message: redactRecoveryIds(payload.message, "[recovery code hidden]") }
        : {}),
    };
    setLastRequest({ payload, requestSessionId, options });
    const farmerMessage = payload.message?.trim();
    const run = createAgentRun({ id: runId, mode, startedAt: Date.now() });
    setConversation((items) => [
      ...items,
      ...(farmerMessage ? [{ role: "farmer", text: farmerMessage }] : []),
      { role: "agent", run: run },
    ]);
    setBusy(true);
    setError("");
    try {
      payload = {
        ...payload,
        preferences: { autoAdjustIrrigation },
        responseLanguage: responseLanguageName(language),
        ...(requestMemoryId
          ? { memoryId: requestMemoryId, memorySessionId: requestSessionId }
          : {}),
      };
      const response = await fetch("/api/session/message/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, sessionId: requestSessionId }),
        signal: controller.signal,
      });
      const data = await consumeNdjsonStream(response, (event) => {
        presenter.present(event);
      });
      await presenter.drain();
      await wait(350);
      if (controller.signal.aborted) {
        const abortError = new Error("Request cancelled.");
        abortError.name = "AbortError";
        throw abortError;
      }
      setConversation((items) => updateConversationRun(items, runId, (currentRun) => {
        const completedRun = completeAgentRun(currentRun, {
          answer: assistantText(data.assistant),
          reasoningSummaries: data.reasoningSummaries ?? [],
          completedAt: Date.now(),
        });
        return completedRun.status === "complete"
          ? toggleRunCollapsed({
              ...completedRun,
          outcome: data.seasonPlan ? "plan" : data.candidateSelectionRequired ? "selection" : "intake",
            })
          : completedRun;
      }));
      if (data.candidateSelectionRequired) {
        setCandidateResult(data);
        setResult(null);
        setConversation((items) => completePlanRevision(items).items);
        setRevision(createRevisionState());
      }
      if (data.seasonPlan) {
        setResult(data);
        if (data.candidates?.length === 4) setCandidateResult(data);
        setConversation((items) => completePlanRevision(items).items);
        setRevision(createRevisionState());
      }
      if (requestMemoryId && data.memory) setSavedMemory(data.memory);
      setMessage("");
      focusCompletedRun(runId);
    } catch (err) {
      presenter.cancel();
      const cancelled = err.name === "AbortError" || controller.signal.aborted;
      const message = cancelled
        ? "Request cancelled. You can retry when ready."
        : err.message;
      setConversation((items) => updateConversationRun(
        items,
        runId,
        (currentRun) => cancelled
          ? cancelAgentRun(currentRun, { completedAt: Date.now() })
          : failAgentRun(currentRun, { error: message, completedAt: Date.now() }),
      ));
      setError(message);
    } finally {
      if (requestController.current?.controller === controller) requestController.current = null;
      setBusy(false);
    }
  }

  async function sendChat(farmerMessage) {
    setBusy(true);
    setError("");
    try {
      const privateMemory = await ensurePrivateMemory(sessionId, conversation);
      const response = await fetch("/api/session/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          message: redactRecoveryIds(farmerMessage, "[recovery code hidden]"),
          pendingField: revision.pendingField,
          awaitingField: revision.awaitingField,
          sessionId,
          memoryId: privateMemory.memoryId,
          memorySessionId: sessionId,
          responseLanguage: responseLanguageName(language),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AgriSense could not continue the conversation.");
      const next = appendChatTurn(conversation, farmerMessage, data, revision);
      setConversation(next.items);
      setRevision(next.revision);
      if (data.memory) setSavedMemory(data.memory);
      setMessage("");
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function submit(event) {
    event.preventDefault();
    if (attachment) {
      void executeTier2({
        kind: "disease_diagnosis",
        query: message.trim(),
        requestedAttachment: attachment,
      });
    } else if ((marketMode || isMarketIntelligenceRequest(message.trim())) && message.trim()) {
      void executeTier2({ kind: "market", query: message.trim(), requestedAttachment: null });
    } else if (message.trim()) {
      void sendChat(message.trim());
    }
  }

  async function runDemo() {
    const fresh = createFreshDemoState();
    persistSessionId(fresh.sessionId);
    setSessionId(fresh.sessionId);
    setMessage(fresh.message);
    setConversation(fresh.conversation);
    setResult(fresh.result);
    setCandidateResult(null);
    setRevision(createRevisionState());
    setError(fresh.error);
    try {
      const privateMemory = await ensurePrivateMemory(fresh.sessionId, fresh.conversation);
      await send(
        { action: "analyze", profilePatch: DEMO_PROFILE, startDate: planStartDate },
        fresh.sessionId,
        { memoryId: privateMemory.memoryId, mode: "demo" },
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function registerConversation(privateMemoryId, requestSessionId, items) {
    const response = await fetch("/api/memory/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memoryId: privateMemoryId,
        session: {
          id: requestSessionId,
          title: "New conversation",
          messages: storedConversation(items),
        },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not save the conversation.");
    setSavedMemory(data.memory);
    setMemoryPersistence(data.database);
    return data.memory;
  }

  async function ensurePrivateMemory(requestSessionId = sessionId, items = conversation) {
    let privateMemoryId = memoryId;
    let privateMemory = savedMemory;
    if (!privateMemoryId) {
      const response = await fetch("/api/memory/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: requestSessionId,
          preferences: { autoAdjustIrrigation },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create farm memory.");
      privateMemoryId = data.memoryId;
      privateMemory = data.memory;
      setMemoryId(data.memoryId);
      setNewMemoryId(data.memoryId);
      setMemoryInput("");
      setMemoryPersistence(data.database);
      setSavedMemory(data.memory);
    }
    if (!privateMemory?.sessions?.some((item) => item.id === requestSessionId)) {
      privateMemory = await registerConversation(privateMemoryId, requestSessionId, items);
    }
    return { memoryId: privateMemoryId, memory: privateMemory };
  }

  async function createMemory() {
    setBusy(true);
    setError("");
    try {
      await ensurePrivateMemory();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function newConversation() {
    setBusy(true);
    setError("");
    try {
      const privateMemory = await ensurePrivateMemory(sessionId, conversation);
      const nextSessionId = createSessionId();
      const nextConversation = createInitialConversation();
      await registerConversation(
        privateMemory.memoryId,
        nextSessionId,
        nextConversation,
      );
      persistSessionId(nextSessionId);
      setSessionId(nextSessionId);
      setConversation(nextConversation);
      setResult(null);
      setCandidateResult(null);
      setRevision(createRevisionState());
      setMessage("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchConversation(session) {
    if (busy || !session?.id) return;
    const restoredConversation = session.messages?.length
      ? session.messages
      : createInitialConversation();
    persistSessionId(session.id);
    setSessionId(session.id);
    setConversation(restoredConversation);
    setResult(session.lastResult?.seasonPlan ? session.lastResult : null);
    setCandidateResult(session.lastResult?.candidates?.length === 4 ? session.lastResult : null);
    setRevision(createRevisionState());
    setMessage("");
    setError("");
    focusLatestMessage();
  }

  async function createUpdatedPlan() {
    setBusy(true);
    setError("");
    try {
      const privateMemory = await ensurePrivateMemory();
      setBusy(false);
      await send(
        { action: "analyze", startDate: planStartDate },
        sessionId,
        { memoryId: privateMemory.memoryId },
      );
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function resumeMemory() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/memory/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryId: memoryInput.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not resume farm memory.");
      const fresh = createFreshDemoState();
      persistSessionId(fresh.sessionId);
      setSessionId(fresh.sessionId);
      setMemoryId(memoryInput.trim());
      setMemoryInput("");
      setMemoryPersistence(data.database);
      let resumedMemory = data.memory;
      setAutoAdjustIrrigation(data.memory.preferences?.autoAdjustIrrigation !== false);
      let activeSession = [...(resumedMemory.sessions || [])].sort((left, right) =>
        String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
      )[0];
      if (!activeSession) {
        resumedMemory = await registerConversation(
          memoryInput.trim(),
          fresh.sessionId,
          fresh.conversation,
        );
        activeSession = resumedMemory.sessions.find((item) => item.id === fresh.sessionId);
      }
      setSavedMemory(resumedMemory);
      const restoredSessionId = activeSession?.id || fresh.sessionId;
      persistSessionId(restoredSessionId);
      setSessionId(restoredSessionId);
      setConversation(activeSession?.messages?.length
        ? activeSession.messages
        : fresh.conversation);
      setRevision(createRevisionState());
      setResult(activeSession?.lastResult?.seasonPlan ? activeSession.lastResult : null);
      setCandidateResult(activeSession?.lastResult?.candidates?.length === 4 ? activeSession.lastResult : null);
      focusLatestMessage();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function forgetMemory() {
    if (!globalThis.confirm?.("Forget this saved farm memory and every linked chat? This cannot be undone.")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/memory/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not forget farm memory.");
      setMemoryId("");
      setNewMemoryId("");
      setMemoryPersistence("");
      setSavedMemory(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function cancelRequest() {
    requestController.current?.presenter?.cancel();
    requestController.current?.controller.abort();
  }

  async function chooseCrop(crop) {
    setBusy(true);
    setError("");
    try {
      const privateMemory = await ensurePrivateMemory();
      setBusy(false);
      await send(
        {
          action: "plan",
          selectedCropId: crop.id,
          startDate: planStartDate,
          message: language === "bn" ? `${crop.name} ফসলটি বেছে নিলাম` : `I choose ${crop.name}`,
        },
        sessionId,
        { memoryId: privateMemory.memoryId },
      );
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function retryLastRequest() {
    if (!lastRequest) return;
    void send(lastRequest.payload, lastRequest.requestSessionId, lastRequest.options);
  }

  async function updateAutoAdjust(value) {
    const previous = autoAdjustIrrigation;
    setAutoAdjustIrrigation(value);
    if (!memoryId) return;
    try {
      const response = await fetch("/api/memory/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memoryId,
          preferences: { autoAdjustIrrigation: value },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save memory preference.");
      setSavedMemory(data.memory);
      setMemoryPersistence(data.database);
    } catch (err) {
      setAutoAdjustIrrigation(previous);
      setError(err.message);
    }
  }

  if (authState.loading) {
    return <main className="auth-loading"><span className="brand-icon" aria-hidden="true">A</span><p>{t(language, "loadingWorkspace")}</p></main>;
  }

  if (!authState.authenticated) {
    return (
      <>
        <LandingPage onSignup={() => setAuthMode("signup")} onLogin={() => setAuthMode("login")} language={language} onLanguage={setLanguage} />
        <AuthDialog mode={authMode} onClose={() => setAuthMode(null)} onAuthenticated={acceptAuthentication} language={language} />
      </>
    );
  }

  return (
    <main aria-busy={busy}>
      {!authState.user?.passwordConfigured && (
        <AuthDialog
          mode="setup"
          onClose={() => {}}
          onAuthenticated={acceptAuthentication}
          existingAuth={{
            authenticated: true,
            user: authState.user,
            memoryId,
            memory: savedMemory,
            database: memoryPersistence,
          }}
          language={language}
        />
      )}
      <a className="skip-link" href="#advisor">{t(language, "skipConversation")}</a>
      <header>
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">🌱</span>
          <div><span className="eyebrow">Rookie Coders · {t(language, "farmerIntelligence")}</span><h1>Agri<span>Sense</span></h1></div>
        </div>
        <div className="header-actions">
          <LanguageControl language={language} onChange={setLanguage} />
          <div className="theme-control" role="group" aria-label={t(language, "colorTheme")}>
            {[
              { value: "system", label: t(language, "systemTheme") },
              { value: "light", label: t(language, "lightTheme") },
              { value: "dark", label: t(language, "darkTheme") },
            ].map((option) => (
              <button
                type="button"
                key={option.value}
                aria-pressed={theme === option.value}
                onClick={() => changeTheme(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" className="demo" disabled={busy} onClick={() => void runDemo()}>{t(language, "demo")}</button>
          <div className="account-pill" aria-label={`${t(language, "signedInEnding")} ${authState.user?.mobileLast4}`}>
            <span>••{authState.user?.mobileLast4}</span>
            <button type="button" onClick={() => void logout()}>{t(language, "logout")}</button>
          </div>
        </div>
      </header>

      <nav className="workflow-tabs" aria-label={t(language, "inAppPlanning")}>
        <a href="#advisor"><span>1</span>{t(language, "navFarmAdvisor")}</a>
        <a
          href={latestRun ? `#agent-run-${latestRun.id}` : undefined}
          aria-disabled={!latestRun}
          tabIndex={latestRun ? undefined : -1}
        >
          <span>2</span>{t(language, "navAgentActivity")}
        </a>
        <a href={result ? "#ranking" : undefined} aria-disabled={!result} tabIndex={result ? undefined : -1}><span>3</span>{t(language, "navCropRanking")}</a>
        <a href={result ? "#schedule" : undefined} aria-disabled={!result} tabIndex={result ? undefined : -1}><span>4</span>{t(language, "navInputSchedule")}</a>
        <a href={result ? "#roadmap" : undefined} aria-disabled={!result} tabIndex={result ? undefined : -1}><span>5</span>{t(language, "navSeasonRoadmap")}</a>
        <a href={result ? "#evidence" : undefined} aria-disabled={!result} tabIndex={result ? undefined : -1}><span>6</span>{t(language, "navEvidenceTrace")}</a>
      </nav>

      <div className="conversation-workspace" id="advisor">
        <ConversationSidebar
          language={language}
          sessions={conversationSessions}
          activeSessionId={sessionId}
          connected={Boolean(memoryId)}
          busy={busy}
          onNew={() => void newConversation()}
          onSelect={switchConversation}
        />
        <section className="panel chat">
          <div className="chat-heading">
            <div><span className="eyebrow">{t(language, "advisor")}</span><h2>{t(language, "conversation")}</h2></div>
            <div className="conversation-state status" role="status" aria-live="polite" aria-atomic="true">
              <b>{busy ? t(language, "workingStatus") : status.title}</b>
              <span>{status.detail}</span>
            </div>
          </div>
          {revision.planStale && (
            <p className="stale-plan-notice" role="status">{t(language, "stalePlan")}</p>
          )}
          <div
            className="messages"
            data-short={conversation.length <= 1}
            ref={messagesRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            onWheel={markTranscriptInteraction}
            onTouchStart={markTranscriptInteraction}
            onPointerDown={markTranscriptInteraction}
            onScroll={() => {
              const messages = messagesRef.current;
              if (!messages || !transcriptInteractionRef.current) return;
              keepMessagesPinnedRef.current = isNearTranscriptBottom(messages);
            }}
          >
            {conversation.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`message-row ${item.role}${item.run ? " has-run" : ""}`}>
                <span className="message-avatar" aria-hidden="true">
                  {item.role === "agent" ? "A" : "F"}
                </span>
                <div className="message-body">
                  <b>{item.role === "agent" ? "AgriSense" : t(language, "farmer")}</b>
                  {item.run ? (
                    <AgentRunMessage
                      language={language}
                      run={item.run}
                      onToggle={(nextRun) => setConversation((items) => updateConversationRun(
                        items,
                        item.run.id,
                        () => nextRun,
                      ))}
                      onCancel={cancelRequest}
                      onRetry={() => retryAgentRun(item.run)}
                      retryAvailable={item.run.id === latestRun?.id}
                    />
                  ) : item.role === "agent" ? (
                    <>
                      <Markdown>{localizedMessageText(language, item.text)}</Markdown>
                      <PlanRevisionCard
                        language={language}
                        revision={item.revision}
                        canCreate={canCreatePlanFrom(conversation, index)}
                        busy={busy}
                        onCreatePlan={() => void createUpdatedPlan()}
                      />
                    </>
                  ) : (
                    <>
                      <p>{localizedMessageText(language, item.text)}</p>
                      {item.attachment?.dataUrl && (
                        <figure className="tier2-message-image">
                          <img src={item.attachment.dataUrl} alt="Attached leaf preview" />
                          <figcaption>{item.attachment.name || "Leaf image"}</figcaption>
                        </figure>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {candidateResult?.candidates?.length === 4 && (
              <div className="message-row agent candidate-message">
                <span className="message-avatar" aria-hidden="true">A</span>
                <div className="message-body">
                  <b>AgriSense</b>
                  <CropCandidateSelector
                    candidates={candidateResult.candidates}
                    profile={candidateResult.profile || savedMemory?.profile || {}}
                    selectedCropId={candidateResult.selectedCropId || ""}
                    busy={busy}
                    language={language}
                    onSelect={(crop) => void chooseCrop(crop)}
                  />
                </div>
              </div>
            )}
          </div>
          <form className="chat-composer" onSubmit={submit} aria-label="Farm context message">
            <Tier2ComposerTools
              disabled={busy}
              marketMode={marketMode}
              attachment={attachment}
              voiceStatus={voiceState.status}
              language={language}
              onMarketToggle={() => {
                setMarketMode((current) => !current);
                setAttachment(null);
                setError("");
              }}
              onFile={(file) => void selectLeafImage(file)}
              onVoiceToggle={toggleVoice}
            />
            {attachment && (
              <div className="tier2-attachment-preview">
                <img src={attachment.dataUrl} alt="Attached leaf preview" />
                <span>
                  <b>{attachment.name}</b>
                  <small>{Math.ceil(attachment.size / 1024)} KB · {t(language, "assessmentReady")}</small>
                </span>
                <button
                  type="button"
                  aria-label="Remove attached leaf"
                  onClick={() => setAttachment(null)}
                >
                  {t(language, "remove")}
                </button>
              </div>
            )}
            {(voiceState.status !== "idle" || voiceState.error) && (
              <div className={`voice-transcript ${voiceState.status}`} role="status" aria-live="polite">
                <span aria-hidden="true" />
                <div>
                  <b>
                    {voiceState.status === "listening"
                      ? t(language, "voiceListening")
                      : voiceState.status === "connecting"
                        ? t(language, "voiceConnecting")
                        : t(language, "voiceFallback")}
                  </b>
                  <p>{voiceState.assistantTranscript}</p>
                  {voiceState.userTranscript && (
                    <small>{t(language, "heardEdit")} “{voiceState.userTranscript}”</small>
                  )}
                  {voiceState.error && <small className="error">{voiceState.error}</small>}
                </div>
              </div>
            )}
            <div className="composer-input-row">
            <label className="sr-only" htmlFor="farm-message">{t(language, "describeFarm")}</label>
            <textarea
              id="farm-message"
              name="farmMessage"
              rows={1}
              value={message}
              autoComplete="off"
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={
                attachment
                  ? t(language, "imagePlaceholder")
                  : marketMode
                    ? t(language, "marketPlaceholder")
                    : t(language, "placeholder")
              }
              disabled={busy}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "request-error" : undefined}
            />
            <button type="submit" disabled={busy || !message.trim()}>
              {busy ? t(language, "working") : attachment ? t(language, "assess") : marketMode ? t(language, "search") : t(language, "send")}
            </button>
            </div>
          </form>
          <label className="date-control" htmlFor="plan-start-date">
            {t(language, "planStartDate")}
            <input
              id="plan-start-date"
              name="planStartDate"
              type="date"
              value={planStartDate}
              onChange={(event) => setPlanStartDate(event.target.value)}
              disabled={busy}
            />
          </label>
          <div className="prompt-chips" aria-label="Example farm descriptions">
            {[t(language, "exampleFarm"), t(language, "exampleBudget"), t(language, "exampleSeason")].map((example) => (
              <button type="button" key={example} disabled={busy} onClick={() => setMessage(example)}>{example}</button>
            ))}
          </div>
          {error && <p id="request-error" className="error" role="alert">{error}</p>}
        </section>

        <div className="side-stack">
          <MemoryPanel
            language={language}
            connected={Boolean(memoryId)}
            persistence={memoryPersistence}
            savedMemory={savedMemory}
            memoryInput={memoryInput}
            newMemoryId={newMemoryId}
            autoAdjustIrrigation={autoAdjustIrrigation}
            busy={busy}
            onInput={setMemoryInput}
            onCreate={() => void createMemory()}
            onResume={() => void resumeMemory()}
            onForget={() => void forgetMemory()}
            onDismissRecovery={() => setNewMemoryId("")}
            onAutoAdjust={(value) => void updateAutoAdjust(value)}
          />
          <PaymentGatewayCard
            status={paymentStatus}
            language={language}
          />
          <section className="panel summary">
            <h2>{t(language, "recommendation")}</h2>
            {!best ? <p className="muted">{t(language, "completeIntake")}</p> : (
              <>
                <div className="best"><span>{t(language, "bestFit")}</span><strong>{localizedTerm(language, best.name)}</strong><em>{best.suitability}% {t(language, "suitability")} · {localizedTerm(language, best.riskLevel)} {t(language, "risk")}</em></div>
                <p className="assumption-label"><b>{t(language, "financialBasis")}</b> {t(language, "financialBasisCopy")}</p>
                <dl>
                  <div><dt>{t(language, "rain7Day")}</dt><dd>{result.weather.precipitationMm.toFixed(1)} mm</dd></div>
                  <div><dt>{t(language, "meanTemperature")}</dt><dd>{result.weather.meanTemperatureC.toFixed(1)}°C</dd></div>
                  <div><dt>{t(language, "zoningScore")}</dt><dd>{best.scoreComponents.ragSuitability ?? t(language, "unavailable")}</dd></div>
                  <div><dt>{t(language, "itemizedCost")}</dt><dd><ul>{Object.entries(best.financials.costBreakdownBdt).map(([name, value]) => <li key={name}>{localizedTerm(language, name)}: <Money value={value} /></li>)}</ul></dd></div>
                  <div><dt>{t(language, "totalCost")}</dt><dd><Money value={best.financials.totalCostBdt} /></dd></div>
                  <div><dt>{t(language, "expectedYield")}</dt><dd>{best.financials.expectedYieldKg.toFixed(0)} kg · <Money value={best.financials.pricePerKgBdt} /> {t(language, "perKg")}</dd></div>
                  <div><dt>{t(language, "expectedRevenue")}</dt><dd><Money value={best.financials.revenueBdt} /></dd></div>
                  <div><dt>{t(language, "netProfit")}</dt><dd><Money value={best.financials.netProfitBdt} /></dd></div>
                  <div><dt>ROI</dt><dd>{best.financials.roiPercent}%</dd></div>
                  <div><dt>{t(language, "breakEvenYield")}</dt><dd>{best.financials.breakEvenYieldKg.toFixed(0)} kg</dd></div>
                </dl>
              </>
            )}
          </section>
        </div>
      </div>

      {result && (
        <>
          <section className="panel result-summary" aria-labelledby="selected-plan-title">
            <div className="section-heading">
              <div><span className="eyebrow">{language === "bn" ? "নির্বাচিত পূর্ণ পরিকল্পনা" : "Selected full plan"}</span><h2 id="selected-plan-title">{localizedTerm(language, best.name)}</h2></div>
              <span className="truth-pill retrieved">{best.suitability}% {t(language, "suitability")}</span>
            </div>
            <div className="budget-integrity" role="status">
              <div><span>{language === "bn" ? "সংরক্ষিত বাজেট" : "Saved budget"}</span><strong><Money value={planBudgetView.budgetBdt} /></strong></div>
              <div><span>{language === "bn" ? "পরিকল্পিত জমি" : "Planned area"}</span><strong>{planBudgetView.plannedAreaAcres} {language === "bn" ? "একর" : "acres"}</strong><small>{language === "bn" ? `মোট জমি ${planBudgetView.farmSizeAcres} একর` : `of ${planBudgetView.farmSizeAcres} farm acres`}</small></div>
              <div><span>{language === "bn" ? "পরিকল্পিত খরচ" : "Planned cost"}</span><strong><Money value={planBudgetView.plannedCostBdt} /></strong></div>
              <div><span>{language === "bn" ? "বাজেট অবশিষ্ট" : "Budget remaining"}</span><strong><Money value={planBudgetView.budgetRemainingBdt} /></strong></div>
            </div>
            <p className="assumption-label"><b>{t(language, "financialBasis")}</b> {t(language, "financialBasisCopy")}</p>
          </section>
          <Schedule items={result.inputSchedule} language={language} />
          <section className="panel" id="ranking">
            <h3>{t(language, "rankedCrops")}</h3>
            <div className="cards">
              {result.crops.map((crop, index) => (
                <article key={crop.id}>
                  <span>#{index + 1}</span><h4>{localizedTerm(language, crop.name)}</h4><b>{crop.suitability}%</b>
                  <div className="score-bar"><i style={{ width: `${crop.suitability}%` }} /></div>
                  <p>{crop.waterNeed} water · {crop.riskLevel} risk</p>
                  <small>{t(language, "profitEstimate")}: <Money value={crop.roughProfitBdt} /></small>
                  <small>{crop.sources.length} zoning source record(s)</small>
                  <details>
                    <summary>{t(language, "whyScore")}</summary>
                    <p>Weather {crop.scoreComponents.weatherRain + crop.scoreComponents.weatherTemperature} · RAG {crop.scoreComponents.ragSuitability ?? t(language, "unavailable")} · water penalty {crop.scoreComponents.waterPenalty} · budget penalty {crop.scoreComponents.budgetPenalty}</p>
                  </details>
                </article>
              ))}
            </div>
          </section>
          <section className="panel" id="roadmap">
            <h3>{t(language, "datedCheckpoints")}</h3>
            <p className="muted">{t(language, "checkpointCopy")}</p>
            <div className="timeline">
              {result.seasonPlan.map((item) => (
                <article key={item.stage}>
                  <time>{item.date}</time><b>{item.stage.replaceAll("_", " ")}</b>
                  <small className={item.truthLabel === "RETRIEVED_EVIDENCE" ? "truth-pill retrieved" : "truth-pill assumption"}>
                    {item.truthLabel === "RETRIEVED_EVIDENCE" ? "Retrieved evidence" : "Team assumption"}
                  </small>
                  <p>{item.action}</p>
                  {item.evidence?.[0] && <a href={item.evidence[0].url} target="_blank" rel="noreferrer">{item.evidence[0].publisher || item.evidence[0].title}</a>}
                </article>
              ))}
            </div>
          </section>
          <div className="layout" id="evidence">
            <section className="panel">
              <h3>{t(language, "retrievedKnowledge")}</h3>
              <p className="muted">{result.rag.totalIndexed} {t(language, "indexedFacts")} {result.rag.datasetCount} {t(language, "datasets")}.</p>
              <EvidenceGroupList records={result.knowledge} />
            </section>
            <section className="panel">
              <h3>{t(language, "visibleTrace")}</h3>
              <details>
                <summary>{result.trace.length} {t(language, "recordedOperations")}</summary>
                <pre>{JSON.stringify(result.trace, null, 2)}</pre>
              </details>
            </section>
          </div>
        </>
      )}
      <footer>AgriSense Tier 2 · Mobile-bound memory, live market research, plant-image assessment, and Bangla voice. <a href="/evaluation.html">Open the self-test.</a></footer>
      <VoiceOrb
        open={voiceState.status === "connecting" || voiceState.status === "listening"}
        status={voiceState.status}
        transcript={voiceState.assistantTranscript || voiceState.userTranscript}
        onClose={toggleVoice}
        language={language}
      />
    </main>
  );
}
