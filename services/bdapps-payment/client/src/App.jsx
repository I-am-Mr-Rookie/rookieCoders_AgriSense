import { Fragment, useState } from "react";

const TRANSACTION_PAGE_SIZE = 15;
const EVENT_PAGE_SIZE = 15;

function normalizeOperatorToken(value) {
  let token = value.trim();
  token = token.replace(/^PAYMENT_ADMIN_TOKEN\s*=\s*/i, "");
  token = token.replace(/^Authorization\s*:\s*Bearer\s+/i, "");
  token = token.replace(/^Bearer\s+/i, "");
  return token.replace(/^(["'])(.*)\1$/, "$2").trim();
}

async function api(path, body, operatorToken) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(operatorToken ? { authorization: `Bearer ${operatorToken}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({ error: `Request failed with HTTP ${response.status}` }));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.data = data;
    throw error;
  }
  return data;
}

function Field({ label, value, onChange, placeholder, type = "text", ...inputProps }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} {...inputProps} />
    </label>
  );
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(date);
}

function formatAmount(value, currency = "BDT") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `${currency} ${amount.toFixed(2)}`;
}

function displaySubscriber(value) {
  return value ? String(value).replace(/^tel:/, "") : "—";
}

function StateBadge({ state }) {
  const normalized = String(state || "UNKNOWN").toUpperCase();
  return <span className={`status-badge status-${normalized.toLowerCase()}`}>{normalized}</span>;
}

function JsonBlock({ value }) {
  return <pre className="json-block">{JSON.stringify(value ?? {}, null, 2)}</pre>;
}

function Pagination({ offset, limit, total, onChange, disabled }) {
  const first = total ? offset + 1 : 0;
  const last = Math.min(offset + limit, total);
  return (
    <div className="pagination" aria-label="Pagination">
      <span>{first}–{last} of {total}</span>
      <div>
        <button className="button button-quiet" disabled={disabled || offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>Previous</button>
        <button className="button button-quiet" disabled={disabled || offset + limit >= total} onClick={() => onChange(offset + limit)}>Next</button>
      </div>
    </div>
  );
}

function LoadingRows({ columns }) {
  return Array.from({ length: 5 }, (_, index) => (
    <tr key={index} className="loading-row" aria-hidden="true">
      {Array.from({ length: columns }, (_, column) => <td key={column}><span className="skeleton" /></td>)}
    </tr>
  ));
}

export default function App() {
  const [operatorToken, setOperatorToken] = useState("");
  const [operatorConnected, setOperatorConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeView, setActiveView] = useState("transactions");

  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [transactionOffset, setTransactionOffset] = useState(0);
  const [transactionQuery, setTransactionQuery] = useState("");
  const [transactionState, setTransactionState] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const [events, setEvents] = useState([]);
  const [eventTotal, setEventTotal] = useState(0);
  const [eventOffset, setEventOffset] = useState(0);
  const [eventQuery, setEventQuery] = useState("");
  const [eventType, setEventType] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [mobile, setMobile] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmCharge, setConfirmCharge] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [result, setResult] = useState({ ready: true });

  function updateOperatorToken(value) {
    setOperatorToken(value);
    setOperatorConnected(false);
    setDashboardError("");
  }

  function transactionPath({ offset = transactionOffset, state = transactionState, query = transactionQuery } = {}) {
    const params = new URLSearchParams({ limit: String(TRANSACTION_PAGE_SIZE), offset: String(offset) });
    if (state) params.set("state", state);
    if (query.trim()) params.set("query", query.trim());
    return `/api/bdapps/caas/transactions?${params}`;
  }

  function eventPath({ offset = eventOffset, type = eventType, query = eventQuery } = {}) {
    const params = new URLSearchParams({ limit: String(EVENT_PAGE_SIZE), offset: String(offset) });
    if (type) params.set("type", type);
    if (query.trim()) params.set("query", query.trim());
    return `/api/bdapps/events?${params}`;
  }

  async function loadDashboard(token = operatorToken, options = {}) {
    const normalizedToken = normalizeOperatorToken(token);
    if (!normalizedToken) return;
    const nextTransactionOffset = options.transactionOffset ?? transactionOffset;
    const nextEventOffset = options.eventOffset ?? eventOffset;
    const nextTransactionState = options.transactionState ?? transactionState;
    const nextEventType = options.eventType ?? eventType;
    setDashboardLoading(true);
    setDashboardError("");
    try {
      const [summaryData, transactionData, eventData] = await Promise.all([
        api("/api/bdapps/dashboard/summary", undefined, normalizedToken),
        api(transactionPath({ offset: nextTransactionOffset, state: nextTransactionState }), undefined, normalizedToken),
        api(eventPath({ offset: nextEventOffset, type: nextEventType }), undefined, normalizedToken)
      ]);
      setSummary(summaryData.summary);
      setTransactions(transactionData.transactions);
      setTransactionTotal(transactionData.total);
      setTransactionOffset(transactionData.offset);
      setEvents(eventData.events);
      setEventTotal(eventData.total);
      setEventOffset(eventData.offset);
      setLastUpdated(new Date());
    } catch (error) {
      setDashboardError(error.data?.error || error.message);
      if (error.data?.error === "Operator authorization required") setOperatorConnected(false);
      throw error;
    } finally {
      setDashboardLoading(false);
    }
  }

  async function loadTransactions(options = {}) {
    const normalizedToken = normalizeOperatorToken(operatorToken);
    const nextOffset = options.offset ?? transactionOffset;
    const nextState = options.state ?? transactionState;
    const nextQuery = options.query ?? transactionQuery;
    setDashboardLoading(true);
    setDashboardError("");
    try {
      const data = await api(transactionPath({ offset: nextOffset, state: nextState, query: nextQuery }), undefined, normalizedToken);
      setTransactions(data.transactions);
      setTransactionTotal(data.total);
      setTransactionOffset(data.offset);
      setSelectedTransaction(null);
      setLastUpdated(new Date());
    } catch (error) {
      setDashboardError(error.data?.error || error.message);
    } finally {
      setDashboardLoading(false);
    }
  }

  async function loadEvents(options = {}) {
    const normalizedToken = normalizeOperatorToken(operatorToken);
    const nextOffset = options.offset ?? eventOffset;
    const nextType = options.type ?? eventType;
    const nextQuery = options.query ?? eventQuery;
    setDashboardLoading(true);
    setDashboardError("");
    try {
      const data = await api(eventPath({ offset: nextOffset, type: nextType, query: nextQuery }), undefined, normalizedToken);
      setEvents(data.events);
      setEventTotal(data.total);
      setEventOffset(data.offset);
      setSelectedEvent(null);
      setLastUpdated(new Date());
    } catch (error) {
      setDashboardError(error.data?.error || error.message);
    } finally {
      setDashboardLoading(false);
    }
  }

  async function connectOperator() {
    const token = normalizeOperatorToken(operatorToken);
    if (!token) {
      setResult({ error: "Paste the server operator token before connecting" });
      return;
    }
    setBusy(true);
    try {
      setOperatorToken(token);
      await loadDashboard(token, { transactionOffset: 0, eventOffset: 0 });
      setOperatorConnected(true);
      setResult({ status: "connected", message: "Operator authorization succeeded" });
    } catch (error) {
      setOperatorConnected(false);
      setResult(error.data || { error: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function run(path, body) {
    if (!operatorConnected) {
      setResult({ error: "Connect with a valid operator token before using operator actions" });
      return;
    }
    setBusy(true);
    try {
      const data = await api(path, body, normalizeOperatorToken(operatorToken));
      setResult(data);
      if (data.referenceNo) setReferenceNo(data.referenceNo);
      if (data.externalTrxId) setTransactionId(data.externalTrxId);
      if (path === "/api/bdapps/caas/direct-debit") setConfirmCharge(false);
      try { await loadDashboard(operatorToken, { transactionOffset: 0, eventOffset: 0 }); }
      catch { /* Keep the successful operator result visible if dashboard refresh fails. */ }
    } catch (error) {
      setResult(error.data || { error: error.message });
      if (error.data?.payment?.externalTrxId) setTransactionId(error.data.payment.externalTrxId);
      if (error.data?.error === "Operator authorization required") setOperatorConnected(false);
    } finally {
      setBusy(false);
    }
  }

  const transactionStateFromResult = result.transactionState || result.payment?.transactionState || result.transaction?.state;
  const displayedResult = result.receipt || result.payment?.receipt || result;
  const attentionCount = summary
    ? Number(summary.failedTransactions || 0) + Number(summary.unknownTransactions || 0) + Number(summary.pendingTransactions || 0)
    : 0;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">A</span>
          <div>
            <p className="product-name">AgriSense payments</p>
            <h1>Operations dashboard</h1>
          </div>
        </div>
        <div className="environment-block" aria-label="Environment">
          <span className="live-dot" aria-hidden="true" />
          <div><strong>Production</strong><small>DigitalOcean · PostgreSQL</small></div>
        </div>
      </header>

      <section className="access-panel" aria-labelledby="access-title">
        <div>
          <h2 id="access-title">Operator access</h2>
          <p>The token stays in memory for this page session and protects every database and payment request.</p>
        </div>
        <div className="access-controls">
          <Field label="Operator token" value={operatorToken} onChange={updateOperatorToken} placeholder="Paste token, PAYMENT_ADMIN_TOKEN=..., or Bearer ..." type="password" autoComplete="off" />
          <button className="button button-primary" disabled={!operatorToken.trim() || busy} onClick={connectOperator}>{busy ? "Connecting…" : operatorConnected ? "Connected" : "Connect"}</button>
        </div>
        <p className={`connection-status ${operatorConnected ? "connected" : "disconnected"}`} aria-live="polite">
          {operatorConnected ? "Authorized. Live database records are available." : "Connect to load production transaction history and callback logs."}
        </p>
      </section>

      <section className="monitor" aria-labelledby="monitor-title">
        <div className="section-heading">
          <div>
            <p className="section-context">PostgreSQL operational ledger</p>
            <h2 id="monitor-title">Transaction history and logs</h2>
          </div>
          <div className="refresh-block">
            <span>{lastUpdated ? `Updated ${formatDate(lastUpdated)}` : "Not loaded"}</span>
            <button className="button button-secondary" disabled={!operatorConnected || dashboardLoading} onClick={() => loadDashboard()}>{dashboardLoading ? "Refreshing…" : "Refresh data"}</button>
          </div>
        </div>

        {dashboardError && <div className="alert alert-error" role="alert">{dashboardError}</div>}

        <div className="ledger" aria-label="Payment database summary">
          <div><span>Total transactions</span><strong>{summary?.totalTransactions ?? "—"}</strong></div>
          <div><span>Settled volume</span><strong>{summary ? formatAmount(summary.succeededAmount) : "—"}</strong></div>
          <div><span>Successful</span><strong>{summary?.succeededTransactions ?? "—"}</strong></div>
          <div><span>Needs attention</span><strong className={attentionCount ? "attention" : ""}>{summary ? attentionCount : "—"}</strong></div>
          <div><span>Callback logs</span><strong>{summary?.totalEvents ?? "—"}</strong></div>
        </div>

        <div className="view-tabs" role="tablist" aria-label="Dashboard records">
          <button role="tab" aria-selected={activeView === "transactions"} className={activeView === "transactions" ? "active" : ""} onClick={() => setActiveView("transactions")}>Transactions <span>{transactionTotal}</span></button>
          <button role="tab" aria-selected={activeView === "events"} className={activeView === "events" ? "active" : ""} onClick={() => setActiveView("events")}>Callback logs <span>{eventTotal}</span></button>
        </div>

        {activeView === "transactions" ? (
          <div className="data-panel" role="tabpanel">
            <form className="filterbar" onSubmit={(event) => { event.preventDefault(); loadTransactions({ offset: 0 }); }}>
              <label className="search-field"><span>Search transactions</span><input value={transactionQuery} onChange={(event) => setTransactionQuery(event.target.value)} placeholder="Transaction ID, subscriber, provider code…" /></label>
              <label className="select-field"><span>State</span><select value={transactionState} onChange={(event) => { const value = event.target.value; setTransactionState(value); loadTransactions({ offset: 0, state: value }); }}><option value="">All states</option><option value="SUCCEEDED">Succeeded</option><option value="FAILED">Failed</option><option value="UNKNOWN">Unknown</option><option value="PENDING">Pending</option></select></label>
              <button className="button button-secondary" disabled={!operatorConnected || dashboardLoading} type="submit">Apply filters</button>
            </form>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Updated</th><th>Subscriber</th><th>Amount</th><th>State</th><th>Provider</th><th>Transaction ID</th><th><span className="visually-hidden">Details</span></th></tr></thead>
                <tbody>
                  {dashboardLoading && !transactions.length ? <LoadingRows columns={7} /> : transactions.map((transaction) => (
                    <Fragment key={transaction.externalTrxId}>
                      <tr>
                        <td className="nowrap">{formatDate(transaction.updatedAt)}</td>
                        <td className="mono">{displaySubscriber(transaction.subscriberId)}</td>
                        <td className="amount-cell">{formatAmount(transaction.amount, transaction.currency)}</td>
                        <td><StateBadge state={transaction.state} /></td>
                        <td><strong>{transaction.statusCode || "—"}</strong><small>{transaction.statusDetail || "No provider detail"}</small></td>
                        <td className="mono transaction-id" title={transaction.externalTrxId}>{transaction.externalTrxId}</td>
                        <td><button className="text-button" aria-expanded={selectedTransaction === transaction.externalTrxId} onClick={() => setSelectedTransaction(selectedTransaction === transaction.externalTrxId ? null : transaction.externalTrxId)}>{selectedTransaction === transaction.externalTrxId ? "Close" : "Inspect"}</button></td>
                      </tr>
                      {selectedTransaction === transaction.externalTrxId && (
                        <tr className="detail-row"><td colSpan="7"><div className="record-detail">
                          <dl>
                            <div><dt>External ID</dt><dd className="mono">{transaction.externalTrxId}</dd></div>
                            <div><dt>Internal ID</dt><dd className="mono">{transaction.internalTrxId || "—"}</dd></div>
                            <div><dt>Attempts</dt><dd>{transaction.attemptCount}</dd></div>
                            <div><dt>Created</dt><dd>{formatDate(transaction.createdAt)}</dd></div>
                            <div><dt>Last error</dt><dd>{transaction.lastError || "None"}</dd></div>
                          </dl>
                          <div className="payload-grid"><section><h3>Request persisted before provider call</h3><JsonBlock value={transaction.requestPayload} /></section><section><h3>Provider response</h3><JsonBlock value={transaction.responsePayload} /></section></div>
                        </div></td></tr>
                      )}
                    </Fragment>
                  ))}
                  {!dashboardLoading && operatorConnected && !transactions.length && <tr><td colSpan="7"><div className="empty-state"><strong>No matching transactions</strong><span>Clear the filters or search using the full subscriber or transaction ID.</span></div></td></tr>}
                  {!operatorConnected && <tr><td colSpan="7"><div className="empty-state"><strong>Connect operator access</strong><span>Production records remain protected until a valid token is supplied.</span></div></td></tr>}
                </tbody>
              </table>
            </div>
            <Pagination offset={transactionOffset} limit={TRANSACTION_PAGE_SIZE} total={transactionTotal} disabled={dashboardLoading || !operatorConnected} onChange={(offset) => loadTransactions({ offset })} />
          </div>
        ) : (
          <div className="data-panel" role="tabpanel">
            <form className="filterbar" onSubmit={(event) => { event.preventDefault(); loadEvents({ offset: 0 }); }}>
              <label className="search-field"><span>Search callback payloads</span><input value={eventQuery} onChange={(event) => setEventQuery(event.target.value)} placeholder="Request ID, subscriber, transaction…" /></label>
              <label className="select-field"><span>Event type</span><select value={eventType} onChange={(event) => { const value = event.target.value; setEventType(value); loadEvents({ offset: 0, type: value }); }}><option value="">All event types</option><option value="caas.notification">CaaS notification</option><option value="sms.received">SMS received</option><option value="sms.delivery">SMS delivery</option><option value="subscription.changed">Subscription changed</option><option value="ussd.received">USSD received</option></select></label>
              <button className="button button-secondary" disabled={!operatorConnected || dashboardLoading} type="submit">Apply filters</button>
            </form>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Received</th><th>Event</th><th>Subscriber</th><th>Request / transaction</th><th><span className="visually-hidden">Details</span></th></tr></thead>
                <tbody>
                  {dashboardLoading && !events.length ? <LoadingRows columns={5} /> : events.map((event) => (
                    <Fragment key={event.id}>
                      <tr>
                        <td className="nowrap">{formatDate(event.receivedAt)}</td>
                        <td><strong>{event.eventType}</strong></td>
                        <td className="mono">{displaySubscriber(event.subscriberId)}</td>
                        <td className="mono">{event.requestId || "—"}</td>
                        <td><button className="text-button" aria-expanded={selectedEvent === event.id} onClick={() => setSelectedEvent(selectedEvent === event.id ? null : event.id)}>{selectedEvent === event.id ? "Close" : "Inspect"}</button></td>
                      </tr>
                      {selectedEvent === event.id && <tr className="detail-row"><td colSpan="5"><div className="record-detail"><div className="detail-heading"><div><span>Database event #{event.id}</span><strong>{event.eventType}</strong></div><time>{formatDate(event.receivedAt)}</time></div><JsonBlock value={event.payload} /></div></td></tr>}
                    </Fragment>
                  ))}
                  {!dashboardLoading && operatorConnected && !events.length && <tr><td colSpan="5"><div className="empty-state"><strong>No matching callback logs</strong><span>Callbacks appear here after bdapps posts to the production notification endpoints.</span></div></td></tr>}
                  {!operatorConnected && <tr><td colSpan="5"><div className="empty-state"><strong>Connect operator access</strong><span>Callback payloads are protected because they may contain subscriber identifiers.</span></div></td></tr>}
                </tbody>
              </table>
            </div>
            <Pagination offset={eventOffset} limit={EVENT_PAGE_SIZE} total={eventTotal} disabled={dashboardLoading || !operatorConnected} onChange={(offset) => loadEvents({ offset })} />
          </div>
        )}
      </section>

      <details className="operator-tools">
        <summary><span><strong>Operator tools</strong><small>OTP, messaging, subscription, and real CaaS debit controls</small></span><span aria-hidden="true">+</span></summary>
        <div className="tools-body">
          <div className="risk-note"><strong>Production actions</strong><span>These controls call the live bdapps application. Direct debit requires an explicit amount confirmation.</span></div>
          <section className="tool-grid">
            <article>
              <h2>Subscriber</h2>
              <Field label="Mobile" value={mobile} onChange={setMobile} placeholder="01812345678" />
              <div className="actions"><button className="button button-primary" disabled={busy || !operatorConnected} onClick={() => run("/api/bdapps/otp/request", { mobile })}>Request OTP</button><button className="button button-secondary" disabled={busy || !operatorConnected} onClick={() => run("/api/bdapps/subscription/status", { mobile })}>Check status</button><button className="button button-secondary" disabled={busy || !operatorConnected} onClick={() => run("/api/bdapps/subscription/unsubscribe", { mobile })}>Unsubscribe</button></div>
              <Field label="Reference" value={referenceNo} onChange={setReferenceNo} placeholder="Returned by OTP request" />
              <Field label="OTP" value={otp} onChange={setOtp} placeholder="123456" inputMode="numeric" />
              <button className="button button-primary" disabled={busy || !operatorConnected} onClick={() => run("/api/bdapps/otp/verify", { referenceNo, otp })}>Verify OTP</button>
            </article>
            <article>
              <h2>SMS alert</h2>
              <Field label="Destination" value={mobile} onChange={setMobile} placeholder="01812345678" />
              <label className="field"><span>Message</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Heavy rain expected after 6 PM." /></label>
              <button className="button button-primary" disabled={busy || !operatorConnected} onClick={() => run("/api/bdapps/sms/send", { mobile, message, deliveryStatusRequest: true })}>Send SMS</button>
            </article>
            <article>
              <h2>CaaS direct debit</h2>
              <Field label="Subscriber" value={mobile} onChange={setMobile} placeholder="01812345678" />
              <Field label="Amount (BDT)" value={amount} onChange={setAmount} placeholder="5.00 to 100.00" type="number" min="5" max="100" step="0.01" />
              <p className="hint">Provisioned range: 5.00–100.00 BDT. Subscription is not required for this application.</p>
              <label className="confirmation"><input type="checkbox" checked={confirmCharge} onChange={(event) => setConfirmCharge(event.target.checked)} /><span>I confirm this will charge the subscriber the exact amount shown.</span></label>
              <div className="actions"><button className="button button-secondary" disabled={busy || !operatorConnected} onClick={() => run("/api/bdapps/caas/balance", { mobile })}>Query balance</button><button className="button button-secondary" disabled={busy || !operatorConnected} onClick={() => run("/api/bdapps/caas/payment-instruments", { mobile })}>List instruments</button><button className="button button-danger" disabled={busy || !operatorConnected || !confirmCharge || !amount} onClick={() => run("/api/bdapps/caas/direct-debit", { mobile, amount, confirmCharge: true })}>Charge subscriber</button></div>
              <Field label="Transaction ID" value={transactionId} onChange={setTransactionId} placeholder="Filled after a charge attempt" />
              <button className="button button-secondary" disabled={busy || !operatorConnected || !transactionId} onClick={() => run(`/api/bdapps/caas/transactions/${encodeURIComponent(transactionId)}`)}>Check transaction</button>
            </article>
          </section>
          <section className="response-panel"><div className="response-heading"><h2>Latest operator response</h2>{transactionStateFromResult && <StateBadge state={transactionStateFromResult} />}</div><JsonBlock value={displayedResult} /></section>
        </div>
      </details>
    </main>
  );
}
