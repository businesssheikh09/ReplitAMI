import { logger } from "../lib/logger.js";

export interface WhatsAppMessage {
  groupName: string;
  text: string;
  timestamp: number;
}

let _getRecentMessages: ((targetGroups: string[], sinceHours: number) => Promise<WhatsAppMessage[]>) | null = null;

let baileysMod: typeof import("@whiskeysockets/baileys") | null = null;
let sessionState: { creds: unknown; keys: unknown } | null = null;

export function getConnectionStatus(): "disconnected" | "connecting" | "connected" {
  return connectionStatus;
}

let connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected";

async function loadBaileys() {
  if (!baileysMod) {
    baileysMod = await import("@whiskeysockets/baileys");
  }
  return baileysMod;
}

export async function initWhatsApp(sessionDir: string): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = await loadBaileys();

  connectionStatus = "connecting";

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  sessionState = state as unknown as { creds: unknown; keys: unknown };

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
      child: () => ({ trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({}) } as unknown as ReturnType<typeof sock.logger.child>),
    } as unknown as Parameters<typeof makeWASocket>[0]["logger"],
  });

  sock.ev.on("creds.update", saveCreds);

  const messageBuffer: WhatsAppMessage[] = [];

  sock.ev.on("messages.upsert", ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key.fromMe && msg.key.remoteJid?.endsWith("@g.us")) {
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          "";
        if (!text) continue;
        messageBuffer.push({
          groupName: "",
          text,
          timestamp: (msg.messageTimestamp as number) ?? Date.now() / 1000,
        });
      }
    }
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info(
        "WhatsApp QR code generated — scan with phone to link session",
      );
    }

    if (connection === "open") {
      connectionStatus = "connected";
      logger.info("WhatsApp session connected");

      _getRecentMessages = async (targetGroups: string[], sinceHours: number) => {
        const sinceTs = Date.now() / 1000 - sinceHours * 3600;

        const groups = await sock.groupFetchAllParticipating();
        const targetJids = Object.entries(groups)
          .filter(([, meta]) =>
            targetGroups.some((t) =>
              meta.subject.toLowerCase().includes(t.toLowerCase()),
            ),
          )
          .map(([jid]) => jid);

        const matched = messageBuffer.filter(
          (m) =>
            m.timestamp >= sinceTs &&
            (targetJids.length === 0 ||
              targetJids.some(
                (jid) => m.groupName === jid || m.groupName === "",
              )),
        );

        const groupSubjectMap = Object.fromEntries(
          Object.entries(groups).map(([jid, meta]) => [jid, meta.subject]),
        );

        return matched.map((m) => ({
          ...m,
          groupName: groupSubjectMap[m.groupName] ?? m.groupName ?? "unknown",
        }));
      };
    }

    if (connection === "close") {
      connectionStatus = "disconnected";
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | null)
        ?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        logger.warn("WhatsApp disconnected — reconnecting...");
        setTimeout(() => initWhatsApp(sessionDir), 5000);
      } else {
        logger.warn("WhatsApp logged out. Delete session and restart to re-link.");
      }
    }
  });
}

export async function getRecentGroupMessages(
  targetGroups: string[],
  sinceHours = 24,
): Promise<WhatsAppMessage[]> {
  if (!_getRecentMessages) {
    logger.warn(
      "WhatsApp not connected — returning empty message list",
    );
    return [];
  }
  return _getRecentMessages(targetGroups, sinceHours);
}
