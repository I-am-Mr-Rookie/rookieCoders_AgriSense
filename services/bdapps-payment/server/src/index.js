import { createApp } from "./app.js";
import { BdappsClient } from "./bdapps-client.js";
import { loadConfig } from "./config.js";
import { PostgresRepository } from "./repository.js";

const config = loadConfig();
const repository = new PostgresRepository(config.databaseUrl);
const bdapps = new BdappsClient(config.bdapps);
const app = createApp({
  bdapps,
  repository,
  clientOrigin: config.clientOrigin,
  adminToken: config.adminToken,
  minChargeAmount: config.minChargeAmount,
  maxChargeAmount: config.maxChargeAmount,
  caasSubscriptionRequired: config.caasSubscriptionRequired
});

const server = app.listen(config.port, "127.0.0.1", () => {
  console.info(`bdapps server listening at http://127.0.0.1:${config.port}`);
});

async function shutdown() {
  server.close(async () => {
    await repository.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
