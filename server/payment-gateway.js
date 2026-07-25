export class PaymentGatewayError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = "PaymentGatewayError";
    this.status = status;
  }
}

function safeUrl(value, label) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error(`${label} must use HTTPS outside local development.`);
  }
  return url;
}

export function normalizePaymentGatewayConfig({ serviceUrl, dashboardUrl }) {
  const service = safeUrl(serviceUrl, "Payment service URL").toString().replace(/\/$/, "");
  const dashboard = safeUrl(dashboardUrl, "Payment dashboard URL").toString();
  return { serviceUrl: service, dashboardUrl: dashboard };
}

export function createPaymentGateway({
  serviceUrl,
  dashboardUrl,
  adminToken = "",
  fetchImpl = globalThis.fetch,
  timeoutMs = 5_000,
  now = () => Date.now(),
}) {
  const config = normalizePaymentGatewayConfig({ serviceUrl, dashboardUrl });
  return {
    async health() {
      const startedAt = now();
      try {
        const response = await fetchImpl(`${config.serviceUrl}/health`, {
          method: "GET",
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) throw new Error("unhealthy");
        const payload = await response.json();
        if (payload?.status !== "ok") throw new Error("unhealthy");
        return {
          available: true,
          service: String(payload.service || "agrisense-bdapps"),
          provider: "bdapps",
          dashboardUrl: config.dashboardUrl,
          latencyMs: Math.max(0, now() - startedAt),
        };
      } catch {
        throw new PaymentGatewayError("Payment gateway health check failed.");
      }
    },
    async cancelSubscription(mobile) {
      if (!adminToken) throw new PaymentGatewayError("Subscription management is not configured.");
      try {
        const response = await fetchImpl(`${config.serviceUrl}/subscription/unsubscribe`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ mobile }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.statusCode !== "S1000") throw new Error("rejected");
        return { cancelled: true };
      } catch {
        throw new PaymentGatewayError("Subscription cancellation failed.");
      }
    },
    async chargeDaily({ mobile, amount, externalTrxId }) {
      if (!adminToken) throw new PaymentGatewayError("Daily billing is not configured.");
      try {
        const response = await fetchImpl(`${config.serviceUrl}/caas/direct-debit`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ mobile, amount, externalTrxId, confirmCharge: true }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || (payload?.transactionState !== "SUCCEEDED" && payload?.statusCode !== "S1000")) {
          throw new Error("rejected");
        }
        return {
          transactionState: "SUCCEEDED",
          statusCode: String(payload.statusCode || "S1000"),
        };
      } catch {
        throw new PaymentGatewayError("Daily access payment failed.", 402);
      }
    },
  };
}
