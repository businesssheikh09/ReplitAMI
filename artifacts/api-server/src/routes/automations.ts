import { Router } from "express";
import { db, automationConfigsTable, automationLogsTable } from "@workspace/db";
import { eq, desc, and, count, gte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { AUTOMATION_DEFINITIONS, runAutomationByType } from "../services/automation-scheduler.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ── List all automations with status ─────────────────────────────────────────
router.get("/automations", requireAuth, async (_req, res) => {
  const configs = await db.select().from(automationConfigsTable);
  const configMap = new Map(configs.map((c) => [c.type, c]));

  const automations = AUTOMATION_DEFINITIONS.map((def) => {
    const config = configMap.get(def.type);
    return {
      type: def.type,
      name: def.name,
      description: def.description,
      defaultCron: def.defaultCron,
      enabled: config?.enabled ?? false,
      cronExpression: config?.cronExpression ?? def.defaultCron,
      lastRunAt: config?.lastRunAt ?? null,
      successCount: config?.successCount ?? 0,
      failureCount: config?.failureCount ?? 0,
      lastStatus: config?.lastStatus ?? "idle",
      templateOverride: config?.templateOverride ?? null,
    };
  });

  res.json({ automations });
});

// ── Get single automation ────────────────────────────────────────────────────
router.get("/automations/:type", requireAuth, async (req, res) => {
  const type = req.params["type"] as string;
  const def = AUTOMATION_DEFINITIONS.find((d) => d.type === type);
  if (!def) { res.status(404).json({ error: "Automation not found" }); return; }

  const [config] = await db
    .select()
    .from(automationConfigsTable)
    .where(eq(automationConfigsTable.type, type));

  res.json({
    type: def.type,
    name: def.name,
    description: def.description,
    defaultCron: def.defaultCron,
    enabled: config?.enabled ?? false,
    cronExpression: config?.cronExpression ?? def.defaultCron,
    lastRunAt: config?.lastRunAt ?? null,
    successCount: config?.successCount ?? 0,
    failureCount: config?.failureCount ?? 0,
    lastStatus: config?.lastStatus ?? "idle",
    templateOverride: config?.templateOverride ?? null,
  });
});

// ── Update automation config ─────────────────────────────────────────────────
router.patch("/automations/:type", requireAuth, async (req, res) => {
  const type = req.params["type"] as string;
  const def = AUTOMATION_DEFINITIONS.find((d) => d.type === type);
  if (!def) { res.status(404).json({ error: "Automation not found" }); return; }

  const { enabled, cronExpression, templateOverride } = req.body as {
    enabled?: boolean;
    cronExpression?: string;
    templateOverride?: string;
  };

  // Upsert the config row
  await db
    .insert(automationConfigsTable)
    .values({
      type,
      enabled: enabled ?? false,
      cronExpression: cronExpression ?? def.defaultCron,
      templateOverride: templateOverride ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: automationConfigsTable.type,
      set: {
        ...(enabled !== undefined ? { enabled } : {}),
        ...(cronExpression !== undefined ? { cronExpression } : {}),
        ...(templateOverride !== undefined ? { templateOverride } : {}),
        updatedAt: new Date(),
      },
    });

  const [updated] = await db
    .select()
    .from(automationConfigsTable)
    .where(eq(automationConfigsTable.type, type));

  req.log.info({ type, enabled }, "Automation config updated");
  res.json(updated);
});

// ── Manual run (fire-and-forget) ─────────────────────────────────────────────
router.post("/automations/:type/run", requireAuth, async (req, res) => {
  const type = req.params["type"] as string;
  const def = AUTOMATION_DEFINITIONS.find((d) => d.type === type);
  if (!def) { res.status(404).json({ error: "Automation not found" }); return; }

  req.log.info({ type }, "Manual automation run triggered");
  res.json({ ok: true, message: `${def.name} started` });

  // Fire and forget
  runAutomationByType(type).catch((err: unknown) =>
    logger.error({ err, type }, "Manual automation run error"),
  );
});

// ── Get logs for a specific automation ───────────────────────────────────────
router.get("/automations/:type/logs", requireAuth, async (req, res) => {
  const type = req.params["type"] as string;
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);

  const logs = await db
    .select()
    .from(automationLogsTable)
    .where(eq(automationLogsTable.automationType, type))
    .orderBy(desc(automationLogsTable.createdAt))
    .limit(limit);

  res.json({ logs });
});

// ── Get all automation logs (paginated) ──────────────────────────────────────
router.get("/automation-logs", requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 100), 500);
  const typeFilter = req.query["type"] as string | undefined;

  const logs = await db
    .select()
    .from(automationLogsTable)
    .where(typeFilter ? eq(automationLogsTable.automationType, typeFilter) : undefined)
    .orderBy(desc(automationLogsTable.createdAt))
    .limit(limit);

  res.json({ logs });
});

// ── Dashboard summary for automations ────────────────────────────────────────
router.get("/automations-summary", requireAuth, async (_req, res) => {
  const configs = await db.select().from(automationConfigsTable);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todaySentRow] = await db
    .select({ c: count() })
    .from(automationLogsTable)
    .where(and(eq(automationLogsTable.status, "sent"), gte(automationLogsTable.triggeredAt, today)));

  const running = configs.filter((c) => c.lastStatus === "running").length;
  const failed  = configs.filter((c) => c.lastStatus === "failure").length;
  const enabled = configs.filter((c) => c.enabled).length;

  res.json({
    running,
    failed,
    enabled,
    todaySent: Number(todaySentRow?.c ?? 0),
    total: AUTOMATION_DEFINITIONS.length,
  });
});

export default router;
