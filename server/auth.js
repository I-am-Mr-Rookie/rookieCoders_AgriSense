import crypto from "node:crypto";

import { DailyAccessError } from "./daily-access.js";

export class AuthError extends Error {
  constructor(message, {
    status = 400,
    code = "AUTH_FAILED",
    providerCode,
    providerDetail,
  } = {}) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
    if (providerCode) this.providerCode = providerCode;
    if (providerDetail) this.providerDetail = providerDetail;
  }
}

export function normalizeBangladeshMobile(value) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (/^01[3-9]\d{8}$/.test(digits)) digits = `88${digits}`;
  if (!/^8801[3-9]\d{8}$/.test(digits)) {
    throw new AuthError("Enter a valid Bangladesh mobile number.", { code: "INVALID_MOBILE" });
  }
  return digits;
}

function normalizeServiceUrl(value) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("The bdapps service must use HTTPS outside local development.");
  }
  return url.toString().replace(/\/$/, "");
}

async function responseJson(response) {
  return response.json().catch(() => ({}));
}

function sanitizedProviderText(value, maxLength) {
  const clean = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
  return clean || undefined;
}

export function createBdappsOtpClient({
  serviceUrl,
  adminToken,
  fetchImpl = globalThis.fetch,
  timeoutMs = 12_000,
}) {
  const baseUrl = normalizeServiceUrl(serviceUrl);

  async function post(path, body) {
    if (!adminToken) {
      throw new AuthError("Mobile sign-in is not configured.", { status: 503, code: "OTP_NOT_CONFIGURED" });
    }
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new AuthError("The OTP service did not respond. Try again.", {
        status: 503,
        code: "OTP_UNAVAILABLE",
      });
    }
    const payload = await responseJson(response);
    if (!response.ok) {
      const invalid = response.status === 400 || response.status === 422;
      const providerCode = sanitizedProviderText(payload?.bdapps?.statusCode, 32);
      const providerDetail = sanitizedProviderText(
        payload?.bdapps?.statusDetail ?? payload?.error,
        160,
      );
      throw new AuthError(
        invalid ? "The mobile number or OTP was not accepted." : "The OTP service is temporarily unavailable.",
        {
          status: invalid ? 400 : 503,
          code: invalid ? "OTP_REJECTED" : "OTP_UNAVAILABLE",
          providerCode,
          providerDetail,
        },
      );
    }
    return payload;
  }

  async function providerPost(path, body) {
    const payload = await post(path, body);
    if (payload?.statusCode && payload.statusCode !== "S1000") {
      throw new AuthError("The mobile service rejected the request.", {
        status: 422,
        code: "OTP_REJECTED",
        providerCode: sanitizedProviderText(payload.statusCode, 32),
        providerDetail: sanitizedProviderText(payload.statusDetail, 160),
      });
    }
    return payload;
  }

  return {
    requestOtp: (mobile) => post("/otp/request", { mobile }),
    verifyOtp: ({ referenceNo, otp }) => post("/otp/verify", { referenceNo, otp }),
    subscriptionStatus: (mobile) => providerPost("/subscription/status", { mobile }),
    sendLoginOtp: ({ mobile, message }) => providerPost("/sms/send", {
      mobile,
      message,
      deliveryStatusRequest: true,
    }),
  };
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest();
}

function encryptMobile(secret, mobile, randomBytes) {
  const key = crypto.createHash("sha256").update(`mobile-encryption:${secret}`).digest();
  const iv = randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(mobile, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptMobile(secret, value) {
  const [version, ivValue, tagValue, ciphertextValue] = String(value || "").split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
    throw new AuthError("Subscription identity is unavailable.", { status: 409, code: "SUBSCRIBER_UNAVAILABLE" });
  }
  try {
    const key = crypto.createHash("sha256").update(`mobile-encryption:${secret}`).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new AuthError("Subscription identity is unavailable.", { status: 409, code: "SUBSCRIBER_UNAVAILABLE" });
  }
}

function publicUser(user) {
  return { id: user.id, mobileLast4: user.mobileLast4, passwordConfigured: Boolean(user.passwordHash) };
}

function numericPassword(value) {
  const password = String(value ?? "");
  if (!/^\d{1,64}$/.test(password)) {
    throw new AuthError("Use digits only for your password.", { code: "INVALID_PASSWORD" });
  }
  return password;
}

function derivePassword(password, salt) {
  return crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 }).toString("hex");
}

export function createAuthService({
  store,
  otpClient,
  secret,
  randomBytes = crypto.randomBytes,
  now = () => new Date(),
  sessionTtlMs = 30 * 24 * 60 * 60 * 1000,
  otpWindowMs = 10 * 60 * 1000,
  maxOtpRequests = 3,
  loginOtpTtlMs = 5 * 60 * 1000,
  dailyAccessService = {
    async ensureAccess() {
      return { state: "BILLING_DISABLED", charged: false };
    },
  },
}) {
  if (!secret || secret.length < 32) throw new Error("AUTH_SESSION_SECRET must contain at least 32 characters.");
  const requests = new Map();
  const loginFailures = new Map();

  function identities(mobile) {
    const normalized = normalizeBangladeshMobile(mobile);
    return {
      normalized,
      mobileHash: hmac(secret, `mobile:${normalized}`).toString("hex"),
      mobileLast4: normalized.slice(-4),
    };
  }

  function memoryId(userId) {
    return `farm_${hmac(secret, `memory:${userId}`).subarray(0, 18).toString("base64url")}`;
  }

  function authMode(value) {
    return value === "login" ? "login" : "signup";
  }

  async function ensureDailyAccess(request) {
    try {
      return await dailyAccessService.ensureAccess(request);
    } catch (error) {
      if (error instanceof DailyAccessError) {
        throw new AuthError(error.message, { status: error.status, code: error.code });
      }
      throw error;
    }
  }

  async function createUserSession(user) {
    const access = await ensureDailyAccess({
      userId: user.id,
      mobile: user.mobileCiphertext ? decryptMobile(secret, user.mobileCiphertext) : "",
    });
    const sessionToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now().getTime() + sessionTtlMs).toISOString();
    await store.createSession({
      sessionHash: sha256(sessionToken),
      userId: user.id,
      expiresAt,
    });
    return {
      sessionToken,
      expiresAt,
      user: publicUser(user),
      memoryId: memoryId(user.id),
      access,
    };
  }

  async function requestOtp({ mobile, mode }) {
    const identity = identities(mobile);
    const flow = authMode(mode);
    const timestamp = now().getTime();
    const recent = (requests.get(identity.mobileHash) ?? []).filter((value) => timestamp - value < otpWindowMs);
    if (recent.length >= maxOtpRequests) {
      throw new AuthError("Too many OTP requests. Wait a few minutes and try again.", {
        status: 429,
        code: "OTP_RATE_LIMITED",
      });
    }
    recent.push(timestamp);
    requests.set(identity.mobileHash, recent);

    const subscription = await otpClient.subscriptionStatus(identity.normalized);
    const registered = String(subscription?.subscriptionStatus || "").toUpperCase() === "REGISTERED";
    if (flow === "signup" && registered) {
      throw new AuthError("This number already has an AgriSense subscription. Use Login.", {
        status: 409,
        code: "USE_LOGIN",
      });
    }
    if (flow === "login") {
      throw new AuthError("Use your mobile number and password to log in.", {
        status: 409,
        code: "PASSWORD_LOGIN_REQUIRED",
      });
    }

    const result = await otpClient.requestOtp(identity.normalized);
    if (!result?.referenceNo) {
      throw new AuthError("The OTP service returned an incomplete response.", {
        status: 503,
        code: "OTP_UNAVAILABLE",
      });
    }
    return { referenceNo: result.referenceNo, mobileLast4: identity.mobileLast4, flow };
  }

  async function verifyOtp({ mobile, referenceNo, otp, mode }) {
    const identity = identities(mobile);
    const flow = authMode(mode);
    const cleanReference = String(referenceNo ?? "").trim();
    const cleanOtp = String(otp ?? "").trim();
    if (!cleanReference) throw new AuthError("Request a new OTP first.", { code: "REFERENCE_REQUIRED" });
    if (!/^\d{4,8}$/.test(cleanOtp)) throw new AuthError("Enter the OTP sent to your mobile.", { code: "INVALID_OTP" });
    await otpClient.verifyOtp({ referenceNo: cleanReference, otp: cleanOtp });
    const user = await store.upsertUser({
      mobileHash: identity.mobileHash,
      mobileLast4: identity.mobileLast4,
      mobileCiphertext: encryptMobile(secret, identity.normalized, randomBytes),
    });
    return createUserSession(user);
  }

  async function setPassword(sessionToken, value) {
    const password = numericPassword(value);
    const record = await store.loadSession(sha256(sessionToken || ""));
    if (!record || new Date(record.expiresAt).getTime() <= now().getTime()) {
      throw new AuthError("Your setup session expired. Start again.", { status: 401, code: "AUTH_REQUIRED" });
    }
    const passwordSalt = randomBytes(16).toString("hex");
    const passwordHash = derivePassword(password, passwordSalt);
    const saved = await store.setPassword({ userId: record.user.id, passwordSalt, passwordHash });
    if (!saved) throw new AuthError("Password could not be saved.", { status: 503, code: "PASSWORD_SAVE_FAILED" });
    return { configured: true };
  }

  async function loginWithPassword({ mobile, password: value }) {
    const identity = identities(mobile);
    const password = numericPassword(value);
    const timestamp = now().getTime();
    const failures = (loginFailures.get(identity.mobileHash) ?? []).filter((item) => timestamp - item < otpWindowMs);
    if (failures.length >= 5) {
      throw new AuthError("Too many login attempts. Wait a few minutes and try again.", {
        status: 429,
        code: "LOGIN_RATE_LIMITED",
      });
    }
    const user = await store.loadUserByMobileHash(identity.mobileHash);
    const salt = user?.passwordSalt || "00000000000000000000000000000000";
    const expected = user?.passwordHash || derivePassword("0", salt);
    const actual = derivePassword(password, salt);
    const valid = expected.length === actual.length && crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
    if (!user || !user.passwordHash || !valid) {
      failures.push(timestamp);
      loginFailures.set(identity.mobileHash, failures);
      throw new AuthError("Mobile number or password is incorrect.", { status: 401, code: "INVALID_CREDENTIALS" });
    }
    loginFailures.delete(identity.mobileHash);
    return createUserSession(user);
  }

  async function getSession(sessionToken) {
    if (!sessionToken) return null;
    const record = await store.loadSession(sha256(sessionToken));
    if (!record) return null;
    if (new Date(record.expiresAt).getTime() <= now().getTime()) {
      await store.deleteSession(sha256(sessionToken));
      return null;
    }
    return {
      user: publicUser(record.user),
      memoryId: memoryId(record.user.id),
      expiresAt: record.expiresAt,
      access: await ensureDailyAccess({
        userId: record.user.id,
        mobile: record.user.mobileCiphertext
          ? decryptMobile(secret, record.user.mobileCiphertext)
          : "",
      }),
    };
  }

  async function logout(sessionToken) {
    if (!sessionToken) return false;
    return store.deleteSession(sha256(sessionToken));
  }

  async function deleteAccount(sessionToken) {
    if (!sessionToken) throw new AuthError("Sign in to delete your account.", { status: 401, code: "AUTH_REQUIRED" });
    const record = await store.loadSession(sha256(sessionToken));
    if (!record || new Date(record.expiresAt).getTime() <= now().getTime()) {
      throw new AuthError("Sign in to delete your account.", { status: 401, code: "AUTH_REQUIRED" });
    }
    const linkedMemoryId = memoryId(record.user.id);
    const deleted = await store.deleteUser(record.user.id);
    if (!deleted) throw new AuthError("Account could not be deleted.", { status: 503, code: "ACCOUNT_DELETE_FAILED" });
    return { deleted: true, memoryId: linkedMemoryId };
  }

  async function getSubscriber(sessionToken) {
    if (!sessionToken) throw new AuthError("Sign in to manage your subscription.", { status: 401, code: "AUTH_REQUIRED" });
    const record = await store.loadSession(sha256(sessionToken));
    if (!record || new Date(record.expiresAt).getTime() <= now().getTime()) {
      throw new AuthError("Sign in to manage your subscription.", { status: 401, code: "AUTH_REQUIRED" });
    }
    return decryptMobile(secret, record.user.mobileCiphertext);
  }

  return { requestOtp, verifyOtp, setPassword, loginWithPassword, getSession, logout, deleteAccount, getSubscriber };
}
