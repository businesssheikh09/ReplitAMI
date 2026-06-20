import { logger } from "../lib/logger.js";
import fs from "fs";
import path from "path";

export interface BufferedMessage {
  remoteJid: string;
  text: string;
  timestamp: number;
}

let sessionDir: string | null = null;

function bufferFilePath(): string {
  return path.join(sessionDir ?? "/tmp", "message-buffer.json");
}

function loadBuffer(): BufferedMessage[] {
  try {
    const fp = bufferFilePath();
    if (!fs.existsSync(fp)) return [];
    return JSON.parse(fs.readFileSync(fp, "utf8")) as BufferedMessage[];
  } catch {
    return [];
  }
}

function saveBuffer(msgs: BufferedMessage[]): void {
  try {
    const cutoff = Date.now() / 1000 - 48 * 3600;
    const pruned = msgs.filter((m) => m.timestamp >= cutoff);
    fs.writeFileSync(bufferFilePath(), JSON.stringify(pruned), "utf8");
  } catch (err) {
    logger.warn({ err }, "Failed to persist message buffer");
  }
}

function appendToBuffer(msg: BufferedMessage): void {
  const existing = loadBuffer();
  existing.push(msg);
  saveBuffer(existing);
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";
let connectionStatus: ConnectionStatus = "disconnected";

let _getRecentMessages:
  | ((targetGroups: string[], sinceHours: number) => Promise<{ groupName: string; text: string; timestamp: number }[]>)
  | null = null;

export function getConnectionStatus(): ConnectionStatus {
  return connectionStatus;
}

async function loadBaileys() {
  return import("@whiskeysockets/baileys") as Promise<typeof import("@whiskeysockets/baileys")>;
}

export async function initWhatsApp(dir: string): Promise<void> {
  sessionDir = dir;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

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
      warn: (msg: unknown) => logger.warn(msg, "[WhatsApp]"),
      error: (msg: unknown) => logger.error(msg, "[WhatsApp]"),
      fatal: (msg: unknown) => logger.fatal(msg, "[WhatsApp]"),
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

  sock.ev.on("creds.update", saveCreds);

  // ── Persist incoming group messages to the file-based buffer ──────────────
  sock.ev.on("messages.upsert", ({ messages }) => {
    for (const msg of messages) {
      const jid = msg.key.remoteJid ?? "";
      if (!jid.endsWith("@g.us")) continue;       // groups only
      if (msg.key.fromMe) continue;                // skip own messages
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";
      if (!text) continue;
      appendToBuffer({
        remoteJid: jid,
        text,
        timestamp: (msg.messageTimestamp as number) ?? Math.floor(Date.now() / 1000),
      });
    }
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      connectionStatus = "connected";
      logger.info("WhatsApp session connected");

      // Build a resolver that maps JIDs to group subjects and filters by target group names
      _getRecentMessages = async (targetGroups: string[], sinceHours: number) => {
        const sinceTs = Math.floor(Date.now() / 1000) - sinceHours * 3600;

        // Fetch all participating groups to resolve JID → subject
        let groups: Record<string, { subject: string }> = {};
        try {
          groups = await sock.groupFetchAllParticipating();
        } catch (err) {
          logger.warn({ err }, "Failed to fetch group list — returning all buffered messages");
        }

        const subjectOf = (jid: string): string =>
          groups[jid]?.subject ?? jid;

        // Determine which JIDs match the configured target group names
        const targetJids =
          targetGroups.length === 0
            ? null // no filter — include all groups
            : Object.entries(groups)
                .filter(([, meta]) =>
                  targetGroups.some((t) =>
                    meta.subject.toLowerCase().includes(t.toLowerCase()),
                  ),
                )
                .map(([jid]) => jid);

        const buffered = loadBuffer();
        return buffered
          .filter((m) => {
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
    }

    if (connection === "close") {
      connectionStatus = "disconnected";
      const statusCode = (
        lastDisconnect?.error as { output?: { statusCode?: number } } | null
      )?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        logger.warn("WhatsApp disconnected — reconnecting in 5 s…");
        setTimeout(() => initWhatsApp(dir), 5000);
      } else {
        logger.warn(
          "WhatsApp logged out. Delete the whatsapp-session folder and restart to re-link.",
        );
      }
    }
  });
}

export async function getRecentGroupMessages(
  targetGroups: string[],
  sinceHours = 24,
): Promise<{ groupName: string; text: string; timestamp: number }[]> {
  if (!_getRecentMessages) {
    logger.warn("WhatsApp not connected — reading from local buffer without group-name resolution");
    // Fall back to raw buffer so a scrape after a restart still processes persisted messages
    const sinceTs = Math.floor(Date.now() / 1000) - sinceHours * 3600;
    return loadBuffer()
      .filter((m) => m.timestamp >= sinceTs)
      .map((m) => ({ groupName: m.remoteJid, text: m.text, timestamp: m.timestamp }));
  }
  return _getRecentMessages(targetGroups, sinceHours);
}
