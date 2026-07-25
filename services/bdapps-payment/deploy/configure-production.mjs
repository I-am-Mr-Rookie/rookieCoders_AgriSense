import { chmod, copyFile, lstat, mkdir, readFile, rename, symlink, unlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const releaseDirectory = process.argv[2];

if (!releaseDirectory || !path.isAbsolute(releaseDirectory)) {
  throw new Error("Usage: node configure-production.mjs /absolute/release/directory");
}

const readEnvValue = (content, name) => {
  const line = content.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} is missing`);
  return line.slice(name.length + 1);
};

const readOptionalEnvValue = (content, name) => {
  const line = content.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1) : "";
};

const setEnvValue = (content, name, value) => {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  return pattern.test(content)
    ? content.replace(pattern, line)
    : `${content.trimEnd()}\n${line}\n`;
};

const resolveProductionDatabaseUrl = async (mainEnv) => {
  const configuredValue = readEnvValue(mainEnv, "DATABASE_URL");
  if (configuredValue) return configuredValue;

  const { stdout } = await execFileAsync("pm2", ["pid", "agrisense"]);
  const processId = stdout.trim();
  if (!/^\d+$/.test(processId) || processId === "0") {
    throw new Error("Could not find the running agrisense process for DATABASE_URL fallback");
  }

  const processEnvironment = await readFile(`/proc/${processId}/environ`, "utf8");
  const databaseEntry = processEnvironment.split("\0").find((entry) => entry.startsWith("DATABASE_URL="));
  const databaseUrl = databaseEntry?.slice("DATABASE_URL=".length);
  if (!databaseUrl) throw new Error("DATABASE_URL is empty in both the main env file and running agrisense process");
  return databaseUrl;
};

const targetEnvPath = path.join(releaseDirectory, ".env");
const [targetEnv, mainEnv] = await Promise.all([
  readFile(targetEnvPath, "utf8"),
  readFile("/var/www/agrisense/.env", "utf8")
]);

let currentEnv = "";
try {
  currentEnv = await readFile("/opt/agrisense-payment/current/.env", "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const candidateAdminTokens = [
  readOptionalEnvValue(targetEnv, "PAYMENT_ADMIN_TOKEN"),
  readOptionalEnvValue(currentEnv, "PAYMENT_ADMIN_TOKEN")
];
const adminToken = candidateAdminTokens.find((value) => value.length >= 32 && !value.startsWith("replace-"))
  || randomBytes(32).toString("hex");

let productionEnv = targetEnv;
productionEnv = setEnvValue(productionEnv, "PORT", "4317");
productionEnv = setEnvValue(productionEnv, "CLIENT_ORIGIN", "https://rookiecoders.tech");
productionEnv = setEnvValue(productionEnv, "DATABASE_URL", await resolveProductionDatabaseUrl(mainEnv));
productionEnv = setEnvValue(productionEnv, "PAYMENT_ADMIN_TOKEN", adminToken);
productionEnv = setEnvValue(productionEnv, "PAYMENT_MIN_AMOUNT_BDT", "5.00");
productionEnv = setEnvValue(productionEnv, "PAYMENT_MAX_AMOUNT_BDT", "100.00");
productionEnv = setEnvValue(productionEnv, "BDAPPS_CAAS_BALANCE_PATHS", "/caas/get/balance,/caas/balance/query");
productionEnv = setEnvValue(productionEnv, "BDAPPS_CAAS_PAYMENT_INSTRUMENTS_PATH", "/caas/list/pi");
productionEnv = setEnvValue(productionEnv, "BDAPPS_CAAS_DIRECT_DEBIT_PATH", "/caas/direct/debit");
productionEnv = setEnvValue(productionEnv, "BDAPPS_CAAS_SUBSCRIPTION_REQUIRED", "false");
productionEnv = setEnvValue(productionEnv, "BDAPPS_PAYMENT_INSTRUMENT_NAME", "MobileAccount");
productionEnv = setEnvValue(productionEnv, "BDAPPS_CAAS_DIRECT_DEBIT_PAYMENT_INSTRUMENT_NAME", "Mobile Account");
productionEnv = setEnvValue(productionEnv, "BDAPPS_LEGACY_PAYMENT_INSTRUMENT_NAME", "Mobile Account");
productionEnv = setEnvValue(
  productionEnv,
  "DATABASE_SSL_REJECT_UNAUTHORIZED",
  readEnvValue(mainEnv, "DATABASE_SSL_REJECT_UNAUTHORIZED")
);
await writeFile(targetEnvPath, productionEnv, { mode: 0o640 });
await chmod(targetEnvPath, 0o640);
await execFileAsync("chown", ["root:www-data", targetEnvPath]);

const publicDirectory = path.join(releaseDirectory, "public");
const paymentLink = path.join(publicDirectory, "payments");
await mkdir(publicDirectory, { recursive: true });
try {
  const linkStatus = await lstat(paymentLink);
  if (linkStatus.isSymbolicLink()) await unlink(paymentLink);
  else throw new Error(`${paymentLink} exists and is not a symbolic link`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await symlink("../client/dist", paymentLink, "dir");

await mkdir("/etc/nginx/snippets", { recursive: true });
await copyFile(path.join(releaseDirectory, "deploy/nginx-payment.conf"), "/etc/nginx/snippets/agrisense-payment.conf");

const includeLine = "    include /etc/nginx/snippets/agrisense-payment.conf;";
const insertionPoint = "    add_header Referrer-Policy no-referrer always;";
const timestamp = new Date().toISOString().replaceAll(/[-:.TZ]/g, "");
const nginxBackupDirectory = "/etc/nginx/backups";
await mkdir(nginxBackupDirectory, { recursive: true });

for (const sitePath of ["/etc/nginx/sites-available/agrisense", "/etc/nginx/sites-enabled/agrisense"]) {
  const site = await readFile(sitePath, "utf8");
  if (site.includes(includeLine)) continue;
  if (!site.includes(insertionPoint)) throw new Error(`Could not find Nginx insertion point in ${sitePath}`);
  await copyFile(sitePath, path.join(nginxBackupDirectory, `${path.basename(sitePath)}.pre-payment-${timestamp}`));
  await writeFile(sitePath, site.replace(insertionPoint, `${insertionPoint}\n${includeLine}`));
}

const servicePath = "/etc/systemd/system/agrisense-payment.service";
try {
  await copyFile(servicePath, `${servicePath}.pre-v2-${timestamp}`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await copyFile(path.join(releaseDirectory, "deploy/agrisense-payment.service"), servicePath);

const currentLink = "/opt/agrisense-payment/current";
const nextLink = "/opt/agrisense-payment/current.next";
try { await unlink(nextLink); } catch (error) { if (error.code !== "ENOENT") throw error; }
await symlink(releaseDirectory, nextLink, "dir");
await rename(nextLink, currentLink);

console.info(`Configured production release ${releaseDirectory}`);
