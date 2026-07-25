import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function commaSeparated(value, fallback) {
  const values = (value || "").split(",").map((entry) => entry.trim()).filter(Boolean);
  return values.length ? values : fallback;
}

function booleanValue(value, fallback) {
  if (value == null || value === "") return fallback;
  if (/^(true|1|yes)$/i.test(value)) return true;
  if (/^(false|0|no)$/i.test(value)) return false;
  throw new Error(`Invalid boolean configuration value: ${value}`);
}

export function loadConfig() {
  return {
    port: positiveInteger(process.env.PORT, 4317),
    clientOrigin: process.env.CLIENT_ORIGIN || "http://127.0.0.1:3000",
    databaseUrl: process.env.DATABASE_URL || "postgres://bdapps:bdapps@127.0.0.1:5433/bdapps",
    adminToken: process.env.PAYMENT_ADMIN_TOKEN || "",
    minChargeAmount: process.env.PAYMENT_MIN_AMOUNT_BDT || "5.00",
    maxChargeAmount: process.env.PAYMENT_MAX_AMOUNT_BDT || "100.00",
    caasSubscriptionRequired: booleanValue(process.env.BDAPPS_CAAS_SUBSCRIPTION_REQUIRED, false),
    bdapps: {
      baseUrl: process.env.BDAPPS_BASE_URL || "https://developer.bdapps.com",
      applicationId: process.env.BDAPPS_APPLICATION_ID || "",
      password: process.env.BDAPPS_PASSWORD || "",
      applicationHash: process.env.BDAPPS_APPLICATION_HASH || "",
      timeoutMs: positiveInteger(process.env.BDAPPS_REQUEST_TIMEOUT_MS, 15000),
      caasBalancePaths: commaSeparated(
        process.env.BDAPPS_CAAS_BALANCE_PATHS,
        ["/caas/get/balance", "/caas/balance/query"]
      ),
      caasPaymentInstrumentsPath: process.env.BDAPPS_CAAS_PAYMENT_INSTRUMENTS_PATH || "/caas/list/pi",
      caasDirectDebitPath: process.env.BDAPPS_CAAS_DIRECT_DEBIT_PATH || "/caas/direct/debit",
      paymentInstrumentName: process.env.BDAPPS_PAYMENT_INSTRUMENT_NAME || "MobileAccount",
      directDebitPaymentInstrumentName: process.env.BDAPPS_CAAS_DIRECT_DEBIT_PAYMENT_INSTRUMENT_NAME || "Mobile Account",
      legacyPaymentInstrumentName: process.env.BDAPPS_LEGACY_PAYMENT_INSTRUMENT_NAME || "Mobile Account"
    }
  };
}
