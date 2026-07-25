import React from "react";

import {
  getRunElapsedMs,
  toggleRunCollapsed,
} from "../agent-run.js";
import Markdown from "./Markdown.jsx";

const PRIVATE_DETAIL_PATTERN =
  /(?:authorization|api.?key|credential|memory.?id|prompt|reason|thought|secret|token)/i;
const SOURCE_FIELD_PATTERN = /^(?:url|sourceUrl)$/i;
const BN_EVENT_LABELS = {
  "request.accepted": "অনুরোধ নেওয়া হয়েছে",
  "memory.loaded": "খামারের সংরক্ষিত তথ্য খোলা হয়েছে",
  "profile.updated": "খামারের তথ্য হালনাগাদ হয়েছে",
  "request.completed": "কাজ প্রস্তুত",
  "weather.fetch.started": "আবহাওয়ার পূর্বাভাস দেখা হচ্ছে",
  "weather.fetch.completed": "আবহাওয়ার তথ্য পাওয়া গেছে",
  "rag.retrieve.started": "বাংলাদেশের কৃষি তথ্য খোঁজা হচ্ছে",
  "rag.retrieve.completed": "কৃষি তথ্য পাওয়া গেছে",
  "crops.rank.completed": "ফসলের তালিকা তৈরি হয়েছে",
  "scheduler.completed": "সার ও সেচের সময়সূচি তৈরি হয়েছে",
  "agent.response.started": "তথ্য যাচাই করে উত্তর তৈরি হচ্ছে",
  "agent.response.completed": "যাচাই করা উত্তর প্রস্তুত",
  "memory.saved": "খামারের তথ্য সংরক্ষিত হয়েছে",
};

export function safeHttpUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function humanizeFieldName(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeText(value, fallback = "") {
  return typeof value === "string"
    ? value.replace(/[^\p{L}\p{N}\s.,:;!?%+/_()-]/gu, "").trim()
    : fallback;
}

function displayValue(value) {
  if (value == null) return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return new Intl.NumberFormat().format(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  return Object.entries(value)
    .filter(([key]) => !PRIVATE_DETAIL_PATTERN.test(key))
    .map(([key, nested]) => `${humanizeFieldName(key)}: ${displayValue(nested)}`)
    .join("; ");
}

function visibleDetailEntries(details = {}) {
  return Object.entries(details).filter(([key]) => (
    !PRIVATE_DETAIL_PATTERN.test(key) && !SOURCE_FIELD_PATTERN.test(key)
  ));
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs)) return null;
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(1)} s`;
}

function eventContext(event) {
  const details = event.details || {};
  const sourceUrl = safeHttpUrl(details.sourceUrl ?? details.url);
  const sourceHost = sourceUrl ? new URL(sourceUrl).hostname : "";
  return safeText(
    details.tool
      || details.provider
      || details.model
      || details.publisher
      || details.dataset
      || details.source
      || sourceHost
      || details.sourceDomains?.join(", ")
      || "",
  );
}

function RunEvent({ event, language }) {
  const bangla = language === "bn";
  const sourceUrl = safeHttpUrl(event.details?.sourceUrl ?? event.details?.url);
  const context = eventContext(event);
  const details = visibleDetailEntries(event.details);
  const duration = formatDuration(event.durationMs);
  const eventType = safeText(event.type, "activity");

  return (
    <details className="agent-run-step">
      <summary>
        <span className={`activity-dot ${safeText(event.status, "running")}`} aria-hidden="true" />
        <span>{bangla ? (BN_EVENT_LABELS[event.type] || safeText(event.label, "কাজের ধাপ")) : safeText(event.label, "Agent step")}</span>
        <small>{bangla ? ({ running: "চলছে", completed: "শেষ", failed: "ব্যর্থ" }[event.status] || event.status) : safeText(event.status, "running")}</small>
        {context && <small>{context}</small>}
        {duration && <time>{duration}</time>}
      </summary>
      <div className="activity-detail">
        <dl>
          <div><dt>{bangla ? "কাজের ধরন" : "Event type"}</dt><dd>{eventType}</dd></div>
          {event.timestamp && (
            <div>
              <dt>{bangla ? "সময়" : "Timestamp"}</dt>
              <dd><time dateTime={event.timestamp}>{event.timestamp}</time></dd>
            </div>
          )}
          {sourceUrl && (
            <div>
              <dt>{bangla ? "উৎস" : "Source"}</dt>
              <dd><a href={sourceUrl} target="_blank" rel="noreferrer">{bangla ? "যাচাই করা উৎস দেখুন" : "Open verified source"}</a></dd>
            </div>
          )}
          {details.map(([key, value]) => (
            <div key={key}>
              <dt>{humanizeFieldName(key)}</dt>
              <dd>{displayValue(value)}</dd>
            </div>
          ))}
        </dl>
        {!sourceUrl && details.length === 0 && (
          <p>{bangla ? "এই ধাপের জন্য আর কোনো নিরাপদ তথ্য নেই।" : "No additional safe detail was returned for this step."}</p>
        )}
      </div>
    </details>
  );
}

function completionLabel(run, bangla) {
  const elapsedMs = getRunElapsedMs(run);
  const elapsed = Number.isFinite(elapsedMs)
    ? `${(elapsedMs / 1_000).toFixed(1)}s`
    : bangla ? "সময় পাওয়া যায়নি" : "time unavailable";
  if (bangla) {
    const outcome = run.outcome === "plan" ? "পরিকল্পনা তৈরি" : run.outcome === "market" ? "বাজার খোঁজা শেষ" : run.outcome === "diagnosis" ? "ছবি দেখা শেষ" : "কাজ শেষ";
    return `${outcome} · ${run.events.length} ধাপ · ${elapsed}`;
  }
  const outcome = run.outcome === "plan"
    ? "Plan completed"
    : run.outcome === "market"
      ? "Market research completed"
      : run.outcome === "diagnosis"
        ? "Image assessment completed"
        : "Request completed";
  return `${outcome} · ${run.events.length} steps · ${elapsed}`;
}

function runningLabel(run, bangla) {
  if (bangla) {
    if (run.outcome === "market") return "এখনকার বাজারদর খোঁজা হচ্ছে";
    if (run.outcome === "diagnosis") return "পাতার ছবি দেখা হচ্ছে";
    return "তথ্যভিত্তিক পরিকল্পনা তৈরি হচ্ছে";
  }
  if (run.outcome === "market") return "Researching current markets";
  if (run.outcome === "diagnosis") return "Assessing the leaf image";
  return "Building your grounded plan";
}

function terminalLabel(run, bangla) {
  if (bangla) return run.status === "failed" ? "কাজটি শেষ করা যায়নি" : "কাজটি থামানো হয়েছে";
  const noun = run.outcome === "market"
    ? "Market research"
    : run.outcome === "diagnosis"
      ? "Image assessment"
      : "Plan";
  return run.status === "failed"
    ? `${noun} could not be completed`
    : `${noun} request cancelled`;
}

export default function AgentRunMessage({
  run,
  onToggle,
  onCancel,
  onRetry,
  retryAvailable = false,
  language = "en",
}) {
  const bangla = language === "bn";
  const stepsRef = React.useRef(null);
  const isComplete = run.status === "complete";
  const showDetails = !isComplete || !run.collapsed;
  const canRetry = retryAvailable && (
    run.status === "failed" || run.status === "cancelled"
  );
  React.useEffect(() => {
    if (run.status === "running") {
      stepsRef.current?.scrollTo?.({
        top: stepsRef.current.scrollHeight,
        behavior: "auto",
      });
    }
  }, [run.events.length, run.status]);

  return (
    <section
      className={`agent-run-message ${run.status}`}
      id={`agent-run-${run.id}`}
      aria-live="polite"
    >
      {isComplete ? (
        <button
          type="button"
          className="agent-run-summary"
          aria-expanded={!run.collapsed}
          onClick={() => onToggle(toggleRunCollapsed(run))}
        >
          {completionLabel(run, bangla)}
        </button>
      ) : (
        <div className="agent-run-heading">
          <b>
            {run.status === "running"
              ? runningLabel(run, bangla)
              : terminalLabel(run, bangla)}
          </b>
          <span>{bangla ? `${run.events.length}টি যাচাই করা ধাপ` : `${run.events.length} verified step${run.events.length === 1 ? "" : "s"}`}</span>
        </div>
      )}

      {showDetails && (
        <div className="agent-run-steps" ref={stepsRef}>
          {run.events.map((event, index) => (
            <RunEvent key={event.id ?? `${event.type}-${index}`} event={event} language={language} />
          ))}
          {run.status === "running" && (
            <div className="activity-pending">
              <i /><span>{bangla ? "পরের যাচাই করা ধাপের অপেক্ষা…" : "Waiting for the next verified step…"}</span>
            </div>
          )}
        </div>
      )}

      {run.reasoningSummaries.length > 0 && showDetails && (
        <details className="reasoning-summaries">
          <summary>{bangla ? "এই পরামর্শ কেন" : "Why this plan"}</summary>
          <p className="muted">{bangla ? "মডেলের সংক্ষিপ্ত ব্যাখ্যা; গোপন চিন্তার ধাপ দেখানো হয় না।" : "API-provided reasoning summary; private raw reasoning is never shown."}</p>
          {run.reasoningSummaries.map((summary, index) => (
            <Markdown key={`${index}-${summary.slice(0, 20)}`}>{summary}</Markdown>
          ))}
        </details>
      )}

      {run.status === "running" && (
        <button type="button" className="cancel-request" onClick={onCancel}>
          {bangla ? "কাজ থামান" : "Cancel request"}
        </button>
      )}
      {run.status === "failed" && (
        <p className="error">{run.error || (bangla ? "সংযোগ দেখে আবার চেষ্টা করুন।" : "Check your connection, then retry the request.")}</p>
      )}
      {canRetry && (
        <>
          <p className="muted">
            {run.status === "cancelled"
              ? bangla ? "এই কাজটি থেমে গেছে। প্রস্তুত হলে আবার চালান।" : "Nothing else will be added to this run. Retry when you are ready."
              : bangla ? "আগের পরামর্শ অপরিবর্তিত আছে। নতুন করে চেষ্টা করুন।" : "The previous recommendation remains unchanged. Retry to start a fresh run."}
          </p>
          <button type="button" className="retry-request" onClick={onRetry}>
            {bangla ? "আবার চেষ্টা করুন" : "Retry request"}
          </button>
        </>
      )}

      {isComplete && <Markdown>{run.answer}</Markdown>}
    </section>
  );
}
