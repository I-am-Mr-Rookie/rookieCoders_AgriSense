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
import ConversationSidebar from "./components/ConversationSidebar.jsx";
import EvidenceGroupList from "./components/EvidenceGroupList.jsx";
import Markdown from "./components/Markdown.jsx";
import { PlanRevisionCard } from "./components/PlanRevisionCard.jsx";
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
import { createRunPresenter } from "./run-presenter.js";
import { consumeNdjsonStream } from "./stream.js";
import { applyTheme, loadThemePreference, persistThemePreference } from "./theme.js";

const DEMO_PROFILE = {
  location: "Gazipur",
  farmSizeAcres: 1,
  soilType: "loam",
  waterAvailability: "irrigated",
  budgetBdt: 90000,
  targetSeason: "Rabi",
};

function Money({ value }) {
  return <>{new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(value)}</>;
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
}) {
  return (
    <section className="panel memory-panel">
      <div className="section-heading">
        <div><span className="eyebrow">Private and optional</span><h2>Saved farm memory</h2></div>
        <span className={`memory-state ${connected ? "connected" : ""}`}>{connected ? "Connected" : "Not connected"}</span>
      </div>
      <p>Carry farm size, budget, preferences, and the last plan into a later visit with one recovery code.</p>
      {connected && persistence !== "postgresql" && (
        <p className="memory-warning">Process-memory mode: saved memory lasts only until this server restarts.</p>
      )}
      {newMemoryId && (
        <aside className="recovery-code" role="status">
          <b>Save this recovery code now. It is shown only once.</b>
          <code>{newMemoryId}</code>
          <button type="button" onClick={onDismissRecovery}>I saved it</button>
        </aside>
      )}
      {!connected ? (
        <div className="memory-actions">
          <button type="button" disabled={busy} onClick={onCreate}>Create private memory</button>
          <label htmlFor="memory-id">Resume memory</label>
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
            <button type="button" disabled={busy || !memoryInput.trim()} onClick={onResume}>Resume</button>
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
            Auto-adjust irrigation when forecast rain conflicts
          </label>
          <details>
            <summary>View saved memory</summary>
            <dl>
              {Object.entries(savedMemory?.profile || {}).map(([name, value]) => (
                <div key={name}><dt>{name}</dt><dd>{String(value)}</dd></div>
              ))}
              <div><dt>Chat sessions</dt><dd>{savedMemory?.sessions?.length ?? 0}</dd></div>
              {savedMemory?.conversationSummary && (
                <div><dt>Compact agent context</dt><dd>{savedMemory.conversationSummary}</dd></div>
              )}
              <div><dt>Previous plan</dt><dd>{savedMemory?.lastResult ? "Available" : "Not saved yet"}</dd></div>
            </dl>
          </details>
          <button type="button" className="danger-quiet" disabled={busy} onClick={onForget}>Forget memory</button>
        </div>
      )}
      <small>AgriSense never places the recovery code inside agent activity or model context.</small>
    </section>
  );
}

function Schedule({ items = [] }) {
  if (!items.length) return null;
  return (
    <section className="panel" id="schedule">
      <div className="section-heading">
        <div><span className="eyebrow">In-app planning</span><h3>Fertilizer & irrigation scheduler</h3></div>
        <span className="truth-pill assumption">No external delivery</span>
      </div>
      <div className="schedule-grid">
        {items.map((item) => (
          <article key={item.id}>
            <div className="schedule-title">
              <strong>{item.operation}</strong>
              <span className={item.autoAdjusted ? "adjusted" : "planned"}>
                {item.autoAdjusted ? "Auto-adjusted" : "Planned"}
              </span>
            </div>
            <dl>
              <div><dt>Date</dt><dd>{item.adjustedDate}</dd></div>
              {item.originalDate !== item.adjustedDate && <div><dt>Original</dt><dd>{item.originalDate}</dd></div>}
              <div><dt>Stage</dt><dd>{item.growthStage}</dd></div>
              <div><dt>Estimated cost</dt><dd><Money value={item.estimatedCostBdt} /></dd></div>
            {item.quantity !== null && <div><dt>Evidence-based quantity</dt><dd>{item.quantity} {item.unit}</dd></div>}
            </dl>
            {item.quantityReason && <p className="quantity-reason"><b>Quantity omitted:</b> {item.quantityReason}</p>}
            {item.adjustmentReason && <p className="schedule-reason">{item.adjustmentReason}</p>}
            {item.status === "REQUIRES_FARMER_CONFIRMATION" && (
              <p className="confirmation">Farmer confirmation required before application.</p>
            )}
            <details className="schedule-evidence">
              <summary>Evidence & safety details</summary>
              <p>Advice: {item.adviceTruthLabel} · Cost: {item.costTruthLabel}</p>
              <EvidenceGroupList
                records={item.evidence}
                emptyMessage="No direct quantity evidence is attached."
              />
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [sessionId, setSessionId] = useState(() => loadOrCreateSessionId());
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState(createInitialConversation);
  const [result, setResult] = useState(null);
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
  const requestController = useRef(null);
  const runSequence = useRef(0);
  const messagesRef = useRef(null);
  const keepMessagesPinnedRef = useRef(true);
  const transcriptInteractionRef = useRef(false);
  const best = useMemo(() => result?.crops?.[0], [result]);
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
    const messages = messagesRef.current;
    if (messages && keepMessagesPinnedRef.current) {
      pinTranscript(messages);
    }
  }, [conversation]);

  function markTranscriptInteraction() {
    transcriptInteractionRef.current = true;
  }

  const status = revision.readyToPlan
    ? {
        title: "Plan update ready",
        detail: "Create the updated plan when your farm changes are complete.",
      }
    : latestRun?.status === "running"
    ? {
        title: latestRun.events.at(-1)?.label || "Request in progress",
        detail: "Verified progress appears inside the current AgriSense message.",
      }
    : latestRun?.status === "failed"
      ? {
          title: "Request failed",
          detail: result ? "The previous plan remains visible." : "No plan was generated.",
        }
      : latestRun?.status === "cancelled"
        ? {
            title: "Request cancelled",
            detail: "The stopped run remains available to inspect or retry.",
          }
        : latestRun?.status === "complete"
          ? latestRun.outcome === "plan"
            ? {
                title: "Plan generated",
                detail: result?.weather?.source || "Weather source unavailable",
              }
            : {
                title: "Farm details requested",
                detail: "Answer the requested fields to continue planning.",
              }
        : error
          ? {
              title: "Request failed",
              detail: result ? "The previous plan remains visible." : "No plan was generated.",
            }
          : result
            ? {
                title: "Plan generated",
                detail: result?.weather?.source || "Weather source unavailable",
              }
            : {
                title: "Not started",
                detail: "No live data has been requested yet.",
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
              outcome: data.crops ? "plan" : "intake",
            })
          : completedRun;
      }));
      if (data.crops) {
        setResult(data);
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
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AgriSense could not continue the conversation.");
      const next = appendChatTurn(conversation, farmerMessage, data, revision);
      setConversation(next.items);
      setRevision(next.revision);
      if (data.memory) setSavedMemory(data.memory);
      setMessage("");
    } catch (err) {
      setError(err.message);
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
    if (message.trim()) void sendChat(message.trim());
  }

  async function runDemo() {
    const fresh = createFreshDemoState();
    persistSessionId(fresh.sessionId);
    setSessionId(fresh.sessionId);
    setMessage(fresh.message);
    setConversation(fresh.conversation);
    setResult(fresh.result);
    setRevision(createRevisionState());
    setError(fresh.error);
    try {
      const privateMemory = await ensurePrivateMemory(fresh.sessionId, fresh.conversation);
      await send(
        { action: "plan", profilePatch: DEMO_PROFILE, startDate: planStartDate },
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
    setResult(session.lastResult ?? null);
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
        { action: "plan", startDate: planStartDate },
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
      setResult(activeSession?.lastResult ?? null);
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
    requestController.current?.presenter.cancel();
    requestController.current?.controller.abort();
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

  return (
    <main aria-busy={busy}>
      <a className="skip-link" href="#advisor">Skip to conversation</a>
      <header>
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">🌱</span>
          <div><span className="eyebrow">Rookie Coders · Tier 1</span><h1>Agri<span>Sense</span></h1></div>
        </div>
        <div className="header-actions">
          <div className="theme-control" role="group" aria-label="Color theme">
            {[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
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
          <button type="button" className="demo" disabled={busy} onClick={() => void runDemo()}>Demo Gazipur</button>
        </div>
      </header>

      <nav className="workflow-tabs" aria-label="Planning workspace">
        <a href="#advisor"><span>1</span>Farm advisor</a>
        <a
          href={latestRun ? `#agent-run-${latestRun.id}` : undefined}
          aria-disabled={!latestRun}
          tabIndex={latestRun ? undefined : -1}
        >
          <span>2</span>Agent activity
        </a>
        <a href={result ? "#ranking" : undefined} aria-disabled={!result} tabIndex={result ? undefined : -1}><span>3</span>Crop ranking</a>
        <a href={result ? "#schedule" : undefined} aria-disabled={!result} tabIndex={result ? undefined : -1}><span>4</span>Input schedule</a>
        <a href={result ? "#roadmap" : undefined} aria-disabled={!result} tabIndex={result ? undefined : -1}><span>5</span>Season roadmap</a>
        <a href={result ? "#evidence" : undefined} aria-disabled={!result} tabIndex={result ? undefined : -1}><span>6</span>Evidence & trace</a>
      </nav>

      <div className="conversation-workspace" id="advisor">
        <ConversationSidebar
          sessions={conversationSessions}
          activeSessionId={sessionId}
          connected={Boolean(memoryId)}
          busy={busy}
          onNew={() => void newConversation()}
          onSelect={switchConversation}
        />
        <section className="panel chat">
          <div className="chat-heading">
            <div><span className="eyebrow">Farm advisor</span><h2>Farmer conversation</h2></div>
            <div className="conversation-state status" role="status" aria-live="polite" aria-atomic="true">
              <b>{busy ? "AgriSense is working" : status.title}</b>
              <span>{status.detail}</span>
            </div>
          </div>
          {revision.planStale && (
            <p className="stale-plan-notice" role="status">
              Previous plan — profile changes are waiting.
            </p>
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
                  <b>{item.role === "agent" ? "AgriSense" : "Farmer"}</b>
                  {item.run ? (
                    <AgentRunMessage
                      run={item.run}
                      onToggle={(nextRun) => setConversation((items) => updateConversationRun(
                        items,
                        item.run.id,
                        () => nextRun,
                      ))}
                      onCancel={cancelRequest}
                      onRetry={retryLastRequest}
                      retryAvailable={item.run.id === latestRun?.id}
                    />
                  ) : item.role === "agent" ? (
                    <>
                      <Markdown>{item.text}</Markdown>
                      <PlanRevisionCard
                        revision={item.revision}
                        canCreate={canCreatePlanFrom(conversation, index)}
                        busy={busy}
                        onCreatePlan={() => void createUpdatedPlan()}
                      />
                    </>
                  ) : (
                    <p>{item.text}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <form className="chat-composer" onSubmit={submit} aria-label="Farm context message">
            <label className="sr-only" htmlFor="farm-message">Describe your farm</label>
            <textarea
              id="farm-message"
              name="farmMessage"
              rows={1}
              value={message}
              autoComplete="off"
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Example: I have 1 acre in Gazipur…"
              disabled={busy}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "request-error" : undefined}
            />
            <button type="submit" disabled={busy || !message.trim()}>{busy ? "Working…" : "Send"}</button>
          </form>
          <label className="date-control" htmlFor="plan-start-date">
            Season plan start date
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
            {["1 acre loam farm in Gazipur", "I have irrigation and BDT 90,000", "Plan for the Rabi season"].map((example) => (
              <button type="button" key={example} disabled={busy} onClick={() => setMessage(example)}>{example}</button>
            ))}
          </div>
          {error && <p id="request-error" className="error" role="alert">{error}</p>}
        </section>

        <div className="side-stack">
          <MemoryPanel
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
          <section className="panel summary">
            <h2>Recommendation</h2>
            {!best ? <p className="muted">Complete the intake or run the demo.</p> : (
              <>
                <div className="best"><span>Best fit</span><strong>{best.name}</strong><em>{best.suitability}% suitability · {best.riskLevel} risk</em></div>
                <p className="assumption-label"><b>Financial basis:</b> Team assumption - planning estimate, not live market data or retrieved evidence.</p>
                <dl>
                  <div><dt>7-day rain</dt><dd>{result.weather.precipitationMm.toFixed(1)} mm</dd></div>
                  <div><dt>Mean temperature</dt><dd>{result.weather.meanTemperatureC.toFixed(1)}°C</dd></div>
                  <div><dt>BARC zoning score</dt><dd>{best.scoreComponents.ragSuitability ?? "Unavailable"}</dd></div>
                  <div><dt>Itemized cost</dt><dd><ul>{Object.entries(best.financials.costBreakdownBdt).map(([name, value]) => <li key={name}>{name}: <Money value={value} /></li>)}</ul></dd></div>
                  <div><dt>Total cost</dt><dd><Money value={best.financials.totalCostBdt} /></dd></div>
                  <div><dt>Expected yield</dt><dd>{best.financials.expectedYieldKg.toFixed(0)} kg at <Money value={best.financials.pricePerKgBdt} /> per kg</dd></div>
                  <div><dt>Expected revenue</dt><dd><Money value={best.financials.revenueBdt} /></dd></div>
                  <div><dt>Net profit</dt><dd><Money value={best.financials.netProfitBdt} /></dd></div>
                  <div><dt>ROI</dt><dd>{best.financials.roiPercent}%</dd></div>
                  <div><dt>Break-even yield</dt><dd>{best.financials.breakEvenYieldKg.toFixed(0)} kg</dd></div>
                </dl>
              </>
            )}
          </section>
        </div>
      </div>

      {result && (
        <>
          <Schedule items={result.inputSchedule} />
          <section className="panel" id="ranking">
            <h3>Four ranked crops</h3>
            <div className="cards">
              {result.crops.map((crop, index) => (
                <article key={crop.id}>
                  <span>#{index + 1}</span><h4>{crop.name}</h4><b>{crop.suitability}%</b>
                  <div className="score-bar"><i style={{ width: `${crop.suitability}%` }} /></div>
                  <p>{crop.waterNeed} water · {crop.riskLevel} risk</p>
                  <small>Profit estimate: <Money value={crop.roughProfitBdt} /></small>
                  <small>{crop.sources.length} zoning source record(s)</small>
                  <details>
                    <summary>Why this score</summary>
                    <p>Weather {crop.scoreComponents.weatherRain + crop.scoreComponents.weatherTemperature} · RAG {crop.scoreComponents.ragSuitability ?? "unavailable"} · water penalty {crop.scoreComponents.waterPenalty} · budget penalty {crop.scoreComponents.budgetPenalty}</p>
                  </details>
                </article>
              ))}
            </div>
          </section>
          <section className="panel" id="roadmap">
            <h3>Dated season checkpoints</h3>
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
              <h3>Retrieved knowledge</h3>
              <p className="muted">{result.rag.totalIndexed} indexed fact cards across {result.rag.datasetCount} datasets.</p>
              <EvidenceGroupList records={result.knowledge} />
            </section>
            <section className="panel">
              <h3>Visible agent trace</h3>
              <details>
                <summary>{result.trace.length} recorded operations</summary>
                <pre>{JSON.stringify(result.trace, null, 2)}</pre>
              </details>
            </section>
          </div>
        </>
      )}
      <footer>Tier 1 · In-app memory, input scheduling, and agent activity. No external notification delivery. <a href="/evaluation.html">Open the self-test.</a></footer>
    </main>
  );
}
