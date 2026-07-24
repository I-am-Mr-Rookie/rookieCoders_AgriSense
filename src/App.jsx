import React, { useMemo, useState } from "react";

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
  const [sessionId] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState([{ role: "agent", text: "Tell me about your farm. I will ask only for missing details." }]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const best = useMemo(() => result?.crops?.find((crop) => crop.id === result.selectedCropId) ?? result?.crops?.[0], [result]);

  async function send(payload) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/session/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...payload }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      if (payload.message) setConversation((items) => [...items, { role: "farmer", text: payload.message }]);
      setConversation((items) => [...items, { role: "agent", text: data.assistant }]);
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

  return (
    <main>
      <header>
        <div><span className="eyebrow">Rookie Coders · T0-RAG</span><h1>AgriSense</h1></div>
        <button className="demo" disabled={busy} onClick={() => send({ profilePatch: DEMO_PROFILE })}>Run Gazipur demo</button>
      </header>

      <section className="hero">
        <div><h2>A grounded season plan, not a generic chatbot.</h2><p>Live Bangladesh weather, cited knowledge, deterministic economics, persistent farm context, and an inspectable tool trace.</p></div>
        <div className="status"><b>{result ? "Plan generated" : "Waiting for farm context"}</b><span>{result?.weather?.source || "Open-Meteo ready"}</span></div>
      </section>

      <div className="layout">
        <section className="panel chat">
          <h3>Farmer conversation</h3>
          <div className="messages">
            {conversation.map((item, index) => <p key={index} className={item.role}><b>{item.role === "agent" ? "AgriSense" : "Farmer"}</b>{item.text}</p>)}
          </div>
          <form onSubmit={submit}><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Example: I have 1 acre in Gazipur..." /><button disabled={busy}>{busy ? "Working…" : "Send"}</button></form>
          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel summary">
          <h3>Recommendation</h3>
          {!best ? <p className="muted">Complete the intake or run the demo.</p> : <>
            <div className="best"><span>Best fit</span><strong>{best.name}</strong><em>{best.suitability}% suitability · {best.riskLevel} risk</em></div>
            <dl><div><dt>7-day rain</dt><dd>{result.weather.precipitationMm.toFixed(1)} mm</dd></div><div><dt>Mean temperature</dt><dd>{result.weather.meanTemperatureC.toFixed(1)}°C</dd></div><div><dt>Expected revenue</dt><dd><Money value={best.financials.revenueBdt} /></dd></div><div><dt>Net profit</dt><dd><Money value={best.financials.netProfitBdt} /></dd></div><div><dt>ROI</dt><dd>{best.financials.roiPercent}%</dd></div><div><dt>Break-even yield</dt><dd>{best.financials.breakEvenYieldKg.toFixed(0)} kg</dd></div></dl>
          </>}
        </section>
      </div>

      {result && <>
        <section className="panel"><h3>Four ranked crops</h3><div className="cards">{result.crops.map((crop, index) => <article key={crop.id}><span>#{index + 1}</span><h4>{crop.name}</h4><b>{crop.suitability}%</b><p>{crop.waterNeed} water · {crop.riskLevel} risk · {crop.evidenceChunkIds.length} evidence chunks</p><small>Profit estimate: <Money value={crop.roughProfitBdt} /></small><button disabled={busy || crop.id === result.selectedCropId} onClick={() => send({ selectedCropId: crop.id })}>{crop.id === result.selectedCropId ? "Selected" : "Use this crop"}</button></article>)}</div></section>
        <section className="panel"><h3>Dated season checkpoints</h3><div className="timeline">{result.seasonPlan.map((item) => <article key={item.stage}><time>{item.date}</time><b>{item.stage.replaceAll("_", " ")}</b><p>{item.action}</p></article>)}</div></section>
        <div className="layout">
          <section className="panel"><h3>Retrieved Bangladesh evidence</h3>{result.knowledge.map((item) => <article className="source" key={item.record_id}>{item.source_url ? <a href={item.source_url} target="_blank" rel="noopener noreferrer">{item.source_title}</a> : <b>{item.source_title}</b>}<p>{item.text}</p><small>{item.publisher} · {item.source_page_or_table || "context unavailable"} · {item.record_id} · score {item.retrieval_score} · confidence {item.confidence || "unknown"}</small>{item.quality_flags?.length > 0 && <p className="error">Flags: {item.quality_flags.join(", ")}</p>}</article>)}</section>
          <section className="panel"><h3>Visible agent trace</h3><details open><summary>{result.trace.length} recorded operations</summary><pre>{JSON.stringify(result.trace, null, 2)}</pre></details></section>
        </div>
      </>}
      <footer>T0-RAG · Retrieval and provenance are live; deterministic finance assumptions remain visibly bounded pending field validation.</footer>
    </main>
  );
}
