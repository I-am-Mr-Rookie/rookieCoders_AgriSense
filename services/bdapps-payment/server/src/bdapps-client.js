export class BdappsError extends Error {
  constructor(message, {
    status = 502,
    response = null,
    httpStatus = null,
    path = null,
    contentType = null,
    bodyPreview = null,
    outcomeUnknown = false
  } = {}) {
    super(message);
    this.name = "BdappsError";
    this.status = status;
    this.response = response;
    this.httpStatus = httpStatus;
    this.path = path;
    this.contentType = contentType;
    this.bodyPreview = bodyPreview;
    this.outcomeUnknown = outcomeUnknown;
  }
}

export class BdappsClient {
  constructor({
    baseUrl,
    applicationId,
    password,
    applicationHash = "",
    timeoutMs = 15000,
    caasBalancePaths = ["/caas/get/balance", "/caas/balance/query"],
    caasPaymentInstrumentsPath = "/caas/list/pi",
    caasDirectDebitPath = "/caas/direct/debit",
    paymentInstrumentName = "MobileAccount",
    directDebitPaymentInstrumentName = "Mobile Account",
    legacyPaymentInstrumentName = "Mobile Account"
  }) {
    if (!applicationId || !password) {
      throw new Error("BDAPPS_APPLICATION_ID and BDAPPS_PASSWORD must be configured");
    }
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.credentials = { applicationId, password };
    this.applicationHash = applicationHash;
    this.timeoutMs = timeoutMs;
    this.caasBalancePaths = caasBalancePaths;
    this.caasPaymentInstrumentsPath = caasPaymentInstrumentsPath;
    this.caasDirectDebitPath = caasDirectDebitPath;
    this.paymentInstrumentName = paymentInstrumentName;
    this.directDebitPaymentInstrumentName = directDebitPaymentInstrumentName;
    this.legacyPaymentInstrumentName = legacyPaymentInstrumentName;
  }

  redactedPreview(raw) {
    let preview = raw.slice(0, 240).replace(/\s+/g, " ").trim();
    for (const secret of [this.credentials.applicationId, this.credentials.password]) {
      if (secret) preview = preview.replaceAll(secret, "[redacted]");
    }
    return preview;
  }

  async post(path, payload, { operation = "read" } = {}) {
    let response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ...this.credentials, ...payload }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (error) {
      throw new BdappsError(`bdapps request failed: ${error.message}`, {
        path,
        outcomeUnknown: operation === "debit"
      });
    }

    const raw = await response.text();
    const contentType = response.headers.get("content-type") || "";
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new BdappsError(`bdapps returned a non-JSON response from ${path}`, {
        status: 502,
        httpStatus: response.status,
        path,
        contentType,
        bodyPreview: this.redactedPreview(raw),
        outcomeUnknown: operation === "debit" && response.ok
      });
    }
    if (!response.ok) {
      throw new BdappsError(body.statusDetail || `bdapps returned HTTP ${response.status}`, {
        status: 502,
        response: body,
        httpStatus: response.status,
        path,
        contentType,
        outcomeUnknown: false
      });
    }
    return body;
  }

  requestOtp({ subscriberId, applicationHash, applicationMetaData }) {
    return this.post("/subscription/otp/request", {
      subscriberId,
      applicationHash: applicationHash || this.applicationHash || undefined,
      applicationMetaData
    });
  }

  verifyOtp({ referenceNo, otp }) {
    return this.post("/subscription/otp/verify", { referenceNo, otp });
  }

  getSubscriptionStatus(subscriberId) {
    return this.post("/subscription/getStatus", { version: "1.0", subscriberId });
  }

  setSubscription(subscriberId, subscribe) {
    return this.post("/subscription/send", {
      version: "1.0",
      subscriberId,
      action: subscribe ? "1" : "0"
    });
  }

  sendSms(payload) {
    return this.post("/sms/send", { version: "1.0", encoding: "0", ...payload });
  }

  sendUssd(payload) {
    return this.post("/ussd/send", { version: "1.0", encoding: "440", ...payload });
  }

  queryBalance(payload) {
    return this.queryBalanceWithFallback(payload);
  }

  async queryBalanceWithFallback(payload) {
    let lastError;
    for (const [index, path] of this.caasBalancePaths.entries()) {
      const legacy = path.includes("/balance/query");
      try {
        return await this.post(path, {
          currency: "BDT",
          paymentInstrumentName: legacy ? this.legacyPaymentInstrumentName : this.paymentInstrumentName,
          ...payload
        });
      } catch (error) {
        lastError = error;
        const endpointUnavailable = error instanceof BdappsError && [404, 405].includes(error.httpStatus);
        if (!endpointUnavailable || index === this.caasBalancePaths.length - 1) throw error;
      }
    }
    throw lastError;
  }

  listPaymentInstruments(payload) {
    return this.post(this.caasPaymentInstrumentsPath, { type: "all", ...payload });
  }

  directDebit(payload) {
    return this.post(this.caasDirectDebitPath, {
      currency: "BDT",
      paymentInstrumentName: this.directDebitPaymentInstrumentName,
      ...payload
    }, { operation: "debit" });
  }
}
