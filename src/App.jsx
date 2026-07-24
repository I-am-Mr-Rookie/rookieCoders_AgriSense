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
import AgentRunMessage from "./components/AgentRunMessage.jsx";
import EvidenceGroupList from "./components/EvidenceGroupList.jsx";
import Markdown from "./components/Markdown.jsx";
import {
  createFreshDemoState,
  createInitialConversation,
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
        <div><span className="eyebrow">Private and optional</span><h3>Saved farm memory</h3></div>
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
              type="password"
              value={memoryInput}
              onChange={(event) => onInput(event.target.value)}
              placeholder="Paste farm_ recovery code"
              autoComplete="off"
            />
            <button type="button" disabled={busy || !memoryInput.trim()} onClick={onResume}>Resume</button>
          </div>
        </div>
      ) : (
        <div className="connected-memory">
          <label>
            <input
              type="checkbox"
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
  const [lastRequest, setLastRequest] = useState(null);
  const requestController = useRef(null);
  const runSequence = useRef(0);
  const messagesRef = useRef(null);
  const keepMessagesPinnedRef = useRef(true);
  const best = useMemo(() => result?.crops?.[0], [result]);
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
      messages.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
    }
  }, [conversation]);

  const status = latestRun?.status === "running"
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
        ? {
            title: "Plan generated",
            detail: result?.weather?.source || "Weather source unavailable",
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
        ...(requestMemoryId ? { memoryId: requestMemoryId } : {}),
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
      await wait(600);
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
          ? toggleRunCollapsed(completedRun)
          : completedRun;
      }));
      if (data.crops) setResult(data);
      if (requestMemoryId) {
        setSavedMemory((current) => ({
          ...(current || {}),
          profile: data.profile,
          lastResult: data.crops ? data : current?.lastResult,
          preferences: { autoAdjustIrrigation },
        }));
      }
      setMessage("");
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

  function submit(event) {
    event.preventDefault();
    if (message.trim()) void send({ message: message.trim(), startDate: planStartDate });
  }

  function runDemo() {
    const fresh = createFreshDemoState();
    persistSessionId(fresh.sessionId);
    setSessionId(fresh.sessionId);
    setMessage(fresh.message);
    setConversation(fresh.conversation);
    setResult(fresh.result);
    setError(fresh.error);
    void send({ profilePatch: DEMO_PROFILE, startDate: planStartDate }, fresh.sessionId, { memoryId: "", mode: "demo" });
  }

  async function createMemory() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/memory/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          preferences: { autoAdjustIrrigation },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create farm memory.");
      setMemoryId(data.memoryId);
      setNewMemoryId(data.memoryId);
      setMemoryInput("");
      setMemoryPersistence(data.database);
      setSavedMemory(data.memory);
    } catch (err) {
      setError(err.message);
    } finally {
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
      setSavedMemory(data.memory);
      setAutoAdjustIrrigation(data.memory.preferences?.autoAdjustIrrigation !== false);
      setConversation(fresh.conversation);
      if (data.memory.lastResult) {
        const restored = data.memory.lastResult;
        setResult(restored);
        if (restored.explanation) {
          setConversation([...fresh.conversation, { role: "agent", text: restored.explanation }]);
        }
      } else {
        setResult(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function forgetMemory() {
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
      <header>
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">🌱</span>
          <div><span className="eyebrow">Rookie Coders · Tier 1</span><h1>Agri<span>Sense</span></h1></div>
        </div>
        <div className="header-actions">
          <label className="theme-control">
            <span className="sr-only">Theme</span>
            <select aria-label="Theme" value={theme} onChange={(event) => changeTheme(event.target.value)}>
              <option value="system">System theme</option>
              <option value="light">Light mode</option>
              <option value="dark">Dark mode</option>
            </select>
          </label>
          <button type="button" className="demo" disabled={busy} onClick={runDemo}>Start fresh Gazipur demo</button>
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

      <section className="hero">
        <div>
          <h2>A grounded season plan that shows its work.</h2>
          <p>Live Bangladesh weather, cited knowledge, deterministic economics, persistent farm context, and an inspectable tool trace.</p>
        </div>
        <div className="status" role="status" aria-live="polite" aria-atomic="true"><b>{status.title}</b><span>{status.detail}</span></div>
      </section>

      <div className="layout" id="advisor">
        <section className="panel chat">
          <h3>Farmer conversation</h3>
          <div
            className="messages"
            ref={messagesRef}
            onScroll={() => {
              const messages = messagesRef.current;
              if (!messages) return;
              keepMessagesPinnedRef.current =
                messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
            }}
          >
            {conversation.map((item, index) => (
              <div key={`${item.role}-${index}`} className={item.role}>
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
                  />
                ) : item.role === "agent" ? (
                  <Markdown>{item.text}</Markdown>
                ) : (
                  <p>{item.text}</p>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={submit} aria-label="Farm context message">
            <label className="sr-only" htmlFor="farm-message">Describe your farm</label>
            <input
              id="farm-message"
              name="farmMessage"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Example: I have 1 acre in Gazipur..."
              disabled={busy}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "request-error" : undefined}
            />
            <button type="submit" disabled={busy || !message.trim()}>{busy ? "Working..." : "Send"}</button>
          </form>
          <label className="date-control" htmlFor="plan-start-date">
            Season plan start date
            <input
              id="plan-start-date"
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
            <h3>Recommendation</h3>
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
