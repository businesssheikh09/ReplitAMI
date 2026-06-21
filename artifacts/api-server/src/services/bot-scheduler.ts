import { db, botCampaignsTable, botCampaignSendsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { sendWhatsAppMessage } from "./whatsapp.js";
import { logger } from "../lib/logger.js";

type BotContact = { jid: string; name: string | null };

function randomDelayMs(): number {
  return Math.floor(Math.random() * 20_000) + 20_000;
}

async function tick(): Promise<void> {
  const now = new Date();

  const [campaign] = await db
    .select()
    .from(botCampaignsTable)
    .where(
      sql`status = 'running' AND next_send_at IS NOT NULL AND next_send_at <= ${now}`,
    )
    .limit(1);

  if (!campaign) return;

  const contacts = campaign.contacts as BotContact[];
  if (campaign.currentIndex >= contacts.length) {
    await db
      .update(botCampaignsTable)
      .set({ status: "done", nextSendAt: null })
      .where(eq(botCampaignsTable.id, campaign.id));
    logger.info({ campaignId: campaign.id }, "Bot campaign completed");
    return;
  }

  const contact = contacts[campaign.currentIndex];

  let waMessageId: string | null = null;
  try {
    const result = await sendWhatsAppMessage(contact.jid, campaign.message);
    waMessageId = result.waMessageId;
    logger.info({ campaignId: campaign.id, jid: contact.jid, index: campaign.currentIndex }, "Bot sent message");
  } catch (err) {
    logger.warn({ err, jid: contact.jid, campaignId: campaign.id }, "Bot failed to send — skipping contact");
  }

  await db.insert(botCampaignSendsTable).values({
    campaignId: campaign.id,
    jid: contact.jid,
    name: contact.name,
    waMessageId,
  });

  const newIndex = campaign.currentIndex + 1;

  if (newIndex >= contacts.length) {
    await db
      .update(botCampaignsTable)
      .set({ currentIndex: newIndex, status: "done", nextSendAt: null })
      .where(eq(botCampaignsTable.id, campaign.id));
    logger.info({ campaignId: campaign.id, total: contacts.length }, "Bot campaign finished — all contacts done");
  } else {
    const delay = randomDelayMs();
    await db
      .update(botCampaignsTable)
      .set({
        currentIndex: newIndex,
        nextSendAt: new Date(Date.now() + delay),
      })
      .where(eq(botCampaignsTable.id, campaign.id));
  }
}

export function startBotScheduler(): void {
  setInterval(() => {
    tick().catch((err) => logger.error({ err }, "Bot scheduler tick error"));
  }, 5_000);
  logger.info("Bot campaign scheduler started");
}
