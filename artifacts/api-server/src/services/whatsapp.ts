/**
 * WhatsApp scraper service — message persistence model
 *
 * HOW 24-HOUR RECOVERABILITY IS ACHIEVED
 * ─────────────────────────────────────────
 * Two complementary sources populate the local message store
 * (whatsapp-session/wa-message-store.json):
 *
 *   1. messaging-history.set  — fires on every (re)connection.  WhatsApp pushes
 *      recent chat history as part of the Web protocol handshake, typically
 *      covering the last several hundred messages per chat.  These are written
 *      to the store immediately, so a server restart followed by reconnection
 *      will backfill any messages received while the server was offline.
 *
 *   2. messages.upsert        — fires for every real-time incoming message.
 *      Appended to the store continuously while the socket is open.
 *
 * The store is pruned to 72 hours on every write, so the daily 1 PM scrape and
 * the manual "Sync Now" button always have a full 24-hour window available.
 *
 * IMPORTANT LIMITATION: If both the server is offline AND the user's WhatsApp
 * does not retain a given message in its history push (rare for very old or
 * large groups), those messages will not be captured.  Keep the service running
 * continuously to avoid this edge case.
 *
 * TARGET-GROUP FILTERING
 * ────────────────────────
 * WHATSAPP_TARGET_GROUPS (comma-separated name substrings) is enforced in ALL
 * code paths, including the fallback when the socket is disconnected:
 *   - Connected: resolve JID → group subject via groupFetchAllParticipating()
 *     and filter strictly.
 *   - Disconnected: if WHATSAPP_TARGET_GROUPS is set, return [] and log a
 *     warning (group membership cannot be verified without a live connection).
 *     If WHATSAPP_TARGET_GROUPS is empty/unset, return all buffered group
 *     messages (no filter required).
 */

import { logger } from "../lib/logger.js";
import { db, whatsappMessagesTable, whatsappGroupNamesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

export interface StoredMessage {
  remoteJid: string;
  text: string;
  timestamp: number;
}

export interface LiveGroup {
  jid: string;
  name: string;
  participantCount: number;
  /** Unix seconds of the most recent stored message in this group; null if none buffered. */
  lastActivityTimestamp: number | null;
}

let sessionDir: string | null = null;

function storePath(): string {
  return path.join(sessionDir ?? "/tmp", "wa-message-store.json");
}

function loadStore(): StoredMessage[] {
  try {
    const fp = storePath();
    if (!fs.existsSync(fp)) return [];
    return JSON.parse(fs.readFileSync(fp, "utf8")) as StoredMessage[];
  } catch {
    return [];
  }
}

function persistStore(msgs: StoredMessage[]): void {
  try {
    const cutoff = Date.now() / 1000 - 72 * 3600;
    const pruned = msgs.filter((m) => m.timestamp >= cutoff);
    fs.writeFileSync(storePath(), JSON.stringify(pruned), "utf8");
  } catch (err) {
    logger.warn({ err }, "Failed to persist WhatsApp message store");
  }
}

interface DbMessage {
  groupJid: string;
  senderJid: string;
  senderName: string | null;
  text: string;
  waMessageId: string | null;
  timestamp: number;
}

/** Persist messages to the DB inbox (fire-and-forget; dedup via waMessageId UNIQUE). */
async function persistMessagesToDB(messages: DbMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    await db
      .insert(whatsappMessagesTable)
      .values(
        messages.map((m) => ({
          groupJid: m.groupJid,
          senderJid: m.senderJid,
          senderName: m.senderName,
          text: m.text,
          waMessageId: m.waMessageId,
          timestamp: m.timestamp,
        }))
      )
      .onConflictDoNothing();
  } catch (err) {
    logger.warn({ err }, "Failed to persist WhatsApp messages to DB");
  }
}

/**
 * Import all existing JSON-store messages into the DB inbox.
 * Messages backfilled this way use senderJid='wa-store-backfill' as a marker,
 * which lets subsequent calls skip already-imported rows efficiently.
 * Runs automatically on every WhatsApp connection open.
 */
async function backfillJsonStoreToDB(): Promise<void> {
  try {
    const stored = loadStore().filter((m) => m.remoteJid.endsWith("@g.us"));
    if (stored.length === 0) return;

    // Find (groupJid, timestamp) pairs already backfilled so we don't re-insert
    const existing = await db.execute(
      sql`SELECT group_jid, timestamp FROM whatsapp_messages WHERE sender_jid = 'wa-store-backfill'`
    );
    const seen = new Set(
      (existing.rows as Array<{ group_jid: string; timestamp: string | number }>).map(
        (r) => `${r.group_jid}|${Number(r.timestamp)}`
      )
    );

    const novel = stored.filter((m) => !seen.has(`${m.remoteJid}|${m.timestamp}`));
    if (novel.length === 0) return;

    const CHUNK = 200;
    for (let i = 0; i < novel.length; i += CHUNK) {
      const chunk = novel.slice(i, i + CHUNK);
      await db
        .insert(whatsappMessagesTable)
        .values(
          chunk.map((m) => ({
            groupJid: m.remoteJid,
            senderJid: "wa-store-backfill",
            senderName: null,
            text: m.text,
            waMessageId: null,
            timestamp: m.timestamp,
            isRead: true,
          }))
        )
        .onConflictDoNothing();
    }
    logger.info({ count: novel.length }, "Backfilled WhatsApp JSON store → DB");
  } catch (err) {
    logger.warn({ err }, "Failed to backfill WhatsApp messages to DB");
  }
}

/** Trigger backfill from the public API (called by the inbox sync button). */
export async function triggerBackfill(): Promise<{ inserted: number }> {
  const stored = loadStore().filter((m) => m.remoteJid.endsWith("@g.us"));
  const before = stored.length;
  await backfillJsonStoreToDB();
  return { inserted: before };
}

/**
 * Fetch every WhatsApp group the linked phone participates in and upsert
 * their subjects (names) into whatsapp_group_names.
 * Called automatically on every successful connect; also exposed via API for
 * manual refresh from the inbox toolbar.
 */
export async function syncGroupNamesToDB(): Promise<{ upserted: number }> {
  if (!currentSock) {
    logger.warn("syncGroupNamesToDB: WhatsApp not connected — skipping");
    return { upserted: 0 };
  }
  try {
    const groups = await currentSock.groupFetchAllParticipating() as Record<string, { subject: string }>;
    const entries = Object.entries(groups).filter(([jid]) => jid.endsWith("@g.us"));
    if (entries.length === 0) return { upserted: 0 };
    await db
      .insert(whatsappGroupNamesTable)
      .values(entries.map(([jid, meta]) => ({ jid, subject: meta.subject, syncedAt: new Date() })))
      .onConflictDoUpdate({
        target: whatsappGroupNamesTable.jid,
        set: { subject: sql`excluded.subject`, syncedAt: sql`now()` },
      });
    logger.info({ count: entries.length }, "Synced WhatsApp group names → DB");
    return { upserted: entries.length };
  } catch (err) {
    logger.error({ err }, "Failed to sync group names to DB");
    return { upserted: 0 };
  }
}

/** Append a batch of messages, deduplicating by (jid + timestamp + text). */
function appendMessages(incoming: StoredMessage[]): void {
  if (incoming.length === 0) return;
  const existing = loadStore();
  const seen = new Set(existing.map((m) => `${m.remoteJid}|${m.timestamp}|${m.text}`));
  const novel = incoming.filter((m) => !seen.has(`${m.remoteJid}|${m.timestamp}|${m.text}`));
  if (novel.length === 0) return;
  persistStore([...existing, ...novel]);
  logger.debug({ count: novel.length }, "Appended messages to WhatsApp store");
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";
let connectionStatus: ConnectionStatus = "disconnected";

/** Latest QR code string from Baileys; null once connected or before first generation. */
let currentQR: string | null = null;

export function getConnectionStatus(): ConnectionStatus {
  return connectionStatus;
}

export function getQRCode(): string | null {
  return currentQR;
}

/**
 * Resolver set when the socket is open.
 * Accepts target-group name substrings and returns filtered, timestamped messages.
 */
let _resolveMessages:
  | ((targetGroups: string[], sinceHours: number) => Promise<{ groupName: string; text: string; timestamp: number }[]>)
  | null = null;

/** Set when connected; used by getLiveGroups() to fetch the group list. */
let _fetchLiveGroups: (() => Promise<LiveGroup[]>) | null = null;

/** Active Baileys socket — kept so disconnectWhatsApp() can call logout(). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentSock: any = null;

/** Set to true when a user-initiated logout is in progress. */
let logoutRequested = false;

async function loadBaileys() {
  return import("@whiskeysockets/baileys") as Promise<typeof import("@whiskeysockets/baileys")>;
}

export async function initWhatsApp(dir: string): Promise<void> {
  sessionDir = dir;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  logger.info("WhatsApp service initialising (session dir: %s)", dir);

  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
  } = await loadBaileys();

  connectionStatus = "connecting";

  const { state, saveCreds } = await useMultiFileAuthState(dir);

  const sock = makeWASocket({
    auth: state,
    browser: Browsers.ubuntu("Chrome"),
    printQRInTerminal: true,
    logger: {
      level: "silent",
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: (msg: unknown) => logger.warn(msg, "[Baileys]"),
      error: (msg: unknown) => logger.error(msg, "[Baileys]"),
      fatal: (msg: unknown) => logger.fatal(msg, "[Baileys]"),
      child: () =>
        ({
          trace: () => {},
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
          fatal: () => {},
          child: () => ({}),
        }) as unknown as ReturnType<typeof sock.logger.child>,
    } as unknown as Parameters<typeof makeWASocket>[0]["logger"],
  });

  currentSock = sock;
  sock.ev.on("creds.update", saveCreds);

  // ── Source 2: real-time incoming messages ─────────────────────────────────
  sock.ev.on("messages.upsert", ({ messages }) => {
    const toAdd: StoredMessage[] = [];
    const toDb: DbMessage[] = [];
    for (const msg of messages) {
      const jid = msg.key.remoteJid ?? "";
      if (!jid.endsWith("@g.us")) continue;
      if (msg.key.fromMe) continue;
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";
      if (!text) continue;
      const ts = (msg.messageTimestamp as number) ?? Math.floor(Date.now() / 1000);
      toAdd.push({ remoteJid: jid, text, timestamp: ts });
      toDb.push({
        groupJid: jid,
        senderJid: msg.key.participant ?? "unknown@s.whatsapp.net",
        senderName: (msg as any).pushName ?? null,
        text,
        waMessageId: msg.key.id ?? null,
        timestamp: ts,
      });
    }
    appendMessages(toAdd);
    void persistMessagesToDB(toDb);
  });

  // ── Source 1: WhatsApp history sync on (re)connection ────────────────────
  // WhatsApp pushes recent message history immediately after the handshake.
  // Capturing it here fills the gap for messages received during downtime.
  sock.ev.on("messaging-history.set", ({ messages }) => {
    const toAdd: StoredMessage[] = [];
    const toDb: DbMessage[] = [];
    for (const msg of messages) {
      const jid = msg.key?.remoteJid ?? "";
      if (!jid.endsWith("@g.us")) continue;
      if (msg.key?.fromMe) continue;
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";
      if (!text) continue;
      const ts =
        typeof msg.messageTimestamp === "number"
          ? msg.messageTimestamp
          : typeof msg.messageTimestamp === "bigint"
            ? Number(msg.messageTimestamp)
            : Math.floor(Date.now() / 1000);
      toAdd.push({ remoteJid: jid, text, timestamp: ts });
      toDb.push({
        groupJid: jid,
        senderJid: msg.key?.participant ?? "unknown@s.whatsapp.net",
        senderName: (msg as any).pushName ?? null,
        text,
        waMessageId: msg.key?.id ?? null,
        timestamp: ts,
      });
    }
    if (toAdd.length > 0) {
      logger.info({ count: toAdd.length }, "Backfilled messages from WhatsApp history sync");
      appendMessages(toAdd);
      void persistMessagesToDB(toDb);
    }
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Capture the QR string so the API can serve it to the UI
    if (qr) {
      currentQR = qr;
      logger.info("WhatsApp QR code refreshed — available at GET /api/group-tickets/qr");
    }

    if (connection === "open") {
      currentQR = null; // clear QR once linked
      connectionStatus = "connected";
      logger.info("WhatsApp session connected");
      void backfillJsonStoreToDB();
      // Populate/refresh group name cache so the inbox can show real names
      // and filter by business keywords instead of raw JIDs.
      void syncGroupNamesToDB();

      _resolveMessages = async (targetGroups, sinceHours) => {
        const sinceTs = Math.floor(Date.now() / 1000) - sinceHours * 3600;

        // Resolve group subjects — required for target-group name matching
        let groups: Record<string, { subject: string; participants?: unknown[] }> = {};
        try {
          groups = await sock.groupFetchAllParticipating();
        } catch (err) {
          logger.error({ err }, "Failed to fetch WhatsApp group list — aborting scrape to avoid ingesting unrelated groups");
          return [];
        }

        const subjectOf = (jid: string): string => groups[jid]?.subject ?? jid;

        // Build allowed JID set from target group name substrings
        const targetJids =
          targetGroups.length === 0
            ? null // no filter — accept all groups
            : Object.entries(groups)
                .filter(([, meta]) =>
                  targetGroups.some((t) =>
                    meta.subject.toLowerCase().includes(t.toLowerCase()),
                  ),
                )
                .map(([jid]) => jid);

        if (targetGroups.length > 0 && targetJids !== null && targetJids.length === 0) {
          logger.warn(
            { targetGroups },
            "No WhatsApp groups matched WHATSAPP_TARGET_GROUPS — returning empty. " +
            "Check that the group name substrings are correct.",
          );
        }

        const stored = loadStore();
        return stored
          .filter((m) => {
            if (!m.remoteJid.endsWith("@g.us")) return false; // groups only — never personal chats
            if (m.timestamp < sinceTs) return false;
            if (targetJids !== null && !targetJids.includes(m.remoteJid)) return false;
            return true;
          })
          .map((m) => ({
            groupName: subjectOf(m.remoteJid),
            text: m.text,
            timestamp: m.timestamp,
          }));
      };

      // Expose live group fetch for the group-selection UI
      _fetchLiveGroups = async (): Promise<LiveGroup[]> => {
        let groups: Record<string, { subject: string; participants?: unknown[] }> = {};
        try {
          groups = await sock.groupFetchAllParticipating();
        } catch (err) {
          logger.error({ err }, "Failed to fetch live WhatsApp groups");
          throw err;
        }

        // Build last-activity map from the buffered message store
        const lastMsgTs: Record<string, number> = {};
        for (const m of loadStore()) {
          if (m.remoteJid.endsWith("@g.us")) {
            if (!lastMsgTs[m.remoteJid] || m.timestamp > lastMsgTs[m.remoteJid]) {
              lastMsgTs[m.remoteJid] = m.timestamp;
            }
          }
        }

        return Object.entries(groups)
          .filter(([jid]) => jid.endsWith("@g.us"))
          .map(([jid, meta]) => ({
            jid,
            name: meta.subject,
            participantCount: Array.isArray(meta.participants) ? meta.participants.length : 0,
            lastActivityTimestamp: lastMsgTs[jid] ?? null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
      };
    }

    if (connection === "close") {
      connectionStatus = "disconnected";
      _resolveMessages = null;
      _fetchLiveGroups = null;
      const statusCode = (
        lastDisconnect?.error as { output?: { statusCode?: number } } | null
      )?.output?.statusCode;
      const wasLogout = logoutRequested;
      logoutRequested = false;
      currentSock = null;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect || wasLogout) {
        if (wasLogout) {
          logger.info("WhatsApp account disconnected by user — re-initialising with fresh QR…");
        } else {
          logger.warn("WhatsApp disconnected — reconnecting in 5 s…");
        }
        setTimeout(() => initWhatsApp(dir), wasLogout ? 1000 : 5000);
      } else {
        logger.warn("WhatsApp logged out externally. Delete whatsapp-session/ and restart to re-link.");
      }
    }
  });
}

/**
 * Return messages from the last `sinceHours` hours, filtered to target groups.
 *
 * Filtering contract:
 *   - Connected: groups resolved via groupFetchAllParticipating(); metadata
 *     failure aborts the scrape (returns []) to avoid ingesting stray groups.
 *   - Disconnected + target groups configured: returns [] with a warning.
 *     Group membership cannot be verified without a live connection.
 *   - Disconnected + no target groups: returns all buffered group messages.
 */
export async function getRecentGroupMessages(
  targetGroups: string[],
  sinceHours = 24,
): Promise<{ groupName: string; text: string; timestamp: number }[]> {
  if (_resolveMessages) {
    return _resolveMessages(targetGroups, sinceHours);
  }

  // ── Fallback: socket not connected ────────────────────────────────────────
  if (targetGroups.length > 0) {
    // Cannot verify group membership — strict enforcement requires a connection
    logger.warn(
      { targetGroups },
      "WhatsApp not connected: cannot enforce WHATSAPP_TARGET_GROUPS filtering. " +
      "Returning empty result to avoid ingesting unrelated groups.",
    );
    return [];
  }

  // No filter configured — return all buffered group messages; @g.us guard is mandatory
  const sinceTs = Math.floor(Date.now() / 1000) - sinceHours * 3600;
  return loadStore()
    .filter((m) => m.remoteJid.endsWith("@g.us") && m.timestamp >= sinceTs)
    .map((m) => ({ groupName: m.remoteJid, text: m.text, timestamp: m.timestamp }));
}

/**
 * Return all WhatsApp groups the linked phone is currently in.
 * Only @g.us JIDs are returned — personal chats are excluded by design.
 * Throws "WhatsApp not connected" if the socket is not open.
 */
export async function getLiveGroups(): Promise<LiveGroup[]> {
  if (!_fetchLiveGroups) throw new Error("WhatsApp not connected");
  return _fetchLiveGroups();
}

/**
 * Disconnect the current WhatsApp session and wipe the session directory so
 * the next initWhatsApp call presents a fresh QR code.
 * Throws if no socket is currently active.
 */
export async function disconnectWhatsApp(): Promise<void> {
  if (!currentSock) throw new Error("WhatsApp not connected");
  logoutRequested = true;
  try {
    await currentSock.logout();
  } catch {
    try { currentSock.end(undefined); } catch { /* ignore */ }
  }
  // Session dir is wiped so the next initWhatsApp starts clean
  if (sessionDir) {
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      fs.mkdirSync(sessionDir, { recursive: true });
      logger.info("WhatsApp session directory cleared — next start will show a fresh QR code");
    } catch (err) {
      logger.warn({ err }, "Failed to clear WhatsApp session directory after logout");
    }
  }
}

export function getRecentGroupMessagesByJids(
  targetJids: string[],
  sinceHours = 24,
  jidNames: Record<string, string> = {},
): { groupName: string; text: string; timestamp: number }[] {
  const sinceTs = Math.floor(Date.now() / 1000) - sinceHours * 3600;
  const jidSet = targetJids.length > 0 ? new Set(targetJids) : null;
  return loadStore()
    .filter((m) => {
      if (!m.remoteJid.endsWith("@g.us")) return false; // strict: groups only
      if (m.timestamp < sinceTs) return false;
      if (jidSet !== null && !jidSet.has(m.remoteJid)) return false;
      return true;
    })
    .map((m) => ({
      groupName: jidNames[m.remoteJid] ?? m.remoteJid,
      text: m.text,
      timestamp: m.timestamp,
    }));
}
