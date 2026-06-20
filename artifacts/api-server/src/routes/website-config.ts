import { Router } from "express";
import { db } from "@workspace/db";
import { websiteConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const DEFAULTS: Record<string, string> = {
  site_name: "Noor Al-Haram",
  hero_badge: "Sacred Journeys from Pakistan",
  hero_title: "Answer the call to the House of Allah.",
  hero_subtitle: "Curated Umrah experiences that remove every worldly distraction, leaving you entirely present for the most profound journey of your life.",
  about_title: "Your worship is your only focus.",
  about_body: "The journey to Makkah and Madinah is not a vacation; it is a profound spiritual return. At Noor Al-Haram, we carry the entire worldly burden of your journey — from the moment you leave Pakistan to the moment you step onto the cool marble of the Haram.",
  packages_title: "Curated Journeys",
  packages_subtitle: "Carefully structured packages designed to meet the needs of every pilgrim, ensuring dignity, comfort, and peace of mind.",
  contact_email: "info@nooralharam.com",
  contact_phone: "+92 21 3456 7890",
  contact_whatsapp: "+923001234567",
  announcement_banner: "",
  announcement_enabled: "false",
};

function rowsToConfig(rows: { key: string; value: string }[]) {
  const map: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) map[row.key] = row.value;
  return {
    siteName: map.site_name,
    heroBadge: map.hero_badge,
    heroTitle: map.hero_title,
    heroSubtitle: map.hero_subtitle,
    aboutTitle: map.about_title,
    aboutBody: map.about_body,
    packagesTitle: map.packages_title,
    packagesSubtitle: map.packages_subtitle,
    contactEmail: map.contact_email,
    contactPhone: map.contact_phone,
    contactWhatsapp: map.contact_whatsapp,
    announcementBanner: map.announcement_banner,
    announcementEnabled: map.announcement_enabled === "true",
  };
}

router.get("/website-config", async (req, res) => {
  const rows = await db.select().from(websiteConfigTable);
  res.json(rowsToConfig(rows));
});

router.put("/website-config", async (req, res) => {
  const session = (req as any).session;
  if (!session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = req.body as Record<string, unknown>;

  const keyMap: Record<string, string> = {
    siteName: "site_name",
    heroBadge: "hero_badge",
    heroTitle: "hero_title",
    heroSubtitle: "hero_subtitle",
    aboutTitle: "about_title",
    aboutBody: "about_body",
    packagesTitle: "packages_title",
    packagesSubtitle: "packages_subtitle",
    contactEmail: "contact_email",
    contactPhone: "contact_phone",
    contactWhatsapp: "contact_whatsapp",
    announcementBanner: "announcement_banner",
    announcementEnabled: "announcement_enabled",
  };

  for (const [camel, dbKey] of Object.entries(keyMap)) {
    if (camel in body) {
      const rawVal = body[camel];
      const val = typeof rawVal === "boolean" ? String(rawVal) : String(rawVal ?? "");
      await db
        .insert(websiteConfigTable)
        .values({ key: dbKey, value: val, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: websiteConfigTable.key,
          set: { value: val, updatedAt: new Date() },
        });
    }
  }

  const rows = await db.select().from(websiteConfigTable);
  res.json(rowsToConfig(rows));
});

export default router;
