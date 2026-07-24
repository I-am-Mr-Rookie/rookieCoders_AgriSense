import React from "react";

import {
  getRunElapsedMs,
  toggleRunCollapsed,
} from "../agent-run.js";
import Markdown from "./Markdown.jsx";

const PRIVATE_DETAIL_PATTERN =
  /(?:authorization|api.?key|credential|memory.?id|prompt|reason|thought|secret|token)/i;
const SOURCE_FIELD_PATTERN = /^(?:url|sourceUrl)$/i;

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

function RunEvent({ event }) {
  const sourceUrl = safeHttpUrl(event.details?.sourceUrl ?? event.details?.url);
  const context = eventContext(event);
  const details = visibleDetailEntries(event.details);
  const duration = formatDuration(event.durationMs);
  const eventType = safeText(event.type, "activity");

  return (
    <details className="agent-run-step">
      <summary>
        <span className={`activity-dot ${safeText(event.status, "running")}`} aria-hidden="true" />
        <span>{safeText(event.label, "Agent step")}</span>
        <small>{safeText(event.status, "running")}</small>
        {context && <small>{context}</small>}
        {duration && <time>{duration}</time>}
      </summary>
      <div className="activity-detail">
        <dl>
          <div><dt>Event type</dt><dd>{eventType}</dd></div>
          {event.timestamp && (
            <div>
              <dt>Timestamp</dt>
              <dd><time dateTime={event.timestamp}>{event.timestamp}</time></dd>
            </div>
          )}
          {sourceUrl && (
            <div>
              <dt>Source</dt>
              <dd><a href={sourceUrl} target="_blank" rel="noreferrer">Open verified source</a></dd>
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
          <p>No additional safe detail was returned for this step.</p>
        )}
      </div>
    </details>
  );
}

function completionLabel(run) {
  const elapsedMs = getRunElapsedMs(run);
  const elapsed = Number.isFinite(elapsedMs)
    ? `${(elapsedMs / 1_000).toFixed(1)}s`
    : "time unavailable";
  const outcome = run.outcome === "plan"
    ? "Plan completed"
    : "Request completed";
  return `${outcome} · ${run.events.length} steps · ${elapsed}`;
}

export default function AgentRunMessage({
  run,
  onToggle,
  onCancel,
  onRetry,
  retryAvailable = false,
}) {
  const isComplete = run.status === "complete";
  const showDetails = !isComplete || !run.collapsed;
  const canRetry = retryAvailable && (
    run.status === "failed" || run.status === "cancelled"
  );

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
          {completionLabel(run)}
        </button>
      ) : (
        <div className="agent-run-heading">
          <b>
            {run.status === "running"
              ? "Building your grounded plan"
              : run.status === "failed"
                ? "Plan could not be completed"
                : "Plan request cancelled"}
          </b>
          <span>{run.events.length} verified step{run.events.length === 1 ? "" : "s"}</span>
        </div>
      )}

      {showDetails && (
        <div className="agent-run-steps">
          {run.events.map((event, index) => (
            <RunEvent key={event.id ?? `${event.type}-${index}`} event={event} />
          ))}
          {run.status === "running" && (
            <div className="activity-pending">
              <i /><span>Waiting for the next verified step…</span>
            </div>
          )}
        </div>
      )}

      {run.reasoningSummaries.length > 0 && showDetails && (
        <details className="reasoning-summaries">
          <summary>Why this plan</summary>
          <p className="muted">API-provided reasoning summary; private raw reasoning is never shown.</p>
          {run.reasoningSummaries.map((summary, index) => (
            <Markdown key={`${index}-${summary.slice(0, 20)}`}>{summary}</Markdown>
          ))}
        </details>
      )}

      {run.status === "running" && (
        <button type="button" className="cancel-request" onClick={onCancel}>
          Cancel request
        </button>
      )}
      {run.status === "failed" && (
        <p className="error">{run.error || "Check your connection, then retry the request."}</p>
      )}
      {canRetry && (
        <>
          <p className="muted">
            {run.status === "cancelled"
              ? "Nothing else will be added to this run. Retry when you are ready."
              : "The previous recommendation remains unchanged. Retry to start a fresh run."}
          </p>
          <button type="button" className="retry-request" onClick={onRetry}>
            Retry request
          </button>
        </>
      )}

      {isComplete && <Markdown>{run.answer}</Markdown>}
    </section>
  );
}
