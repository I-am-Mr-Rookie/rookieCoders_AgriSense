import React from "react";

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
}) {
  const recent = [...sessions].sort((left, right) =>
    String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
  );

  return (
    <aside className="conversation-sidebar" aria-label="Conversation history">
      <div className="conversation-sidebar-heading">
        <div>
          <span className="eyebrow">Your workspace</span>
          <h2>Recent chats</h2>
        </div>
        <button
          type="button"
          className="new-chat-button"
          disabled={busy}
          onClick={onNew}
          aria-label="Start a new chat"
        >
          <span aria-hidden="true">＋</span>
          New chat
        </button>
      </div>
      {!connected ? (
        <p className="conversation-sidebar-empty">
          Your first message creates one private recovery code for every chat.
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
              <span className="conversation-item-title">{session.title || "New conversation"}</span>
              <span className="conversation-item-meta">
                {session.lastResult ? "Plan ready" : "Conversation"}
                {sessionTime(session.updatedAt) ? ` · ${sessionTime(session.updatedAt)}` : ""}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="conversation-sidebar-empty">Start a new chat to build your farm plan.</p>
      )}
      <div className="workspace-memory-state">
        <span aria-hidden="true">{connected ? "●" : "○"}</span>
        <span>{connected ? "Private memory connected" : "Memory starts automatically"}</span>
      </div>
    </aside>
  );
}
