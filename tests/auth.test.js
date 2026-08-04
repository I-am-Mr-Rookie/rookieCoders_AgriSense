import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthError,
  createAuthService,
  createBdappsOtpClient,
  normalizeBangladeshMobile,
} from "../server/auth.js";
import { createAuthHandlers } from "../server/auth-http.js";
import { DailyAccessError } from "../server/daily-access.js";

test("normalizes the approved Bangladesh demo number without changing it", () => {
  assert.equal(normalizeBangladeshMobile("8801845082101"), "8801845082101");
  assert.equal(normalizeBangladeshMobile("+880 1845-082101"), "8801845082101");
  assert.equal(normalizeBangladeshMobile("01845082101"), "8801845082101");
  assert.throws(() => normalizeBangladeshMobile("123"), /Bangladesh mobile/);
});

test("OTP adapter keeps the operator token server-side", async () => {
  const calls = [];
  const client = createBdappsOtpClient({
    serviceUrl: "https://rookiecoders.tech/api/bdapps",
    adminToken: "server-secret",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => url.endsWith("/otp/request")
          ? { referenceNo: "ref-1", statusCode: "S1000" }
          : { statusCode: "S1000", subscriptionStatus: "REGISTERED" },
      };
    },
  });

  assert.deepEqual(await client.requestOtp("8801845082101"), {
    referenceNo: "ref-1",
    statusCode: "S1000",
  });
  await client.verifyOtp({ referenceNo: "ref-1", otp: "123456" });

  assert.equal(calls[0].options.headers.authorization, "Bearer server-secret");
  assert.equal(calls[0].options.body.includes("server-secret"), false);
  assert.equal(JSON.stringify(await client.requestOtp("8801845082101")).includes("server-secret"), false);
});

test("OTP adapter preserves only sanitized provider diagnostics on rejection", async () => {
  const client = createBdappsOtpClient({
    serviceUrl: "https://rookiecoders.tech/api/bdapps",
    adminToken: "server-secret",
    fetchImpl: async () => ({
      ok: false,
      status: 422,
      json: async () => ({
        error: "Not white listed",
        bdapps: {
          statusCode: "E1343\nignored",
          statusDetail: "Not white listed\u0000 for this application",
          applicationHash: "must-not-leak",
        },
        provider: { bodyPreview: "must-not-leak" },
      }),
    }),
  });

  await assert.rejects(
    client.requestOtp("8801845082101"),
    (error) => {
      assert.equal(error instanceof AuthError, true);
      assert.equal(error.code, "OTP_REJECTED");
      assert.equal(error.providerCode, "E1343ignored");
      assert.equal(error.providerDetail, "Not white listed for this application");
      assert.equal(JSON.stringify(error).includes("must-not-leak"), false);
      return true;
    },
  );
});

test("OTP HTTP failure returns safe provider diagnostics without raw payloads", async () => {
  let responseBody;
  const response = {
    statusCode: 200,
    status(value) { this.statusCode = value; return this; },
    json(value) { responseBody = value; return this; },
  };
  const handlers = createAuthHandlers({
    authService: {
      async requestOtp() {
        throw new AuthError("The mobile number or OTP was not accepted.", {
          status: 400,
          code: "OTP_REJECTED",
          providerCode: "E1343",
          providerDetail: "Not white listed",
        });
      },
    },
    memoryService: {},
  });

  await handlers.requestOtp({ body: { mobile: "8801845082101" } }, response);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(responseBody, {
    error: "The mobile number or OTP was not accepted.",
    code: "OTP_REJECTED",
    recoverable: true,
    providerCode: "E1343",
    providerDetail: "Not white listed",
  });
  assert.equal(JSON.stringify(responseBody).includes("server-secret"), false);
});

test("verified mobile creates a stable account memory and opaque session", async () => {
  const users = new Map();
  const sessions = new Map();
  const store = {
    async upsertUser(record) {
      const current = users.get(record.mobileHash) ?? { id: "user-1", ...record };
      users.set(record.mobileHash, current);
      return current;
    },
    async createSession(record) { sessions.set(record.sessionHash, record); },
    async loadSession(sessionHash) {
      const session = sessions.get(sessionHash);
      const user = users.values().next().value;
      return session ? { ...session, user } : null;
    },
    async deleteSession(sessionHash) { return sessions.delete(sessionHash); },
  };
  const otpClient = {
    requestOtp: async () => ({ referenceNo: "ref-1" }),
    verifyOtp: async () => ({ statusCode: "S1000" }),
  };
  const service = createAuthService({
    store,
    otpClient,
    secret: "a-secure-test-secret-with-more-than-32-characters",
    randomBytes: () => Buffer.alloc(32, 7),
    now: () => new Date("2026-07-25T00:00:00.000Z"),
  });

  const verified = await service.verifyOtp({
    mobile: "8801845082101",
    referenceNo: "ref-1",
    otp: "123456",
  });
  const restored = await service.getSession(verified.sessionToken);

  assert.equal(verified.user.mobileLast4, "2101");
  assert.match(verified.memoryId, /^farm_[A-Za-z0-9_-]{24}$/);
  assert.equal(verified.sessionToken.length > 32, true);
  assert.equal(restored.memoryId, verified.memoryId);
  assert.equal(JSON.stringify(verified).includes("8801845082101"), false);
});

test("registered login never requests a paid OTP and directs the client to password login", async () => {
  const calls = [];
  const otpClient = {
    async subscriptionStatus() { return { statusCode: "S1000", subscriptionStatus: "REGISTERED" }; },
    async requestOtp() { calls.push("provider-otp"); return { referenceNo: "login-ref" }; },
    async sendLoginOtp() { calls.push("sms"); return { statusCode: "S1000" }; },
  };
  const service = createAuthService({
    store: {},
    otpClient,
    secret: "a-secure-test-secret-with-more-than-32-characters",
    randomBytes: (size) => Buffer.alloc(size, 9),
    now: () => new Date("2026-07-25T01:00:00.000Z"),
  });

  await assert.rejects(
    service.requestOtp({ mobile: "8801845082101", mode: "login" }),
    (error) => error instanceof AuthError && error.code === "PASSWORD_LOGIN_REQUIRED",
  );
  assert.deepEqual(calls, []);
});

test("registered signup directs the farmer to Login instead of requesting another enrollment", async () => {
  let enrollmentRequests = 0;
  const service = createAuthService({
    store: {},
    otpClient: {
      async subscriptionStatus() { return { subscriptionStatus: "REGISTERED" }; },
      async requestOtp() { enrollmentRequests += 1; },
    },
    secret: "a-secure-test-secret-with-more-than-32-characters",
  });

  await assert.rejects(
    service.requestOtp({ mobile: "8801845082101", mode: "signup" }),
    (error) => error instanceof AuthError && error.code === "USE_LOGIN",
  );
  assert.equal(enrollmentRequests, 0);
});

test("numeric password setup stores only a salted hash and supports later login without OTP", async () => {
  const sessions = new Map();
  const user = { id: "user-login", mobileLast4: "2101", mobileCiphertext: null, passwordSalt: null, passwordHash: null };
  const store = {
    async loadSession() { return { expiresAt: "2026-08-25T00:00:00.000Z", user }; },
    async setPassword(record) { Object.assign(user, record); return true; },
    async loadUserByMobileHash() { return user; },
    async createSession(record) { sessions.set(record.sessionHash, record); },
  };
  let otpCalls = 0;
  const otpClient = {
    async requestOtp() { otpCalls += 1; },
    async verifyOtp() { otpCalls += 1; },
  };
  const service = createAuthService({
    store,
    otpClient,
    secret: "a-secure-test-secret-with-more-than-32-characters",
    randomBytes: (size) => Buffer.alloc(size, 5),
    now: () => new Date("2026-07-25T01:00:00.000Z"),
  });
  await service.setPassword("signup-session", "7");
  const loggedIn = await service.loginWithPassword({ mobile: "8801845082101", password: "7" });

  assert.equal(loggedIn.user.mobileLast4, "2101");
  assert.equal(loggedIn.user.passwordConfigured, true);
  assert.notEqual(user.passwordHash, "7");
  assert.equal(user.passwordHash.length, 64);
  assert.equal(user.passwordSalt.length, 32);
  assert.equal(sessions.size, 1);
  assert.equal(otpCalls, 0);
  await assert.rejects(
    service.loginWithPassword({ mobile: "8801845082101", password: "8" }),
    (error) => error instanceof AuthError && error.code === "INVALID_CREDENTIALS",
  );
});

test("restores a pre-migration session when daily billing is disabled", async () => {
  let accessRequest;
  const service = createAuthService({
    store: {
      async loadSession() {
        return {
          expiresAt: "2026-08-25T00:00:00.000Z",
          user: { id: "legacy-user", mobileLast4: "2101", mobileCiphertext: null },
        };
      },
    },
    otpClient: {},
    secret: "a-secure-test-secret-with-more-than-32-characters",
    now: () => new Date("2026-07-25T01:00:00.000Z"),
    dailyAccessService: {
      async ensureAccess(request) {
        accessRequest = request;
        return { state: "BILLING_DISABLED", charged: false };
      },
    },
  });

  const restored = await service.getSession("legacy-session-token");

  assert.equal(restored.user.mobileLast4, "2101");
  assert.equal(accessRequest.mobile, "");
});

test("does not create a session when today's BDT 5 access cannot be confirmed", async () => {
  let sessionsCreated = 0;
  const service = createAuthService({
    store: {
      async upsertUser(record) { return { id: "user-payment", ...record }; },
      async createSession() { sessionsCreated += 1; },
    },
    otpClient: {
      async verifyOtp() { return { statusCode: "S1000" }; },
    },
    secret: "a-secure-test-secret-with-more-than-32-characters",
    dailyAccessService: {
      async ensureAccess() {
        throw new DailyAccessError("Daily access payment could not be confirmed.");
      },
    },
  });

  await assert.rejects(
    service.verifyOtp({
      mobile: "8801845082101",
      referenceNo: "signup-reference",
      otp: "123456",
      mode: "signup",
    }),
    (error) => error instanceof AuthError
      && error.status === 402
      && error.code === "PAYMENT_REQUIRED",
  );
  assert.equal(sessionsCreated, 0);
});

test("explicit account deletion removes the authenticated user and returns linked memory", async () => {
  const deleted = [];
  const service = createAuthService({
    store: {
      async loadSession() {
        return {
          expiresAt: "2026-08-25T00:00:00.000Z",
          user: { id: "delete-user", mobileLast4: "2101", mobileCiphertext: null },
        };
      },
      async deleteUser(userId) { deleted.push(userId); return true; },
    },
    otpClient: {},
    secret: "a-secure-test-secret-with-more-than-32-characters",
    now: () => new Date("2026-07-25T01:00:00.000Z"),
  });

  const result = await service.deleteAccount("session-token");

  assert.deepEqual(deleted, ["delete-user"]);
  assert.match(result.memoryId, /^farm_/);
});
