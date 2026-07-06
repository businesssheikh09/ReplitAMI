import { Router } from "express";
import { db } from "@workspace/db";
import { websiteConfigTable } from "@workspace/db";

import { requireAuth } from "../middlewares/auth.js";

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
  // ── Company Branding (ERP internal) ──────────────────────────────────────────
  company_name: "Al Musafir International",
  legal_company_name: "",
  logo_url: "",
  print_logo_url: "",
  company_address: "",
  company_ntn: "",
  company_email: "",
  company_phone: "",
  company_whatsapp: "",
  company_website: "",
  bank_name: "",
  bank_account: "",
  bank_iban: "",
  swift_code: "",
  routing_no: "",
  terms_conditions: "",
  print_footer: "",
  signature_name: "",
  signature_title: "Reservation Officer",
  // ── Message Templates (Automation) ────────────────────────────────────────
  template_payment_reminder: "",
  template_hotel_reminder: "",
  template_hotel_confirmation: "",
  template_flight_reminder: "",
  template_visa_reminder: "",
  template_passport_reminder: "",
  template_vendor_followup: "",
  template_management_summary: "",
  template_refund_approved: "",
  template_refund_paid: "",
  template_pending_approvals: "",
  // ── Quotation Defaults ────────────────────────────────────────────────────
  quotation_default_currency: "SAR",
  quotation_default_validity_days: "7",
  quotation_default_terms: "",
  quotation_default_notes: "",
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
    // ── Company Branding ──────────────────────────────────────
    company_name: map.company_name,
    legal_company_name: map.legal_company_name,
    logo_url: map.logo_url,
    print_logo_url: map.print_logo_url,
    company_address: map.company_address,
    company_ntn: map.company_ntn,
    company_email: map.company_email,
    company_phone: map.company_phone,
    company_whatsapp: map.company_whatsapp,
    company_website: map.company_website,
    bank_name: map.bank_name,
    bank_account: map.bank_account,
    bank_iban: map.bank_iban,
    swift_code: map.swift_code,
    routing_no: map.routing_no,
    terms_conditions: map.terms_conditions,
    print_footer: map.print_footer,
    signature_name: map.signature_name,
    signature_title: map.signature_title,
    // ── Message Templates ──────────────────────────────────────────────────
    template_payment_reminder: map.template_payment_reminder,
    template_hotel_reminder: map.template_hotel_reminder,
    template_hotel_confirmation: map.template_hotel_confirmation,
    template_flight_reminder: map.template_flight_reminder,
    template_visa_reminder: map.template_visa_reminder,
    template_passport_reminder: map.template_passport_reminder,
    template_vendor_followup: map.template_vendor_followup,
    template_management_summary: map.template_management_summary,
    template_refund_approved: map.template_refund_approved,
    template_refund_paid: map.template_refund_paid,
    template_pending_approvals: map.template_pending_approvals,
    // ── Quotation Defaults ──────────────────────────────────────────────────
    quotation_default_currency: map.quotation_default_currency,
    quotation_default_validity_days: map.quotation_default_validity_days,
    quotation_default_terms: map.quotation_default_terms,
    quotation_default_notes: map.quotation_default_notes,
  };
}

router.get("/website-config", async (req, res) => {
  const rows = await db.select().from(websiteConfigTable);
  res.json(rowsToConfig(rows));
});

router.put("/website-config", requireAuth, async (req, res) => {
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
    company_name: "company_name",
    legal_company_name: "legal_company_name",
    logo_url: "logo_url",
    print_logo_url: "print_logo_url",
    company_address: "company_address",
    company_ntn: "company_ntn",
    company_email: "company_email",
    company_phone: "company_phone",
    company_whatsapp: "company_whatsapp",
    company_website: "company_website",
    bank_name: "bank_name",
    bank_account: "bank_account",
    bank_iban: "bank_iban",
    swift_code: "swift_code",
    routing_no: "routing_no",
    terms_conditions: "terms_conditions",
    print_footer: "print_footer",
    signature_name: "signature_name",
    signature_title: "signature_title",
    // ── Message Templates ──────────────────────────────────────────────────
    template_payment_reminder: "template_payment_reminder",
    template_hotel_reminder: "template_hotel_reminder",
    template_hotel_confirmation: "template_hotel_confirmation",
    template_flight_reminder: "template_flight_reminder",
    template_visa_reminder: "template_visa_reminder",
    template_passport_reminder: "template_passport_reminder",
    template_vendor_followup: "template_vendor_followup",
    template_management_summary: "template_management_summary",
    template_refund_approved: "template_refund_approved",
    template_refund_paid: "template_refund_paid",
    template_pending_approvals: "template_pending_approvals",
    quotation_default_currency: "quotation_default_currency",
    quotation_default_validity_days: "quotation_default_validity_days",
    quotation_default_terms: "quotation_default_terms",
    quotation_default_notes: "quotation_default_notes",
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
