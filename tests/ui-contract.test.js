import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
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
    'send({ profilePatch: DEMO_PROFILE, startDate: planStartDate }, fresh.sessionId, { memoryId: "" })',
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
    'role="progressbar"',
    "Generating your grounded plan",
    'tabIndex={result ? undefined : -1}',
  ]);
  assert.equal(appSource.includes("aria-valuenow"), false);
  assert.equal(appSource.includes("setInterval"), false);
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

test("Tier 1 client exposes streamed activity, persistent memory, scheduler, and safe Markdown", () => {
  assertIncludesAll(appSource, [
    'import ReactMarkdown from "react-markdown"',
    'import remarkGfm from "remark-gfm"',
    'import { consumeNdjsonStream } from "./stream.js"',
    'import { applyTheme, loadThemePreference, persistThemePreference } from "./theme.js"',
    'fetch("/api/session/message/stream"',
    "Saved farm memory",
    "Create private memory",
    "Resume memory",
    "Forget memory",
    "Fertilizer & irrigation scheduler",
    "Agent activity",
    "reasoning summary",
    "AbortController",
    "Cancel request",
    "Retry last request",
    'type="date"',
    "Process-memory mode: saved memory lasts only until this server restarts.",
    "Auto-adjust irrigation when forecast rain conflicts",
    "disabled={busy}",
    "View saved memory",
    'fetch("/api/memory/preferences"',
    "Evidence & safety details",
    "Quantity omitted",
    "skipHtml",
    "remarkPlugins={[remarkGfm]}",
    'aria-label="Theme"',
  ]);
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
