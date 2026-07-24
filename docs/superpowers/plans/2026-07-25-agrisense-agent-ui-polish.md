# AgriSense Agent UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` task-by-task. Follow TDD and preserve unrelated work.

**Goal:** Deliver the approved chat-first Tier 1 interface with truthful in-chat activity, grouped evidence, complete dark/light theming, and user-level browser proof.

**Architecture:** Keep the server NDJSON and safety contracts unchanged. Add pure client modules for run-state transitions and evidence grouping, render the run inside the assistant conversation message, and rebuild the visual layer around semantic theme tokens and locally bundled fonts.

**Tech Stack:** React 19, Vite 7, Node test runner, NDJSON streaming, React Markdown, CSS custom properties, Fontsource variable fonts.

---

## Task 1: Pure client contracts

- Add a tested run-state module covering running, complete, failed, cancelled, expansion, ordered events, timing, final Markdown, and reasoning summaries.
- Add a tested evidence-grouping module that canonicalizes URLs while retaining every underlying record.
- Demonstrate RED before implementing each helper, then run the focused tests and full suite.

## Task 2: Chat-native activity integration

- Replace the standalone lower activity panel with an assistant run message inside the conversation.
- Stream normal events immediately; queue demo event presentation for roughly 3–4 seconds without changing recorded durations.
- Collapse successful runs about 600 ms after the last visible event and render the final Markdown in the same message.
- Keep failed and cancelled runs expanded with retry guidance.
- Show compact tool/source/data summaries with sanitized expandable details and API-provided reasoning summaries only.
- Preserve safe Markdown, cancel/retry, memory, schedule, ranking, roadmap, and backend contracts.

## Task 3: Evidence presentation and visual system

- Group duplicate source URLs in schedule and retrieved-knowledge views; expose retained records inside the group.
- Bundle Newsreader Variable and Anek Bangla Variable locally.
- Apply the approved dark/green and warm-white themes through semantic tokens.
- Use a chat-first 2:1 desktop layout, accessible System/Light/Dark control, responsive stacking, visible focus, smooth restrained motion, and reduced-motion support.

## Task 4: Verification and delivery

- Run focused tests, `npm run check`, and `npm audit --omit=dev`.
- Review current Vercel Web Interface Guidelines against the changed UI.
- Exercise dark/light/system, live demo activity, collapse/reopen, Markdown, grouped evidence, keyboard behavior, responsive layout, console output, and performance in the signed-in in-app browser.
- Commit and push only after local proof passes. Do not modify or stage `roadmap-t0.html`.
