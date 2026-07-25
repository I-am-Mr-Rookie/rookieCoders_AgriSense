import crypto from "node:crypto";

export class DailyAccessError extends Error {
  constructor(message, { status = 402, code = "PAYMENT_REQUIRED" } = {}) {
    super(message);
    this.name = "DailyAccessError";
    this.status = status;
    this.code = code;
  }
}

export function dhakaAccessDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function transactionId(userId, accessDate, attempt = 1) {
  const farmer = crypto.createHash("sha256").update(String(userId)).digest("hex").slice(0, 12);
  const base = `agri_${farmer}_${accessDate.replaceAll("-", "")}`;
  return attempt > 1 ? `${base}_${attempt}` : base;
}

function paidResult(record, charged = false) {
  return {
    state: "PAID",
    accessDate: record.accessDate,
    amountBdt: "5.00",
    charged,
  };
}

export function createDailyAccessService({
  store,
  gateway,
  enabled = false,
  now = () => new Date(),
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  async function waitForWinner(userId, accessDate) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const record = await store.loadDailyAccess(userId, accessDate);
      if (record?.state === "SUCCEEDED") return paidResult(record);
      if (record?.state === "FAILED") break;
      await wait(5);
    }
    throw new DailyAccessError("Daily access payment could not be confirmed. No duplicate charge was submitted.");
  }

  async function ensureAccess({ userId, mobile }) {
    const accessDate = dhakaAccessDate(now());
    const existing = await store.loadDailyAccess(userId, accessDate);
    if (existing?.state === "SUCCEEDED") return paidResult(existing);
    if (!enabled) {
      return { state: "BILLING_DISABLED", accessDate, amountBdt: "5.00", charged: false };
    }
    if (!mobile) {
      throw new DailyAccessError("Sign in again before daily access can be verified.", {
        status: 401,
        code: "LOGIN_REQUIRED",
      });
    }

    const attempt = existing?.state === "FAILED"
      ? Number(existing.attemptCount || 1) + 1
      : 1;
    const externalTrxId = transactionId(userId, accessDate, attempt);
    const winner = await store.claimDailyAccess({
      userId,
      accessDate,
      externalTrxId,
      amountBdt: "5.00",
    });
    if (!winner) return waitForWinner(userId, accessDate);

    try {
      const provider = await gateway.chargeDaily({ mobile, amount: "5.00", externalTrxId });
      if (provider?.transactionState !== "SUCCEEDED" && provider?.statusCode !== "S1000") {
        throw new Error("provider rejected");
      }
      const completed = await store.completeDailyAccess(userId, accessDate, {
        state: "SUCCEEDED",
        providerCode: provider.statusCode || "S1000",
      });
      return paidResult(completed, true);
    } catch {
      await store.completeDailyAccess(userId, accessDate, { state: "FAILED" });
      throw new DailyAccessError("Daily access payment could not be confirmed. No access charge was recorded.");
    }
  }

  return { ensureAccess };
}
