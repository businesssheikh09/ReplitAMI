import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const automationConfigsTable = pgTable("automation_configs", {
  type:             text("type").primaryKey(),
  enabled:          boolean("enabled").notNull().default(false),
  cronExpression:   text("cron_expression").notNull().default("0 8 * * *"),
  lastRunAt:        timestamp("last_run_at"),
  nextRunAt:        timestamp("next_run_at"),
  successCount:     integer("success_count").notNull().default(0),
  failureCount:     integer("failure_count").notNull().default(0),
  lastStatus:       text("last_status").notNull().default("idle"),
  templateOverride: text("template_override"),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
});

export const automationLogsTable = pgTable("automation_logs", {
  id:             serial("id").primaryKey(),
  automationType: text("automation_type").notNull(),
  entityType:     text("entity_type"),
  entityId:       integer("entity_id"),
  triggeredAt:    timestamp("triggered_at").notNull().defaultNow(),
  recipient:      text("recipient"),
  messagePreview: text("message_preview"),
  status:         text("status").notNull().default("sent"),
  errorMessage:   text("error_message"),
  executionTime:  integer("execution_time"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
});
