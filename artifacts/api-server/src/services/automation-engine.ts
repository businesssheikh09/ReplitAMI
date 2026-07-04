/**
 * Automation Engine — core runner used by every automation type.
 * Handles: logging, duplicate detection, per-type DB state updates, in-memory locking.
 */
import { db, automationConfigsTable, automationLogsTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

// ── In-memory lock (prevents concurrent runs of the same automation type) ─────
const runningLocks = new Set<string>();

export interface AutomationResult {
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}

// ── Log a single automation execution event ────────────────────────────────────
export async function logAutomationEvent(opts: {
  automationType: string;
  entityType?: string;
  entityId?: number;
  recipient?: string;
  messagePreview?: string;
  status: "sent" | "failed" | "skipped";
  errorMessage?: string;
  executionTime?: number;
}) {
  try {
    await db.insert(automationLogsTable).values({
      automationType: opts.automationType,
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
      triggeredAt: new Date(),
      recipient: opts.recipient ?? null,
      messagePreview: opts.messagePreview ? opts.messagePreview.slice(0, 500) : null,
      status: opts.status,
      errorMessage: opts.errorMessage ?? null,
      executionTime: opts.executionTime ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to write automation log");
  }
}

// ── Check if a message was already sent today for this entity ─────────────────
export async function isDuplicateToday(
  automationType: string,
  entityId: number,
  recipient: string,
): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [existing] = await db
    .select({ id: automationLogsTable.id })
    .from(automationLogsTable)
    .where(
      and(
        eq(automationLogsTable.automationType, automationType),
        eq(automationLogsTable.entityId, entityId),
        eq(automationLogsTable.recipient, recipient),
        eq(automationLogsTable.status, "sent"),
        gte(automationLogsTable.triggeredAt, todayStart),
      ),
    )
    .limit(1);

  return !!existing;
}

// ── Run an automation with full state management ───────────────────────────────
export async function runAutomation(
  type: string,
  runner: () => Promise<AutomationResult>,
): Promise<AutomationResult> {
  if (runningLocks.has(type)) {
    logger.warn({ type }, "Automation already running — skipping concurrent start");
    return { sent: 0, skipped: 0, failed: 0, errors: ["Already running"] };
  }

  runningLocks.add(type);
  const startMs = Date.now();

  // Mark as running
  try {
    await db
      .insert(automationConfigsTable)
      .values({ type, enabled: true, lastStatus: "running", updatedAt: new Date() })
      .onConflictDoUpdate({
        target: automationConfigsTable.type,
        set: { lastStatus: "running", updatedAt: new Date() },
      });
  } catch (_) { /* non-fatal */ }

  let result: AutomationResult = { sent: 0, skipped: 0, failed: 0, errors: [] };

  try {
    result = await runner();

    const durationMs = Date.now() - startMs;
    const succeeded = result.failed === 0;

    await db
      .insert(automationConfigsTable)
      .values({
        type,
        enabled: true,
        lastRunAt: new Date(),
        lastStatus: succeeded ? "success" : "partial",
        successCount: result.sent,
        failureCount: result.failed,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: automationConfigsTable.type,
        set: {
          lastRunAt: new Date(),
          lastStatus: succeeded ? "success" : "partial",
          successCount: sql`${automationConfigsTable.successCount} + ${result.sent}`,
          failureCount: sql`${automationConfigsTable.failureCount} + ${result.failed}`,
          updatedAt: new Date(),
        },
      });

    logger.info({ type, ...result, durationMs }, "Automation run complete");
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    result.failed++;
    result.errors.push(msg);

    await db
      .insert(automationConfigsTable)
      .values({
        type,
        enabled: true,
        lastRunAt: new Date(),
        lastStatus: "failure",
        failureCount: 1,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: automationConfigsTable.type,
        set: {
          lastRunAt: new Date(),
          lastStatus: "failure",
          failureCount: sql`${automationConfigsTable.failureCount} + 1`,
          updatedAt: new Date(),
        },
      });

    logger.error({ err, type }, "Automation run failed");
  } finally {
    runningLocks.delete(type);
  }

  return result;
}

// ── Get config for an automation type (with defaults) ────────────────────────
export async function getAutomationConfig(type: string) {
  const [row] = await db
    .select()
    .from(automationConfigsTable)
    .where(eq(automationConfigsTable.type, type));
  return row ?? null;
}

// ── Get template from website config (or fallback) ───────────────────────────
export async function getTemplate(
  key: string,
  fallback: string,
): Promise<string> {
  try {
    const { websiteConfigTable } = await import("@workspace/db");
    const [row] = await db
      .select()
      .from(websiteConfigTable)
      .where(eq(websiteConfigTable.key, key));
    return row?.value?.trim() || fallback;
  } catch {
    return fallback;
  }
}
