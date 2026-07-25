import { randomUUID, timingSafeEqual } from "node:crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { BdappsError } from "./bdapps-client.js";
import { toSubscriberId } from "./phone.js";

const asyncRoute = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);

function requiredString(body, name) {
  const value = body?.[name];
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error(`${name} is required`);
    error.status = 400;
    throw error;
  }
  return value.trim();
}

function optionalString(body, name) {
  const value = body?.[name];
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error(`${name} must be a non-empty string`);
    error.status = 400;
    throw error;
  }
  return value.trim();
}

function queryInteger(value, name, fallback, maximum) {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    const error = new Error(`${name} must be a non-negative integer`);
    error.status = 400;
    throw error;
  }
  const numericValue = Number.parseInt(value, 10);
  if (numericValue > maximum) {
    const error = new Error(`${name} must not exceed ${maximum}`);
    error.status = 400;
    throw error;
  }
  return numericValue;
}

function optionalQueryString(value, name, maximumLength = 100) {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error(`${name} must be a non-empty string`);
    error.status = 400;
    throw error;
  }
  const normalized = value.trim();
  if (normalized.length > maximumLength) {
    const error = new Error(`${name} must not exceed ${maximumLength} characters`);
    error.status = 400;
    throw error;
  }
  return normalized;
}

function otpApplicationMetadata(value) {
  if (value != null && (typeof value !== "object" || Array.isArray(value))) {
    const error = new Error("applicationMetaData must be an object");
    error.status = 400;
    throw error;
  }
  return {
    client: "WEBAPP",
    device: "Web Browser",
    os: "Web",
    appCode: "https://rookiecoders.tech/payments/",
    ...(value || {})
  };
}

function requireProviderSuccess(result) {
  if (result?.statusCode && result.statusCode !== "S1000") {
    throw new BdappsError(result.statusDetail || `bdapps rejected the request with ${result.statusCode}`, {
      status: 422,
      response: result
    });
  }
  return result;
}

function requireOperatorToken(expectedToken) {
  return (request, response, next) => {
    if (!expectedToken) {
      response.status(503).json({ error: "Payment operator access is not configured" });
      return;
    }
    const authorization = request.get("authorization") || "";
    const [scheme, suppliedToken = ""] = authorization.split(/\s+/, 2);
    const expected = Buffer.from(expectedToken);
    const supplied = Buffer.from(suppliedToken);
    const authorized = scheme === "Bearer"
      && expected.length === supplied.length
      && timingSafeEqual(expected, supplied);
    if (!authorized) {
      response.set("www-authenticate", 'Bearer realm="agrisense-payment"');
      response.status(401).json({ error: "Operator authorization required" });
      return;
    }
    next();
  };
}

function paymentReceipt(requestPayload, providerResponse, state) {
  return {
    externalTrxId: requestPayload.externalTrxId,
    internalTrxId: providerResponse.internalTrxId ?? null,
    referenceId: providerResponse.referenceId ?? null,
    amount: requestPayload.amount,
    currency: requestPayload.currency,
    statusCode: providerResponse.statusCode ?? null,
    statusDetail: providerResponse.statusDetail ?? null,
    state,
    providerTimeStamp: providerResponse.timeStamp ?? null,
    recordedAt: new Date().toISOString()
  };
}

function callback(eventType, repository) {
  return asyncRoute(async (request, response) => {
    await repository.recordEvent(eventType, request.body);
    response.json({ statusCode: "S1000", statusDetail: "Success" });
  });
}

export function createApp({
  bdapps,
  repository,
  clientOrigin = "http://127.0.0.1:3000",
  adminToken = "",
  minChargeAmount = "5.00",
  maxChargeAmount = "100.00",
  caasSubscriptionRequired = false
}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: clientOrigin }));
  app.use(express.json({ limit: "32kb", type: ["application/json", "application/*+json"] }));

  const health = asyncRoute(async (_request, response) => {
    await repository.health();
    response.json({ status: "ok", service: "agrisense-bdapps" });
  });
  app.get("/health", health);
  app.get("/api/health", health);
  app.get("/api/bdapps/health", health);

  app.post("/api/bdapps/webhooks/sms", callback("sms.received", repository));
  app.post("/api/bdapps/webhooks/sms-delivery", callback("sms.delivery", repository));
  app.post("/api/bdapps/webhooks/ussd", callback("ussd.received", repository));
  app.post("/api/bdapps/webhooks/subscription", callback("subscription.changed", repository));
  app.post("/api/bdapps/webhooks/caas", callback("caas.notification", repository));
  app.post("/api/bdapps/caas/notify", callback("caas.notification", repository));

  app.use("/api/bdapps", requireOperatorToken(adminToken));

  app.post("/api/bdapps/otp/request", asyncRoute(async (request, response) => {
    const subscriberId = toSubscriberId(requiredString(request.body, "mobile"));
    const result = requireProviderSuccess(await bdapps.requestOtp({
      subscriberId,
      applicationHash: request.body.applicationHash,
      applicationMetaData: otpApplicationMetadata(request.body.applicationMetaData)
    }));
    await repository.saveOtpRequest({
      referenceNo: result.referenceNo,
      subscriberId,
      statusCode: result.statusCode
    });
    response.json(result);
  }));

  app.post("/api/bdapps/otp/verify", asyncRoute(async (request, response) => {
    const referenceNo = requiredString(request.body, "referenceNo");
    const otp = requiredString(request.body, "otp");
    if (!/^\d{4,8}$/.test(otp)) {
      const error = new Error("otp must contain 4 to 8 digits");
      error.status = 400;
      throw error;
    }
    const result = requireProviderSuccess(await bdapps.verifyOtp({ referenceNo, otp }));
    await repository.markOtpVerified(referenceNo, result);
    response.json(result);
  }));

  app.post("/api/bdapps/subscription/status", asyncRoute(async (request, response) => {
    response.json(await bdapps.getSubscriptionStatus(toSubscriberId(requiredString(request.body, "mobile"))));
  }));

  app.post("/api/bdapps/subscription/subscribe", asyncRoute(async (request, response) => {
    response.json(await bdapps.setSubscription(toSubscriberId(requiredString(request.body, "mobile")), true));
  }));

  app.post("/api/bdapps/subscription/unsubscribe", asyncRoute(async (request, response) => {
    response.json(await bdapps.setSubscription(toSubscriberId(requiredString(request.body, "mobile")), false));
  }));

  app.post("/api/bdapps/sms/send", asyncRoute(async (request, response) => {
    const message = requiredString(request.body, "message");
    let destinationAddresses;
    if (request.body.broadcast === true) destinationAddresses = ["tel:all"];
    else {
      const destinations = Array.isArray(request.body.destinations)
        ? request.body.destinations
        : [requiredString(request.body, "mobile")];
      destinationAddresses = destinations.map(toSubscriberId);
    }
    response.json(await bdapps.sendSms({
      message,
      destinationAddresses,
      deliveryStatusRequest: request.body.deliveryStatusRequest ? "1" : "0",
      encoding: request.body.encoding || "0",
      sourceAddress: request.body.sourceAddress || undefined,
      chargingAmount: request.body.chargingAmount || undefined
    }));
  }));

  app.post("/api/bdapps/ussd/send", asyncRoute(async (request, response) => {
    response.json(await bdapps.sendUssd({
      sessionId: requiredString(request.body, "sessionId"),
      message: requiredString(request.body, "message"),
      destinationAddress: toSubscriberId(requiredString(request.body, "mobile")),
      ussdOperation: request.body.ussdOperation || "mt-cont",
      encoding: request.body.encoding || "440"
    }));
  }));

  app.post("/api/bdapps/caas/balance", asyncRoute(async (request, response) => {
    response.json(await bdapps.queryBalance({
      subscriberId: toSubscriberId(requiredString(request.body, "mobile")),
      accountId: optionalString(request.body, "accountId")
    }));
  }));

  app.post("/api/bdapps/caas/payment-instruments", asyncRoute(async (request, response) => {
    response.json(await bdapps.listPaymentInstruments({
      subscriberId: toSubscriberId(requiredString(request.body, "mobile")),
      type: request.body.type || "all"
    }));
  }));

  app.post("/api/bdapps/caas/direct-debit", asyncRoute(async (request, response) => {
    if (request.body?.confirmCharge !== true) {
      const error = new Error("confirmCharge must be true before a debit can be submitted");
      error.status = 400;
      throw error;
    }
    const amount = requiredString(request.body, "amount");
    const numericAmount = Number(amount);
    if (!/^\d+(\.\d{1,2})?$/.test(amount)
      || numericAmount < Number(minChargeAmount)
      || numericAmount > Number(maxChargeAmount)) {
      const error = new Error(`amount must be between ${minChargeAmount} and ${maxChargeAmount} BDT with at most two decimals`);
      error.status = 400;
      throw error;
    }
    const externalTrxId = optionalString(request.body, "externalTrxId") || randomUUID().replaceAll("-", "");
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(externalTrxId)) {
      const error = new Error("externalTrxId must contain 1 to 32 letters, digits, underscores, or hyphens");
      error.status = 400;
      throw error;
    }
    const subscriberId = toSubscriberId(requiredString(request.body, "mobile"));
    if (caasSubscriptionRequired) {
      const subscription = await bdapps.getSubscriptionStatus(subscriberId);
      if (String(subscription.subscriptionStatus || "").toUpperCase() !== "REGISTERED") {
        const error = new Error("Subscriber must complete OTP registration before charging");
        error.status = 409;
        error.response = subscription;
        throw error;
      }
    }
    const payload = {
      externalTrxId,
      amount,
      currency: "BDT",
      subscriberId,
      accountId: optionalString(request.body, "accountId")
    };
    if (!await repository.createPendingTransaction(payload)) {
      const error = new Error("externalTrxId already exists; the debit was not submitted again");
      error.status = 409;
      error.payment = await repository.getTransaction(externalTrxId);
      throw error;
    }
    try {
      const result = await bdapps.directDebit(payload);
      const providerResult = { externalTrxId, ...result };
      const state = providerResult.statusCode === "S1000" ? "SUCCEEDED" : "FAILED";
      await repository.completeTransaction(payload, providerResult, state);
      const body = {
        ...providerResult,
        transactionState: state,
        receipt: paymentReceipt(payload, providerResult, state)
      };
      response.status(state === "SUCCEEDED" ? 200 : 422).json(body);
    } catch (error) {
      if (error instanceof BdappsError && error.response?.statusCode) {
        const providerResult = { externalTrxId, ...error.response };
        await repository.completeTransaction(payload, providerResult, "FAILED");
        error.payment = {
          externalTrxId,
          transactionState: "FAILED",
          receipt: paymentReceipt(payload, providerResult, "FAILED")
        };
      } else {
        await repository.markTransactionUnknown(externalTrxId, error);
        error.payment = { externalTrxId, transactionState: "UNKNOWN" };
      }
      throw error;
    }
  }));

  app.get("/api/bdapps/dashboard/summary", asyncRoute(async (_request, response) => {
    response.json({ summary: await repository.getDashboardSummary() });
  }));

  app.get("/api/bdapps/caas/transactions", asyncRoute(async (request, response) => {
    const limit = Math.max(queryInteger(request.query.limit, "limit", 25, 100), 1);
    const offset = queryInteger(request.query.offset, "offset", 0, 1000000);
    const state = optionalQueryString(request.query.state, "state", 20)?.toUpperCase();
    if (state && !["PENDING", "SUCCEEDED", "FAILED", "UNKNOWN"].includes(state)) {
      const error = new Error("state must be PENDING, SUCCEEDED, FAILED, or UNKNOWN");
      error.status = 400;
      throw error;
    }
    const query = optionalQueryString(request.query.query, "query");
    const result = await repository.listTransactions({ limit, offset, state, query });
    response.json({ transactions: result.rows, total: result.total, limit, offset });
  }));

  app.get("/api/bdapps/caas/transactions/:externalTrxId", asyncRoute(async (request, response) => {
    const externalTrxId = request.params.externalTrxId;
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(externalTrxId)) {
      const error = new Error("Invalid externalTrxId");
      error.status = 400;
      throw error;
    }
    const transaction = await repository.getTransaction(externalTrxId);
    if (!transaction) {
      response.status(404).json({ error: "Transaction not found" });
      return;
    }
    response.json({ transaction });
  }));

  app.get("/api/bdapps/events", asyncRoute(async (request, response) => {
    const limit = Math.max(queryInteger(request.query.limit, "limit", 25, 100), 1);
    const offset = queryInteger(request.query.offset, "offset", 0, 1000000);
    const eventType = optionalQueryString(request.query.type, "type", 80);
    const query = optionalQueryString(request.query.query, "query");
    const result = await repository.listEvents({ limit, offset, eventType, query });
    response.json({ events: result.rows, total: result.total, limit, offset });
  }));

  app.use((request, response) => {
    response.status(404).json({ error: "Not found" });
  });

  app.use((error, _request, response, _next) => {
    const status = error instanceof BdappsError ? error.status : error.status || 500;
    const message = status >= 500 && !(error instanceof BdappsError) ? "Internal server error" : error.message;
    if (status >= 500) console.error(error);
    const provider = error instanceof BdappsError ? {
      httpStatus: error.httpStatus,
      path: error.path,
      contentType: error.contentType,
      bodyPreview: error.bodyPreview,
      outcomeUnknown: error.outcomeUnknown
    } : undefined;
    response.status(status).json({
      error: message,
      bdapps: error.response ?? undefined,
      provider,
      payment: error.payment ?? undefined
    });
  });

  return app;
}
