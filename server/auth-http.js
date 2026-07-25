import { AuthError } from "./auth.js";

export const AUTH_COOKIE = "agrisense_session";

export function parseCookieHeader(header = "") {
  return Object.fromEntries(String(header).split(";").flatMap((part) => {
    const index = part.indexOf("=");
    if (index < 1) return [];
    return [[part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]];
  }));
}

function sessionCookie(token, { secure, maxAgeSeconds = 30 * 24 * 60 * 60 }) {
  return [
    `${AUTH_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

function clearCookie({ secure }) {
  return [
    `${AUTH_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

function tokenFrom(request) {
  return parseCookieHeader(request.get?.("cookie") || request.headers?.cookie)[AUTH_COOKIE] || "";
}

function failure(response, error) {
  const known = error instanceof AuthError;
  response.status(known ? error.status : 503).json({
    error: known ? error.message : "Mobile sign-in is temporarily unavailable.",
    code: known ? error.code : "AUTH_UNAVAILABLE",
    recoverable: true,
    ...(known && error.providerCode ? { providerCode: error.providerCode } : {}),
    ...(known && error.providerDetail ? { providerDetail: error.providerDetail } : {}),
  });
}

export function createAuthHandlers({ authService, memoryService, secureCookies = false, persistenceMode = () => "memory-fallback" }) {
  async function completeAuthentication(verified, response) {
    const memory = await memoryService.ensure(verified.memoryId, {
      profile: {},
      lastResult: null,
      preferences: { autoAdjustIrrigation: true },
      conversationSummary: "",
      sessions: [],
    });
    response.set("set-cookie", sessionCookie(verified.sessionToken, { secure: secureCookies }));
    response.json({
      authenticated: true,
      user: verified.user,
      memoryId: verified.memoryId,
      memory,
      expiresAt: verified.expiresAt,
      access: verified.access,
      database: persistenceMode(),
    });
  }

  return {
    requestOtp: async (request, response) => {
      try {
        response.json(await authService.requestOtp({
          mobile: request.body?.mobile,
          mode: request.body?.mode,
        }));
      } catch (error) {
        failure(response, error);
      }
    },
    verifyOtp: async (request, response) => {
      try {
        const verified = await authService.verifyOtp(request.body ?? {});
        await completeAuthentication(verified, response);
      } catch (error) {
        failure(response, error);
      }
    },
    passwordSetup: async (request, response) => {
      try {
        response.json(await authService.setPassword(tokenFrom(request), request.body?.password));
      } catch (error) {
        failure(response, error);
      }
    },
    passwordLogin: async (request, response) => {
      try {
        const verified = await authService.loginWithPassword(request.body ?? {});
        await completeAuthentication(verified, response);
      } catch (error) {
        failure(response, error);
      }
    },
    session: async (request, response) => {
      try {
        const session = await authService.getSession(tokenFrom(request));
        if (!session) {
          response.status(401).json({ authenticated: false });
          return;
        }
        const memory = await memoryService.ensure(session.memoryId, {
          profile: {},
          lastResult: null,
          preferences: { autoAdjustIrrigation: true },
          conversationSummary: "",
          sessions: [],
        });
        response.json({ authenticated: true, ...session, memory, database: persistenceMode() });
      } catch (error) {
        failure(response, error);
      }
    },
    logout: async (request, response) => {
      try {
        await authService.logout(tokenFrom(request));
        response.set("set-cookie", clearCookie({ secure: secureCookies }));
        response.json({ authenticated: false });
      } catch (error) {
        failure(response, error);
      }
    },
  };
}
