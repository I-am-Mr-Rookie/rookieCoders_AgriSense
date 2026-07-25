import React from "react";

import { t } from "../i18n.js";

function sessionTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

export default function ConversationSidebar({
  sessions = [],
  activeSessionId,
  connected,
  busy,
  onNew,
  onSelect,
  language = "en",
}) {
  const recent = [...sessions].sort((left, right) =>
    String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
  );

  return (
    <aside className="conversation-sidebar" aria-label="Conversation history">
      <div className="conversation-sidebar-heading">
        <div>
          <span className="eyebrow">{t(language, "yourWorkspace")}</span>
          <h2>{t(language, "recentChats")}</h2>
        </div>
        <button
          type="button"
          className="new-chat-button"
          disabled={busy}
          onClick={onNew}
          aria-label={t(language, "newChat")}
        >
          <span aria-hidden="true">＋</span>
          {t(language, "newChat")}
        </button>
      </div>
      {!connected ? (
        <p className="conversation-sidebar-empty">
          {t(language, "noMemoryChats")}
        </p>
      ) : recent.length ? (
        <div className="conversation-list">
          {recent.map((session) => (
            <button
              type="button"
              key={session.id}
              className="conversation-item"
              aria-current={session.id === activeSessionId ? "page" : undefined}
              disabled={busy}
              onClick={() => onSelect(session)}
            >
              <span className="conversation-item-title">{session.title || t(language, "newConversation")}</span>
              <span className="conversation-item-meta">
                {session.lastResult ? t(language, "planReady") : t(language, "conversation")}
                {sessionTime(session.updatedAt) ? ` · ${sessionTime(session.updatedAt)}` : ""}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="conversation-sidebar-empty">{t(language, "startNewChat")}</p>
      )}
      <div className="workspace-memory-state">
        <span aria-hidden="true">{connected ? "●" : "○"}</span>
        <span>{connected ? t(language, "privateMemoryConnected") : t(language, "memoryStarts")}</span>
      </div>
    </aside>
  );
}
