import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const markdownUrl = new URL("../src/components/Markdown.jsx", import.meta.url);
const runMessageUrl = new URL("../src/components/AgentRunMessage.jsx", import.meta.url);
const evidenceListUrl = new URL("../src/components/EvidenceGroupList.jsx", import.meta.url);
const markdownSource = existsSync(markdownUrl) ? readFileSync(markdownUrl, "utf8") : "";
const runMessageSource = existsSync(runMessageUrl) ? readFileSync(runMessageUrl, "utf8") : "";
const evidenceListSource = existsSync(evidenceListUrl) ? readFileSync(evidenceListUrl, "utf8") : "";
const cssSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const compactCss = cssSource.replace(/\s+/g, "");

function assertIncludesAll(source, fragments) {
  const missing = fragments.filter((fragment) => !source.includes(fragment));
  assert.deepEqual(missing, []);
}

test("recommendation shows the complete financial contract", () => {
  const labels = [
    "Itemized cost",
    "Total cost",
    "Expected yield",
    "Expected revenue",
    "Net profit",
    "ROI",
    "Break-even yield",
    "Financial basis:",
    "Team assumption",
    "not live market data or retrieved evidence",
  ];

  assertIncludesAll(appSource, labels);
});

test("fresh demo state is sent with its new explicit session ID", () => {
  assertIncludesAll(appSource, [
    "loadOrCreateSessionId",
    "persistSessionId",
    "const [sessionId, setSessionId] = useState(() => loadOrCreateSessionId());",
    "async function send(payload, requestSessionId = sessionId, options = {})",
    "body: JSON.stringify({ ...payload, sessionId: requestSessionId })",
    "function runDemo()",
    "const fresh = createFreshDemoState();",
    "setSessionId(fresh.sessionId);",
    "setMessage(fresh.message);",
    "setConversation(fresh.conversation);",
    "setResult(fresh.result);",
    "setError(fresh.error);",
    'send({ profilePatch: DEMO_PROFILE, startDate: planStartDate }, fresh.sessionId, { memoryId: "", mode: "demo" })',
  ]);
});

test("judge path exposes honest and accessible request states", () => {
  assertIncludesAll(appSource, [
    "Not started",
    "Request in progress",
    "Request failed",
    "Plan generated",
    "No live data has been requested yet.",
    'role="status"',
    'aria-live="polite"',
    'aria-atomic="true"',
    "aria-busy={busy}",
    'htmlFor="farm-message"',
    'id="farm-message"',
    "aria-invalid={Boolean(error)}",
    'role="alert"',
    "disabled={busy || !message.trim()}",
  ]);
  assert.equal(appSource.includes("Open-Meteo ready"), false);
});

test("client source contains no mojibake markers", () => {
  assert.equal(appSource.includes("Â"), false);
  assert.equal(appSource.includes("â€¦"), false);
});

test("polished workspace exposes semantic navigation and honest progress feedback", () => {
  assertIncludesAll(appSource, [
    'aria-label="Planning workspace"',
    'className="workflow-tabs"',
    "Farm advisor",
    "Crop ranking",
    "Season roadmap",
    "Evidence & trace",
    "AgentRunMessage",
    'tabIndex={result ? undefined : -1}',
  ]);
  assert.equal(appSource.includes("aria-valuenow"), false);
  assert.equal(appSource.includes("setInterval"), false);
  assert.equal(appSource.includes('className="pipeline"'), false);
});

test("visual system includes high-contrast tokens, keyboard focus, and reduced motion", () => {
  assertIncludesAll(compactCss, [
    "--bg-app:",
    "--emerald-primary:",
    "--text-main:",
    ".workflow-tabs",
    ":focus-visible",
    "@media(prefers-reduced-motion:reduce)",
  ]);
});

test("narrow layouts contain flex, grid, and long-content overflow", () => {
  assertIncludesAll(compactCss, [
    "body{margin:0;max-width:100%;overflow-x:hidden}",
    "main,.layout,.panel,.hero,.status,form,input,pre{min-width:0}",
    "input{width:100%;max-width:100%",
    "a,p,small,dd{overflow-wrap:anywhere}",
    "@media(max-width:480px)",
    "header,form{flex-direction:column;align-items:stretch}",
    "dl{grid-template-columns:1fr}",
  ]);
});

test("Tier 1 client exposes streamed in-chat runs, persistent memory, and scheduler", () => {
  assertIncludesAll(appSource, [
    'import AgentRunMessage from "./components/AgentRunMessage.jsx"',
    'import Markdown from "./components/Markdown.jsx"',
    'import EvidenceGroupList from "./components/EvidenceGroupList.jsx"',
    'import { createRunPresenter } from "./run-presenter.js"',
    "createAgentRun",
    "appendRunEvent",
    "completeAgentRun",
    "failAgentRun",
    "cancelAgentRun",
    'import { consumeNdjsonStream } from "./stream.js"',
    'import { applyTheme, loadThemePreference, persistThemePreference } from "./theme.js"',
    'fetch("/api/session/message/stream"',
    "Saved farm memory",
    "Create private memory",
    "Resume memory",
    "Forget memory",
    "Fertilizer & irrigation scheduler",
    "AbortController",
    'type="date"',
    "Process-memory mode: saved memory lasts only until this server restarts.",
    "Auto-adjust irrigation when forecast rain conflicts",
    "disabled={busy}",
    "View saved memory",
    'fetch("/api/memory/preferences"',
    "Evidence & safety details",
    "Quantity omitted",
    'aria-label="Theme"',
    "<AgentRunMessage",
    "<EvidenceGroupList",
  ]);
});

test("Markdown component preserves GFM, blocks HTML, and hardens external links", () => {
  assertIncludesAll(markdownSource, [
    'import ReactMarkdown from "react-markdown"',
    'import remarkGfm from "remark-gfm"',
    "skipHtml",
    "remarkPlugins={[remarkGfm]}",
    'target="_blank"',
    'rel="noreferrer"',
  ]);
});

test("agent run stays inside one assistant message with accessible terminal controls", () => {
  assertIncludesAll(appSource, [
    "run:",
    "updateConversationRun",
    "presenter.drain()",
    "await wait(600)",
    "setResult(data)",
  ]);
  assertIncludesAll(runMessageSource, [
    "Plan completed",
    "steps",
    "toggleRunCollapsed",
    "aria-expanded",
    "<Markdown>{run.answer}</Markdown>",
    "Cancel request",
    "Retry request",
    "Why this plan",
  ]);
  assert.equal(appSource.includes("setConversation((items) => [...items, { role: \"agent\", text: assistantText(data.assistant) }]"), false);
});

test("intake-only completions never claim that a plan was generated", () => {
  assertIncludesAll(appSource, [
    'outcome: data.crops ? "plan" : "intake"',
    'latestRun.outcome === "plan"',
    "Farm details requested",
  ]);
  assertIncludesAll(runMessageSource, [
    'run.outcome === "plan"',
    "Plan completed",
    "Request completed",
  ]);
});

test("only the latest terminal run can expose the global retry action", () => {
  assertIncludesAll(appSource, [
    "retryAvailable={item.run.id === latestRun?.id}",
    "onRetry={retryLastRequest}",
  ]);
  assertIncludesAll(runMessageSource, [
    "retryAvailable = false",
    "retryAvailable &&",
  ]);
});

test("activity is chat-native and no standalone feed or global activity state remains", () => {
  assert.equal(appSource.includes("function ActivityFeed"), false);
  assert.equal(appSource.includes("<ActivityFeed"), false);
  assert.equal(appSource.includes('id="activity"'), false);
  assert.equal(appSource.includes("const [activities, setActivities]"), false);
});

test("run rendering exposes sanitized summaries but no private raw chain-of-thought", () => {
  assertIncludesAll(runMessageSource, [
    "reasoningSummaries",
    "Why this plan",
    "safeHttpUrl",
    "humanizeFieldName",
  ]);
  assert.equal(runMessageSource.includes("chainOfThought"), false);
  assert.equal(runMessageSource.includes("rawReasoning"), false);
  assert.equal(runMessageSource.includes("JSON.stringify(event.details"), false);
});

test("grouped evidence renders one canonical link and retains record metadata", () => {
  assertIncludesAll(evidenceListSource, [
    'import { groupEvidenceRecords } from "../evidence.js"',
    "matching records",
    "group.canonicalUrl",
    "group.records.map",
    "recordMetadata",
    'target="_blank"',
    'rel="noreferrer"',
  ]);
  assert.equal(evidenceListSource.includes("record.url"), false);
  assert.equal(evidenceListSource.includes("record.sourceUrl"), false);
});

test("Tier 1 visual contracts include independent cards and complete light/dark tokens", () => {
  assertIncludesAll(compactCss, [
    ".cards{align-items:start;",
    ".cardsarticle{align-self:start;",
    '[data-theme="dark"]',
    '@media(prefers-color-scheme:dark)',
    ".activity-list",
    ".memory-panel",
    ".schedule-grid",
    ".markdown",
  ]);
});
