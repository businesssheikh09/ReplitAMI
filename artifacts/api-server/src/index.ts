import app from "./app";
import { logger } from "./lib/logger";
import { seedDepartmentAccounts } from "./lib/seed-departments";
import { initWhatsApp } from "./services/whatsapp";
import { startScheduler } from "./services/scheduler";
import path from "path";
import { fileURLToPath } from "url";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await seedDepartmentAccounts();

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sessionDir = path.join(__dirname, "..", "whatsapp-session");

  initWhatsApp(sessionDir).catch((e) =>
    logger.error({ err: e }, "WhatsApp init failed"),
  );

  startScheduler();
});
