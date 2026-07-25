import { useEffect, useState } from "react";

const DEMO_MOBILE = "8801845082101";
const AUTH_COPY = {
  en: {
    account: "AgriSense",
    mobileTitle: "Start with your mobile number",
    loginTitle: "Welcome back",
    otpTitle: "Enter the OTP",
    passwordTitle: "Choose a simple password",
    mobileLabel: "Mobile number",
    send: "Send OTP",
    verify: "Continue",
    mobileHelp: "bdapps will verify your number once.",
    loginHelp: "Use your mobile number and password. No OTP or new charge.",
    passwordHelp: "Use digits only. You will use this password for future logins.",
    otpHelp: (last4) => `We sent a one-time code to the number ending in ${last4}.`,
    demo: "Demo number",
    otpLabel: "One-time password",
    otpPlaceholder: "OTP code",
    passwordLabel: "Numeric password",
    passwordPlaceholder: "Any digits",
    change: "Change number",
    resend: "Send again",
    dailyChargeConsent: "I agree to a one-time BDT 5 charge from this mobile balance when I register. Future password logins are not charged again.",
    sending: "Sending…",
    verifying: "Checking…",
    saving: "Saving…",
    close: "Close mobile sign-in",
    footnote: "Your mobile number opens your private farm workspace. Passwords are stored only as protected salted hashes.",
  },
  bn: {
    account: "AgriSense",
    mobileTitle: "মোবাইল নম্বর দিয়ে শুরু করুন",
    loginTitle: "আবার স্বাগতম",
    otpTitle: "ওটিপি লিখুন",
    passwordTitle: "একটি সহজ পাসওয়ার্ড দিন",
    mobileLabel: "মোবাইল নম্বর",
    send: "ওটিপি পাঠান",
    verify: "চালিয়ে যান",
    mobileHelp: "bdapps একবার আপনার নম্বর যাচাই করবে।",
    loginHelp: "মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে লগইন করুন। নতুন ওটিপি বা টাকা লাগবে না।",
    passwordHelp: "শুধু সংখ্যা ব্যবহার করুন। পরেরবার এই পাসওয়ার্ড দিয়েই লগইন করবেন।",
    otpHelp: (last4) => `শেষ চার সংখ্যা ${last4}—এই নম্বরে ওটিপি পাঠানো হয়েছে।`,
    demo: "ডেমো নম্বর",
    otpLabel: "ওটিপি",
    otpPlaceholder: "ওটিপি কোড",
    passwordLabel: "সংখ্যার পাসওয়ার্ড",
    passwordPlaceholder: "যেকোনো সংখ্যা",
    change: "নম্বর বদলান",
    resend: "আবার পাঠান",
    dailyChargeConsent: "আমি সম্মতি দিচ্ছি—নিবন্ধনের সময় মোবাইল ব্যালেন্স থেকে একবার ৫ টাকা কাটা হবে। পরে পাসওয়ার্ড দিয়ে লগইন করলে আর টাকা কাটবে না।",
    sending: "ওটিপি পাঠানো হচ্ছে…",
    verifying: "যাচাই হচ্ছে…",
    saving: "সংরক্ষণ হচ্ছে…",
    close: "লগইন বন্ধ করুন",
    footnote: "এই নম্বরেই আপনার ব্যক্তিগত খামারের তথ্য থাকবে। পাসওয়ার্ড সুরক্ষিত হ্যাশ হিসেবে রাখা হয়।",
  },
};

async function post(path, body) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerDiagnostic = data.providerCode
      ? ` [${data.providerCode}${data.providerDetail ? `: ${data.providerDetail}` : ""}]`
      : "";
    throw new Error(`${data.error || "Mobile sign-in could not continue."}${providerDiagnostic}`);
  }
  return data;
}

export default function AuthDialog({
  mode,
  onClose,
  onAuthenticated,
  existingAuth = null,
  language = "bn",
}) {
  const [mobile, setMobile] = useState(DEMO_MOBILE);
  const [referenceNo, setReferenceNo] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [pendingAuth, setPendingAuth] = useState(null);
  const [step, setStep] = useState("mobile");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [chargeConsent, setChargeConsent] = useState(false);

  useEffect(() => {
    setMobile(DEMO_MOBILE);
    setReferenceNo("");
    setOtp("");
    setPassword("");
    setPendingAuth(existingAuth);
    setStep(mode === "login" ? "login" : mode === "setup" ? "password" : "mobile");
    setError("");
    setChargeConsent(false);
  }, [mode, existingAuth]);

  if (!mode) return null;
  const copy = AUTH_COPY[language] || AUTH_COPY.en;

  async function requestOtp(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await post("/api/auth/otp/request", { mobile, mode: "signup" });
      setReferenceNo(data.referenceNo);
      setStep("otp");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await post("/api/auth/otp/verify", { mobile, referenceNo, otp, mode: "signup" });
      setPendingAuth(data);
      setStep("password");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function loginWithPassword(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onAuthenticated(await post("/api/auth/password/login", { mobile, password }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/api/auth/password/setup", { password });
      onAuthenticated({
        ...pendingAuth,
        authenticated: true,
        user: { ...pendingAuth?.user, passwordConfigured: true },
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const title = step === "otp"
    ? copy.otpTitle
    : step === "password"
      ? copy.passwordTitle
      : mode === "signup"
        ? copy.mobileTitle
        : copy.loginTitle;
  const help = step === "otp"
    ? copy.otpHelp(mobile.slice(-4))
    : step === "password"
      ? copy.passwordHelp
      : mode === "login"
        ? copy.loginHelp
        : copy.mobileHelp;

  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && mode !== "setup") onClose();
    }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        {mode !== "setup" && <button type="button" className="auth-close" aria-label={copy.close} onClick={onClose}>×</button>}
        <div className="auth-brand" aria-hidden="true">A</div>
        <p className="auth-kicker">{copy.account}</p>
        <h2 id="auth-title">{title}</h2>
        <p>{help}</p>

        {step === "mobile" ? (
          <form onSubmit={requestOtp}>
            <label htmlFor="auth-mobile">{copy.mobileLabel}</label>
            <input id="auth-mobile" value={mobile} onChange={(event) => setMobile(event.target.value)} inputMode="tel" autoComplete="tel" disabled={busy} />
            <small>{copy.demo}: 8801845082101</small>
            <label className="auth-consent" htmlFor="auth-daily-charge-consent">
              <input id="auth-daily-charge-consent" type="checkbox" checked={chargeConsent} onChange={(event) => setChargeConsent(event.target.checked)} disabled={busy} />
              <span>{copy.dailyChargeConsent}</span>
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy || !mobile.trim() || (mode === "signup" && !chargeConsent)}>{busy ? copy.sending : copy.send}</button>
          </form>
        ) : step === "otp" ? (
          <form onSubmit={verifyOtp}>
            <label htmlFor="auth-otp">{copy.otpLabel}</label>
            <input id="auth-otp" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" placeholder={copy.otpPlaceholder} autoFocus disabled={busy} />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy || otp.length < 4}>{busy ? copy.verifying : copy.verify}</button>
            <div className="auth-inline-actions">
              <button type="button" onClick={() => { setStep("mobile"); setOtp(""); setError(""); }}>{copy.change}</button>
              <button type="button" disabled={busy} onClick={requestOtp}>{copy.resend}</button>
            </div>
          </form>
        ) : step === "login" ? (
          <form onSubmit={loginWithPassword}>
            <label htmlFor="auth-mobile">{copy.mobileLabel}</label>
            <input id="auth-mobile" value={mobile} onChange={(event) => setMobile(event.target.value)} inputMode="tel" autoComplete="tel" disabled={busy} />
            <label htmlFor="auth-password">{copy.passwordLabel}</label>
            <input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value.replace(/\D/g, "").slice(0, 64))} inputMode="numeric" autoComplete="current-password" placeholder={copy.passwordPlaceholder} disabled={busy} />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy || !mobile.trim() || !password}>{busy ? copy.verifying : copy.verify}</button>
          </form>
        ) : (
          <form onSubmit={savePassword}>
            <label htmlFor="auth-password">{copy.passwordLabel}</label>
            <input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value.replace(/\D/g, "").slice(0, 64))} inputMode="numeric" autoComplete="new-password" placeholder={copy.passwordPlaceholder} autoFocus disabled={busy} />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy || !password}>{busy ? copy.saving : copy.verify}</button>
          </form>
        )}
        <p className="auth-footnote">{copy.footnote}</p>
      </section>
    </div>
  );
}
