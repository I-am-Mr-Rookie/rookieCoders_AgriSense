import { AUTH_COOKIE, parseCookieHeader } from "./auth-http.js";

export function createPaymentStatusHandler(gateway) {
  return async (_request, response) => {
    try {
      const status = await gateway.health();
      response.json({
        available: true,
        service: status.service,
        provider: status.provider,
        latencyMs: status.latencyMs,
      });
    } catch {
      response.status(503).json({
        available: false,
        provider: "bdapps",
        error: "Payment service is temporarily unavailable.",
        recoverable: true,
      });
    }
  };
}

export function createSubscriptionCancelHandler({ authService, gateway }) {
  return async (request, response) => {
    try {
      const cookies = parseCookieHeader(request.get?.("cookie") || request.headers?.cookie || "");
      const mobile = await authService.getSubscriber(cookies[AUTH_COOKIE] || "");
      await gateway.cancelSubscription(mobile);
      response.json({ cancelled: true, subscriptionStatus: "CANCELLED" });
    } catch (error) {
      const status = Number(error?.status) || 503;
      response.status(status).json({
        error: status === 401
          ? "Sign in to manage your subscription."
          : "Subscription could not be cancelled right now.",
        code: status === 401 ? "AUTH_REQUIRED" : "CANCEL_UNAVAILABLE",
        recoverable: true,
      });
    }
  };
}
