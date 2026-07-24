import React from "react";

import { groupEvidenceRecords } from "../evidence.js";

const OMITTED_RECORD_FIELDS = new Set(["url", "sourceUrl"]);
const PRIVATE_FIELD_PATTERN =
  /(?:authorization|api.?key|credential|memory.?id|secret|token)/i;

function humanize(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayValue(value) {
  if (value == null) return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return new Intl.NumberFormat().format(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  return Object.entries(value)
    .filter(([key]) => (
      !OMITTED_RECORD_FIELDS.has(key) && !PRIVATE_FIELD_PATTERN.test(key)
    ))
    .map(([key, nested]) => `${humanize(key)}: ${displayValue(nested)}`)
    .join("; ");
}

export function recordMetadata(record = {}) {
  return Object.entries(record).filter(([key]) => (
    !OMITTED_RECORD_FIELDS.has(key) && !PRIVATE_FIELD_PATTERN.test(key)
  ));
}

function matchingRecordLabel(count) {
  return count === 1 ? "1 matching record" : `${count} matching records`;
}

export default function EvidenceGroupList({
  records = [],
  emptyMessage = "No direct evidence is attached.",
}) {
  const groups = groupEvidenceRecords(records);
  if (!groups.length) return <p>{emptyMessage}</p>;

  return (
    <div className="evidence-group-list">
      {groups.map((group, groupIndex) => (
        <article className="source evidence-group" key={group.canonicalUrl ?? `${group.title}-${groupIndex}`}>
          <div className="evidence-group-heading">
            {group.canonicalUrl ? (
              <a href={group.canonicalUrl} target="_blank" rel="noreferrer">
                {group.title || group.publisher || "Evidence source"}
              </a>
            ) : (
              <strong>{group.title || group.publisher || "Retrieved record"}</strong>
            )}
            <span>{matchingRecordLabel(group.count)}</span>
          </div>
          <details>
            <summary>View underlying record metadata</summary>
            {group.records.map((record, recordIndex) => (
              <dl key={record.id ?? recordIndex}>
                {recordMetadata(record).map(([key, value]) => (
                  <div key={key}>
                    <dt>{humanize(key)}</dt>
                    <dd>{displayValue(value)}</dd>
                  </div>
                ))}
              </dl>
            ))}
          </details>
        </article>
      ))}
    </div>
  );
}
