import React, { useMemo, useState } from "react";

import { assistantText } from "../shared/assistant.js";
import {
  createFreshDemoState,
  createInitialConversation,
  loadOrCreateSessionId,
  persistSessionId,
} from "./session.js";

const DEMO_PROFILE = {
  location: "Gazipur",
  farmSizeAcres: 1,
  soilType: "loam",
  waterAvailability: "irrigated",
  budgetBdt: 90000,
  targetSeason: "Rabi",
};

function Money({ value }) {
  return <>{new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 }).format(value)}</>;
}

export default function App() {
  const [sessionId, setSessionId] = useState(() => loadOrCreateSessionId());
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState(createInitialConversation);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const best = useMemo(() => result?.crops?.[0], [result]);
  const status = busy
    ? {
        title: "Request in progress",
        detail: result
          ? "The previous plan remains visible until this request completes."
          : "No result is available until this request completes.",
      }
    : error
      ? {
          title: "Request failed",
          detail: result
            ? "The previous plan remains visible."
            : "No plan was generated.",
        }
      : result
        ? {
            title: "Plan generated",
            detail: result.weather?.source || "Weather source unavailable",
          }
        : {
            title: "Not started",
            detail: "No live data has been requested yet.",
          };

  async function send(payload, requestSessionId = sessionId) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/session/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, sessionId: requestSessionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      if (payload.message) setConversation((items) => [...items, { role: "farmer", text: payload.message }]);
      setConversation((items) => [...items, { role: "agent", text: assistantText(data.assistant) }]);
      if (data.crops) setResult(data);
      setMessage("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    if (message.trim()) send({ message: message.trim() });
  }

  function runDemo() {
    const fresh = createFreshDemoState();
    persistSessionId(fresh.sessionId);
    setSessionId(fresh.sessionId);
    setMessage(fresh.message);
    setConversation(fresh.conversation);
    setResult(fresh.result);
    setError(fresh.error);
    void send({ profilePatch: DEMO_PROFILE }, fresh.sessionId);
  }

  return (
    <main aria-busy={busy}>
      <header>
        <div className="brand"><span className="brand-icon" aria-hidden="true">🌱</span><div><span className="eyebrow">Rookie Coders · Tier 0</span><h1>Agri<span>Sense</span></h1></div></div>
        <button type="button" className="demo" disabled={busy} onClick={runDemo}>Start fresh Gazipur demo</button>
      </header>

      <nav className="workflow-tabs" aria-label="Planning workspace">
        <a href="#advisor"><span>1</span>Farm advisor</a>
        <a href={result ? "#ranking" : undefined} aria-disabled={!result} tabIndex={result ? undefined : -1}><span>2</span>Crop ranking</a>
        <a href={result ? "#roadmap" : undefined} aria-disabled={!result} tabIndex={result ? undefined : -1}><span>3</span>Season roadmap</a>
        <a href={result ? "#evidence" : undefined} aria-disabled={!result} tabIndex={result ? undefined : -1}><span>4</span>{"Evidence & trace"}</a>
      </nav>

      <section className="hero">
        <div><h2>A grounded season plan, not a generic chatbot.</h2><p>Live Bangladesh weather, cited knowledge, deterministic economics, persistent farm context, and an inspectable tool trace.</p></div>
        <div className="status" role="status" aria-live="polite" aria-atomic="true"><b>{status.title}</b><span>{status.detail}</span></div>
      </section>

      {busy && <section className="pipeline" role="progressbar" aria-label="Live plan pipeline">
        <div className="pipeline-track"><i /></div>
        <b>Generating your grounded plan</b><span>Live weather, evidence, ranking, and explanation complete server-side; no unsupported phase is announced.</span>
      </section>}

      <div className="layout" id="advisor">
        <section className="panel chat">
          <h3>Farmer conversation</h3>
          <div className="messages">
            {conversation.map((item, index) => <p key={index} className={item.role}><b>{item.role === "agent" ? "AgriSense" : "Farmer"}</b>{item.text}</p>)}
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
          <div className="prompt-chips" aria-label="Example farm descriptions">
            {["1 acre loam farm in Gazipur", "I have irrigation and BDT 90,000", "Plan for the Rabi season"].map((example) => <button type="button" key={example} disabled={busy} onClick={() => setMessage(example)}>{example}</button>)}
          </div>
          {error && <p id="request-error" className="error" role="alert">{error}</p>}
        </section>

        <section className="panel summary">
          <h3>Recommendation</h3>
          {!best ? <p className="muted">Complete the intake or run the demo.</p> : <>
            <div className="best"><span>Best fit</span><strong>{best.name}</strong><em>{best.suitability}% suitability · {best.riskLevel} risk</em></div>
            <p className="assumption-label"><b>Financial basis:</b> Team assumption - planning estimate, not live market data or retrieved evidence.</p>
            <dl><div><dt>7-day rain</dt><dd>{result.weather.precipitationMm.toFixed(1)} mm</dd></div><div><dt>Mean temperature</dt><dd>{result.weather.meanTemperatureC.toFixed(1)}°C</dd></div><div><dt>BARC zoning score</dt><dd>{best.scoreComponents.ragSuitability ?? "Unavailable"}</dd></div><div><dt>Itemized cost</dt><dd><ul>{Object.entries(best.financials.costBreakdownBdt).map(([name, value]) => <li key={name}>{name}: <Money value={value} /></li>)}</ul></dd></div><div><dt>Total cost</dt><dd><Money value={best.financials.totalCostBdt} /></dd></div><div><dt>Expected yield</dt><dd>{best.financials.expectedYieldKg.toFixed(0)} kg at <Money value={best.financials.pricePerKgBdt} /> per kg</dd></div><div><dt>Expected revenue</dt><dd><Money value={best.financials.revenueBdt} /></dd></div><div><dt>Net profit</dt><dd><Money value={best.financials.netProfitBdt} /></dd></div><div><dt>ROI</dt><dd>{best.financials.roiPercent}%</dd></div><div><dt>Break-even yield</dt><dd>{best.financials.breakEvenYieldKg.toFixed(0)} kg</dd></div></dl>
          </>}
        </section>
      </div>

      {result && <>
        <section className="panel" id="ranking"><h3>Four ranked crops</h3><div className="cards">{result.crops.map((crop, index) => <article key={crop.id}><span>#{index + 1}</span><h4>{crop.name}</h4><b>{crop.suitability}%</b><div className="score-bar"><i style={{ width: `${crop.suitability}%` }} /></div><p>{crop.waterNeed} water · {crop.riskLevel} risk</p><small>Profit estimate: <Money value={crop.roughProfitBdt} /></small><small>{crop.sources.length} zoning source record(s)</small><details><summary>Why this score</summary><p>Weather {crop.scoreComponents.weatherRain + crop.scoreComponents.weatherTemperature} · RAG {crop.scoreComponents.ragSuitability ?? "unavailable"} · water penalty {crop.scoreComponents.waterPenalty} · budget penalty {crop.scoreComponents.budgetPenalty}</p></details></article>)}</div></section>
        <section className="panel" id="roadmap"><h3>Dated season checkpoints</h3><div className="timeline">{result.seasonPlan.map((item) => <article key={item.stage}><time>{item.date}</time><b>{item.stage.replaceAll("_", " ")}</b><small className={item.truthLabel === "RETRIEVED_EVIDENCE" ? "truth-pill retrieved" : "truth-pill assumption"}>{item.truthLabel === "RETRIEVED_EVIDENCE" ? "Retrieved evidence" : "Team assumption"}</small><p>{item.action}</p>{item.evidence?.[0] && <a href={item.evidence[0].url} target="_blank" rel="noreferrer">{item.evidence[0].publisher || item.evidence[0].title}</a>}</article>)}</div></section>
        <div className="layout" id="evidence">
          <section className="panel"><h3>Retrieved knowledge</h3><p className="muted">{result.rag.totalIndexed} indexed fact cards across {result.rag.datasetCount} datasets.</p>{result.knowledge.map((item) => <article className="source" key={item.id}><a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.title}</a><small>{item.publisher} · {item.dataset} · confidence {item.confidence || "unrated"}</small><p>{item.text}</p></article>)}</section>
          <section className="panel"><h3>Visible agent trace</h3><details open><summary>{result.trace.length} recorded operations</summary><pre>{JSON.stringify(result.trace, null, 2)}</pre></details></section>
        </div>
      </>}
      <footer>Tier 0 · Live weather and retrieved public evidence are separated from transparent team assumptions. <a href="/evaluation.html">Open the self-test.</a></footer>
    </main>
  );
}
