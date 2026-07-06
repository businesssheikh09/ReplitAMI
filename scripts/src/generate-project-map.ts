import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

/* ── Constants ── */
const W = 595.28;
const H = 841.89;
const M = 40; // margin
const CW = W - M * 2; // content width = 515.28

const C = {
  navy:      "#1e3a5f",
  sky:       "#0ea5e9",
  purple:    "#7c3aed",
  green:     "#16a34a",
  amber:     "#d97706",
  teal:      "#0891b2",
  red:       "#dc2626",
  gray:      "#6b7280",
  violet:    "#9333ea",
  white:     "#ffffff",
  lightBg:   "#f8fafc",
  rowAlt:    "#f1f5f9",
  border:    "#cbd5e1",
  text:      "#1e293b",
  muted:     "#64748b",
  gold:      "#ca8a04",
};

/* ── Document ── */
const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false });
const outPath = path.join(process.cwd(), "project-map.pdf");
const writeStream = fs.createWriteStream(outPath);
doc.pipe(writeStream);

let pageNum = 0;

/* ── Helpers ── */
function newPage() {
  doc.addPage({ size: "A4", margin: 0 });
  pageNum++;
}

function footer(left: string) {
  doc.save();
  doc.rect(0, H - 28, W, 28).fill("#1e293b");
  doc.fontSize(7.5).font("Helvetica").fillColor("#94a3b8")
    .text(left, M, H - 17, { width: CW / 2, align: "left" });
  doc.fillColor("#94a3b8")
    .text(`Page ${pageNum}  •  Al Musafir International ERP — Project Map  •  ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
      M, H - 17, { width: CW, align: "right" });
  doc.restore();
}

function pageTitle(title: string, subtitle: string, bgColor = C.navy) {
  doc.rect(0, 0, W, 56).fill(bgColor);
  doc.fontSize(16).font("Helvetica-Bold").fillColor(C.white)
    .text(title, M, 14, { width: CW });
  doc.fontSize(9).font("Helvetica").fillColor("#bfdbfe")
    .text(subtitle, M, 34, { width: CW });
}

function sectionBar(label: string, x: number, y: number, w: number, color: string): number {
  doc.roundedRect(x, y, w, 20, 3).fill(color);
  doc.fontSize(9).font("Helvetica-Bold").fillColor(C.white)
    .text(label, x + 6, y + 6, { width: w - 12, lineBreak: false });
  return y + 24;
}

function drawBox(x: number, y: number, w: number, h: number, fill: string, stroke?: string, r = 6) {
  doc.roundedRect(x, y, w, h, r);
  if (stroke) doc.fillAndStroke(fill, stroke);
  else doc.fill(fill);
}

function arrowH(x1: number, y: number, x2: number, color: string) {
  const aLen = 7;
  doc.save();
  doc.moveTo(x1, y).lineTo(x2 - aLen, y)
    .strokeColor(color).lineWidth(1.5).stroke();
  doc.moveTo(x2, y)
    .lineTo(x2 - aLen, y - 4)
    .lineTo(x2 - aLen, y + 4)
    .closePath().fill(color);
  doc.restore();
}

function arrowV(x: number, y1: number, y2: number, color: string) {
  const aLen = 7;
  doc.save();
  doc.moveTo(x, y1).lineTo(x, y2 - aLen)
    .strokeColor(color).lineWidth(1.5).stroke();
  doc.moveTo(x, y2)
    .lineTo(x - 4, y2 - aLen)
    .lineTo(x + 4, y2 - aLen)
    .closePath().fill(color);
  doc.restore();
}

function table(
  x: number, y: number, totalW: number,
  headers: string[],
  rows: (string | { text: string; bold?: boolean; color?: string })[][][],
  colW: number[],
  headerBg: string,
  rowH = 20,
  fontSize = 8
): number {
  // header
  doc.rect(x, y, totalW, 22).fill(headerBg);
  let cx = x;
  headers.forEach((h, i) => {
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(C.white)
      .text(h, cx + 4, y + 7, { width: colW[i] - 8, lineBreak: false, align: "left" });
    cx += colW[i];
  });
  let ry = y + 22;
  rows.forEach((row, ri) => {
    doc.rect(x, ry, totalW, rowH).fill(ri % 2 === 0 ? C.white : C.rowAlt);
    let cx2 = x;
    row.forEach((cell, ci) => {
      const items = Array.isArray(cell) ? cell : [cell];
      let tx = cx2 + 4;
      const cellW = colW[ci] - 8;
      // Simple: each cell is an array of segments or a plain string
      const raw = items[0];
      if (typeof raw === "string") {
        doc.fontSize(fontSize).font("Helvetica").fillColor(C.text)
          .text(raw, tx, ry + (rowH - fontSize - 2) / 2, { width: cellW, lineBreak: false });
      } else {
        const seg = raw as { text: string; bold?: boolean; color?: string };
        doc.fontSize(fontSize)
          .font(seg.bold ? "Helvetica-Bold" : "Helvetica")
          .fillColor(seg.color ?? C.text)
          .text(seg.text, tx, ry + (rowH - fontSize - 2) / 2, { width: cellW, lineBreak: false });
      }
      cx2 += colW[ci];
    });
    doc.rect(x, ry, totalW, rowH).lineWidth(0.3).stroke(C.border);
    ry += rowH;
  });
  doc.rect(x, y, totalW, ry - y).lineWidth(0.5).stroke("#94a3b8");
  return ry;
}

function bullet(x: number, y: number, w: number, text: string, color = C.navy, size = 8.5): number {
  doc.circle(x + 4, y + size / 2 + 1, 2).fill(color);
  doc.fontSize(size).font("Helvetica").fillColor(C.text)
    .text(text, x + 10, y, { width: w - 10 });
  return doc.y + 2;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE 1 — COVER
═══════════════════════════════════════════════════════════════════════════ */
newPage();

// Full-page dark background
doc.rect(0, 0, W, H).fill(C.navy);

// Top accent bar
doc.rect(0, 0, W, 8).fill(C.sky);

// Company logo box
const logoX = M, logoY = 60;
drawBox(logoX, logoY, 70, 70, C.sky, undefined, 8);
doc.fontSize(10).font("Helvetica-Bold").fillColor(C.white)
  .text("AMI", logoX, logoY + 28, { width: 70, align: "center" });

// Company name
doc.fontSize(28).font("Helvetica-Bold").fillColor(C.white)
  .text("Al Musafir International", M + 85, logoY + 8, { width: CW - 85 });
doc.fontSize(13).font("Helvetica").fillColor("#93c5fd")
  .text("Umrah Travel ERP — Complete Project Map", M + 85, logoY + 44, { width: CW - 85 });

// Divider
doc.rect(M, logoY + 80, CW, 1.5).fill(C.sky);

// Description
const descY = logoY + 100;
doc.fontSize(11).font("Helvetica").fillColor("#e2e8f0")
  .text(
    "This document is a complete reference guide for the Al Musafir International travel management platform. " +
    "It covers every module, every user role, how data flows between systems, key operational workflows, " +
    "and a developer cost estimate — all in plain language so anyone can understand the system at a glance.",
    M, descY, { width: CW, lineGap: 3 }
  );

// What's inside box
const boxY = descY + 85;
drawBox(M, boxY, CW, 200, "#243857", C.sky, 8);
doc.fontSize(11).font("Helvetica-Bold").fillColor(C.sky)
  .text("WHAT'S INSIDE", M + 16, boxY + 16, { width: CW - 32 });

const contents = [
  ["1", "System Architecture Overview   — how the 3 apps talk to each other"],
  ["2", "User Roles & Permissions        — who can do what"],
  ["3", "ERP Module Directory            — every screen, grouped by function"],
  ["4", "Customer Journey Map            — from visitor to download"],
  ["5", "API Reference Map               — which endpoint powers which screen"],
  ["6", "Database Table Directory        — what data is stored and where"],
  ["7", "Key Operational Workflows       — step-by-step process guides"],
  ["8", "Developer Quick-Reference       — where to make changes in the code"],
  ["9", "Estimated Development Cost      — hours & cost per module in USD & PKR"],
];
let cy = boxY + 38;
contents.forEach(([num, text]) => {
  doc.fontSize(9).font("Helvetica-Bold").fillColor(C.sky)
    .text(num + ".", M + 16, cy, { width: 18, lineBreak: false });
  doc.fontSize(9).font("Helvetica").fillColor("#cbd5e1")
    .text(text, M + 34, cy, { width: CW - 50, lineBreak: false });
  cy += 17;
});

// Tech stack chips
const chipY = boxY + 230;
doc.fontSize(9).font("Helvetica-Bold").fillColor("#94a3b8")
  .text("BUILT WITH:", M, chipY);
const chips = ["Node.js 24", "TypeScript", "React + Vite", "Express 5", "PostgreSQL", "Drizzle ORM", "pnpm Workspaces"];
let chipX = M + 68;
chips.forEach(chip => {
  const cw2 = doc.widthOfString(chip) + 14;
  drawBox(chipX, chipY - 2, cw2, 16, "#2d4a6b", "#334155", 3);
  doc.fontSize(7.5).font("Helvetica").fillColor("#94a3b8")
    .text(chip, chipX + 7, chipY + 2, { lineBreak: false });
  chipX += cw2 + 6;
});

// Date + confidential
doc.fontSize(8.5).font("Helvetica").fillColor("#64748b")
  .text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}   •   Confidential — Internal Use Only`,
    M, H - 50, { width: CW, align: "center" });

doc.rect(0, H - 8, W, 8).fill(C.sky);

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE 2 — SYSTEM ARCHITECTURE OVERVIEW
═══════════════════════════════════════════════════════════════════════════ */
newPage();
pageTitle("System Architecture", "How the three applications connect to each other and to the database");

// Layout: 3 equal app boxes spanning full content width, DB + info panels below
const p2bW = Math.floor((CW - 24) / 3); // ≈163 per box with 12pt gaps
const p2gap = 12;
const p2row1Y = 75;
const p2erpX = M;
const p2apiX = M + p2bW + p2gap;
const p2webX = M + 2 * (p2bW + p2gap);
const p2bH = 140;

// ERP Box
drawBox(p2erpX, p2row1Y, p2bW, p2bH, "#eff6ff", C.navy, 8);
doc.rect(p2erpX, p2row1Y, p2bW, 26).fill(C.navy);
doc.fontSize(10).font("Helvetica-Bold").fillColor(C.white)
  .text("ERP Dashboard", p2erpX + 6, p2row1Y + 8, { width: p2bW - 12, lineBreak: false });
doc.fontSize(7.5).font("Helvetica-Bold").fillColor(C.navy)
  .text("Staff Only  •  Requires Login", p2erpX + 6, p2row1Y + 32, { width: p2bW - 12, lineBreak: false });
["Manage clients & quotations", "Hotel / Flight / Transport / Visa", "Accounting & vouchers", "WhatsApp automation", "4 roles: Management, Sales,", "  Accounts, Operations"].forEach((b, i) => {
  doc.fontSize(7).font("Helvetica").fillColor(C.text)
    .text("• " + b, p2erpX + 6, p2row1Y + 46 + i * 10, { width: p2bW - 12, lineBreak: false });
});
doc.fontSize(7).font("Helvetica-Bold").fillColor(C.muted)
  .text("/ (ERP root path)", p2erpX + 6, p2row1Y + p2bH - 14, { width: p2bW - 12, lineBreak: false });

// API Server Box
drawBox(p2apiX, p2row1Y, p2bW, p2bH, "#faf5ff", C.purple, 8);
doc.rect(p2apiX, p2row1Y, p2bW, 26).fill(C.purple);
doc.fontSize(10).font("Helvetica-Bold").fillColor(C.white)
  .text("API Server", p2apiX + 6, p2row1Y + 8, { width: p2bW - 12, lineBreak: false });
doc.fontSize(7.5).font("Helvetica-Bold").fillColor(C.purple)
  .text("Central Backend  •  Express 5", p2apiX + 6, p2row1Y + 32, { width: p2bW - 12, lineBreak: false });
["REST endpoints for all features", "JWT authentication middleware", "Drizzle ORM → PostgreSQL", "OpenAPI contract-first design", "20+ route handler files", "esbuild compiled bundle"].forEach((b, i) => {
  doc.fontSize(7).font("Helvetica").fillColor(C.text)
    .text("• " + b, p2apiX + 6, p2row1Y + 46 + i * 10, { width: p2bW - 12, lineBreak: false });
});
doc.fontSize(7).font("Helvetica-Bold").fillColor(C.muted)
  .text("/api  •  Port 5000", p2apiX + 6, p2row1Y + p2bH - 14, { width: p2bW - 12, lineBreak: false });

// Public Website Box
drawBox(p2webX, p2row1Y, p2bW, p2bH, "#f0f9ff", C.sky, 8);
doc.rect(p2webX, p2row1Y, p2bW, 26).fill(C.sky);
doc.fontSize(10).font("Helvetica-Bold").fillColor(C.white)
  .text("Public Website", p2webX + 6, p2row1Y + 8, { width: p2bW - 12, lineBreak: false });
doc.fontSize(7.5).font("Helvetica-Bold").fillColor(C.sky)
  .text("Customers  •  Public + Portal", p2webX + 6, p2row1Y + 32, { width: p2bW - 12, lineBreak: false });
["Browse packages & flights", "Flight search & GDS booking", "Package inquiry form", "Customer portal login", "View invoices / vouchers / visa", "Download documents"].forEach((b, i) => {
  doc.fontSize(7).font("Helvetica").fillColor(C.text)
    .text("• " + b, p2webX + 6, p2row1Y + 46 + i * 10, { width: p2bW - 12, lineBreak: false });
});
doc.fontSize(7).font("Helvetica-Bold").fillColor(C.muted)
  .text("/frontend  •  Public", p2webX + 6, p2row1Y + p2bH - 14, { width: p2bW - 12, lineBreak: false });

// Arrows between app boxes
const p2mid = p2row1Y + p2bH / 2;
arrowH(p2erpX + p2bW, p2mid, p2apiX, C.navy);
arrowH(p2webX, p2mid, p2apiX + p2bW, C.sky);
doc.fontSize(7).font("Helvetica").fillColor(C.navy)
  .text("REST", p2erpX + p2bW + 2, p2mid - 8, { width: p2gap - 4, lineBreak: false });
doc.fontSize(7).font("Helvetica").fillColor(C.sky)
  .text("REST", p2webX - p2gap + 2, p2mid - 8, { width: p2gap - 4, lineBreak: false });

// Database box centered under API
const p2dbY = p2row1Y + p2bH + 55;
const p2dbW = p2bW;
const p2dbX = p2apiX;
drawBox(p2dbX, p2dbY, p2dbW, 72, "#f0fdf4", C.green, 8);
doc.rect(p2dbX, p2dbY, p2dbW, 26).fill(C.green);
doc.fontSize(10).font("Helvetica-Bold").fillColor(C.white)
  .text("PostgreSQL Database", p2dbX + 6, p2dbY + 8, { width: p2dbW - 12, lineBreak: false });
["All persistent data storage", "Drizzle ORM + type-safe queries", "30+ tables across all domains"].forEach((b, i) => {
  doc.fontSize(7).font("Helvetica").fillColor(C.text)
    .text("• " + b, p2dbX + 6, p2dbY + 31 + i * 10, { width: p2dbW - 12, lineBreak: false });
});
arrowV(p2apiX + p2bW / 2, p2row1Y + p2bH, p2dbY, C.purple);
doc.fontSize(7).font("Helvetica").fillColor(C.purple)
  .text("SQL", p2apiX + p2bW / 2 + 4, p2row1Y + p2bH + 18, { width: 40, lineBreak: false });

// Bottom row: three info panels spanning full width
const p2panelY = p2dbY + 80;
const p2panelW = Math.floor(CW / 3) - 6;
const p2panels = [
  { label: "Auth Strategy", color: C.navy, items: ["ERP: JWT Bearer tokens (staff)", "Portal: Separate portal_session_token", "Public routes: No auth required"] },
  { label: "Monorepo Structure", color: C.purple, items: ["pnpm workspaces — 3 apps + 2 libs", "lib/db (Drizzle schema)", "lib/api-spec (OpenAPI + codegen)"] },
  { label: "Deployment", color: C.green, items: ["Single server + path-based proxy", "One PostgreSQL DB for all services", "esbuild bundle, Node.js 24"] },
];
p2panels.forEach((p, i) => {
  const px = M + i * (p2panelW + 8);
  drawBox(px, p2panelY, p2panelW, 78, C.lightBg, p.color, 6);
  doc.fontSize(8.5).font("Helvetica-Bold").fillColor(p.color)
    .text(p.label, px + 8, p2panelY + 8, { width: p2panelW - 16, lineBreak: false });
  p.items.forEach((item, j) => {
    doc.fontSize(7.5).font("Helvetica").fillColor(C.text)
      .text("• " + item, px + 8, p2panelY + 26 + j * 14, { width: p2panelW - 16, lineBreak: false });
  });
});

footer("System Architecture Overview");

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE 3 — USER ROLES
═══════════════════════════════════════════════════════════════════════════ */
newPage();
pageTitle("User Roles & Permissions", "Who uses the system and what each role can access");

let y3 = 70;

const roleRows = [
  [{ text: "Management", bold: true, color: C.navy }, "Owner / Senior Management", "Full access to everything — all modules, all reports, all settings, can create/edit/delete any record"],
  [{ text: "Sales", bold: true, color: C.red }, "Sales Executives", "Clients, quotations, hotel requests, follow-ups. Cannot access accounting vouchers or system settings"],
  [{ text: "Accounts", bold: true, color: C.amber }, "Finance / Accounts Team", "Full accounting access: vouchers, ledger, P&L, balance sheet, invoices. Cannot change system settings"],
  [{ text: "Operations", bold: true, color: C.teal }, "Operations Staff", "Hotels, flights, transport, visa, bookings. View-only accounting. Cannot change system settings"],
  [{ text: "Portal Customer", bold: true, color: C.sky }, "End Customers (self-registered)", "Customer portal only: own bookings, invoices, vouchers, visa docs, transport, downloads. No ERP access"],
  [{ text: "Portal DC / Agent", bold: true, color: C.violet }, "Distributor / Sub-agent", "Portal DC login: own client bookings and documents. Separate from end-customer portal. No ERP access"],
];

y3 = table(
  M, y3, CW,
  ["Role", "Who", "What They Can Access"],
  roleRows.map(r => [[r[0]], [r[1]], [r[2]]]),
  [100, 130, CW - 230],
  C.navy,
  30, 8.5
);

y3 += 20;
doc.fontSize(10).font("Helvetica-Bold").fillColor(C.text).text("HOW ROLES ARE ASSIGNED", M, y3);
y3 += 16;
doc.fontSize(8.5).font("Helvetica").fillColor(C.text)
  .text("ERP staff roles are set by a Management user in the Users section of the ERP (/users).  A new staff member receives a temporary password and must change it on first login.  Portal customers self-register at /portal-register on the public website — their account starts as 'Pending Approval' and a staff member must activate it from /portal-users in the ERP before they can log in.",
    M, y3, { width: CW, lineGap: 3 });

y3 = doc.y + 20;
doc.fontSize(10).font("Helvetica-Bold").fillColor(C.text).text("SECURITY FEATURES", M, y3);
y3 += 14;
const secFeatures = [
  ["Forced Password Change", "New staff accounts are flagged 'must change password'. The server blocks all API calls (except /change-password) until the password is changed."],
  ["Bcrypt Password Hashing", "All passwords are stored as bcrypt hashes ($2b$). Plain-text passwords from old accounts are automatically re-hashed on server startup."],
  ["Login Audit Log", "Every login attempt (success or failure), password change, and reset is written to the auth_audit_log table with timestamp and IP."],
  ["Separate Portal Auth", "Portal customers use a completely separate authentication system (portal_session_token) — a portal token cannot access ERP endpoints."],
  ["Route-Level Guards", "Every ERP API endpoint requires requireAuth middleware. Public routes (packages, currency rates, website config) are explicitly opted-out."],
];

secFeatures.forEach(([title, desc]) => {
  drawBox(M, y3, CW, 38, C.lightBg, C.border, 4);
  doc.fontSize(8.5).font("Helvetica-Bold").fillColor(C.navy)
    .text(title, M + 8, y3 + 6, { width: 150, lineBreak: false });
  doc.fontSize(8).font("Helvetica").fillColor(C.text)
    .text(desc, M + 165, y3 + 7, { width: CW - 175, lineBreak: false });
  y3 += 44;
});

footer("User Roles & Permissions");

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE 4 — ERP MODULES
═══════════════════════════════════════════════════════════════════════════ */
newPage();
pageTitle("ERP Module Directory", "Every screen in the staff dashboard, grouped by function");

const groups: { label: string; color: string; items: [string, string, string][] }[] = [
  {
    label: "CRM & Sales",
    color: C.red,
    items: [
      ["Dashboard", "/", "Summary stats: today's invoices, pending quotations, alerts"],
      ["Clients", "/crm", "Master list of all clients/parties — add, edit, view profile"],
      ["Client Profile", "/crm/:id", "Full client detail: bookings, invoices, documents, history"],
      ["Follow-Ups", "/crm/follow-ups", "Pending follow-up reminders for the sales team"],
      ["Quotations", "/quotations", "Create & manage price quotations; PDF generation"],
      ["Pending Quotes", "/quotations/pending", "Quotations awaiting client confirmation"],
      ["Hotel Requests", "/hotel-requests", "Incoming hotel availability requests from clients"],
    ],
  },
  {
    label: "Operations",
    color: C.teal,
    items: [
      ["Hotels Directory", "/hotels", "Hotel master list: name, city, stars, rooms, WhatsApp"],
      ["Vendors", "/vendors", "Vendor/supplier master list"],
      ["Transport", "/transport", "Transport bookings: vehicle type, vendor, cost, status"],
      ["Flights", "/flights", "Flight records: sector, airline, PNR, pax, fares"],
      ["Flight Cancellations", "/flights/cancellations", "Cancelled flight tracker"],
      ["BSP Report", "/flights/bsp-report", "IATA BSP billing summary report"],
      ["Passenger List", "/flights/passengers", "All passenger records across flights"],
      ["Visa Applications", "/visa", "Visa tracking: type, applicant, status, documents"],
    ],
  },
  {
    label: "Finance & Accounting",
    color: C.amber,
    items: [
      ["Invoice List", "/accounting/invoices", "All hotel DN invoices — list, filter, search"],
      ["Hotel Invoice Form", "/accounting/hotel-invoice/:id", "Create/edit hotel invoice; 3 print formats"],
      ["Vouchers", "/accounting/vouchers", "Double-entry vouchers: RV/PV/JV/CV types"],
      ["General Ledger", "/accounting/ledger", "Account-level transaction ledger"],
      ["Trial Balance", "/accounting/trial-balance", "Debit/credit balances for all accounts"],
      ["P&L Statement", "/accounting/pnl", "Profit & Loss report by date range"],
      ["Balance Sheet", "/accounting/balance-sheet", "Assets, liabilities, equity snapshot"],
      ["Financial Years", "/financial-years", "Open/close accounting periods"],
      ["Currency Settings", "/currency-settings", "Exchange rates, multi-currency config"],
    ],
  },
  {
    label: "WhatsApp & Communications",
    color: C.violet,
    items: [
      ["WhatsApp Inbox", "/whatsapp-inbox", "Read incoming WhatsApp messages"],
      ["Bot Campaigns", "/bot-campaign", "Automated message campaigns to groups/contacts"],
      ["Media Library", "/media-library", "Uploaded images/docs for WhatsApp sends"],
    ],
  },
  {
    label: "Administration & Settings",
    color: C.gray,
    items: [
      ["Users", "/users", "ERP staff accounts: add, role, reset password"],
      ["Portal Users", "/portal-users", "Customer portal accounts: approve, view, manage"],
      ["Website Settings", "/website-settings", "Branding, WhatsApp buttons, homepage config"],
      ["ERP Settings", "/erp-settings", "ERP-level configuration"],
      ["Automation Settings", "/automation-settings", "WhatsApp automation rules"],
      ["GDS Settings", "/gds-settings", "Flight GDS API credentials"],
      ["AI Settings", "/ai-settings", "OpenAI API key for OCR/AI features"],
    ],
  },
];

let y4 = 70;
groups.forEach(g => {
  if (y4 > H - 120) { /* overflow guard — won't happen with current data */ }
  y4 = sectionBar(g.label, M, y4, CW, g.color);
  g.items.forEach(([name, path2, desc]) => {
    doc.fontSize(8).font("Helvetica-Bold").fillColor(C.text)
      .text(name, M + 6, y4, { width: 120, lineBreak: false });
    doc.fontSize(7.5).font("Helvetica").fillColor(C.muted)
      .text(path2, M + 130, y4, { width: 120, lineBreak: false });
    doc.fontSize(7.5).font("Helvetica").fillColor(C.text)
      .text(desc, M + 258, y4, { width: CW - 262, lineBreak: false });
    y4 += 12;
  });
  y4 += 6;
});

footer("ERP Module Directory");

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE 5 — CUSTOMER JOURNEY
═══════════════════════════════════════════════════════════════════════════ */
newPage();
pageTitle("Customer Journey Map", "The end-to-end path a customer takes from first visit to document download");

const steps5: { num: string; title: string; where: string; desc: string; color: string }[] = [
  { num: "1", title: "Discovers the Website", where: "Public Website  •  /", color: C.sky,
    desc: "Customer lands on the homepage of Al Musafir International's public website. They see featured packages, company info, and flight search." },
  { num: "2", title: "Browses Packages", where: "Public Website  •  /packages/:id", color: C.sky,
    desc: "Customer views individual Umrah packages with details, inclusions, pricing, and hotel information." },
  { num: "3", title: "Submits an Inquiry or Books a Flight", where: "Public Website  •  /flights  or  Package Inquiry Form", color: C.teal,
    desc: "Customer either searches for a flight and books via GDS, or fills in a package inquiry form. The inquiry is stored in the database and appears in the ERP." },
  { num: "4", title: "Staff Receives & Responds", where: "ERP  •  /crm  or  /quotations", color: C.navy,
    desc: "A sales staff member sees the new inquiry in the ERP. They create a Quotation, set pricing, and send a WhatsApp message or email with the quote." },
  { num: "5", title: "Customer Registers on Portal", where: "Public Website  •  /portal-register", color: C.violet,
    desc: "After confirming interest, the customer registers for the self-service portal. Account starts as 'Pending Approval'." },
  { num: "6", title: "Staff Approves Portal Account", where: "ERP  •  /portal-users", color: C.amber,
    desc: "An operations or management staff member reviews the registration and activates the portal account. Customer receives access." },
  { num: "7", title: "Customer Logs into Portal", where: "Public Website  •  /portal-login", color: C.violet,
    desc: "Customer logs in with their email/phone and password. They land on their personal dashboard showing booking status." },
  { num: "8", title: "Views Booking Documents", where: "Portal  •  /portal/invoices  •  /portal/hotel-vouchers  •  /portal/visa", color: C.green,
    desc: "Customer can see all their invoices, hotel vouchers, visa status, transport details, and flight tickets in one place." },
  { num: "9", title: "Downloads Documents", where: "Portal  •  /portal/downloads", color: C.green,
    desc: "Customer downloads final versions of all travel documents — vouchers, visa confirmations, tickets — ready for travel." },
];

const stepH = 68;
let y5 = 70;
steps5.forEach((s, i) => {
  const bx = M;
  // Timeline dot
  const dotX = bx + 18;
  const dotY = y5 + 16;
  doc.circle(dotX, dotY, 9).fill(s.color);
  doc.fontSize(9).font("Helvetica-Bold").fillColor(C.white)
    .text(s.num, dotX - 9, dotY - 5, { width: 18, align: "center", lineBreak: false });
  // Connector line (not on last)
  if (i < steps5.length - 1) {
    doc.moveTo(dotX, dotY + 9).lineTo(dotX, y5 + stepH - 2)
      .strokeColor("#cbd5e1").lineWidth(1.5).stroke();
  }

  // Step box
  drawBox(bx + 36, y5, CW - 36, stepH - 6, s.color === C.sky || s.color === C.green ? "#f0f9ff" : (s.color === C.navy ? "#eff6ff" : (s.color === C.violet ? "#faf5ff" : (s.color === C.amber ? "#fffbeb" : "#f0fdfa"))), s.color, 5);
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor(s.color)
    .text(s.title, bx + 44, y5 + 6, { width: CW - 54, lineBreak: false });
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor(C.muted)
    .text(s.where, bx + 44, y5 + 19, { width: CW - 54, lineBreak: false });
  doc.fontSize(8).font("Helvetica").fillColor(C.text)
    .text(s.desc, bx + 44, y5 + 31, { width: CW - 54, lineBreak: false });
  y5 += stepH;
});

footer("Customer Journey Map");

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE 6 — API MODULE MAP
═══════════════════════════════════════════════════════════════════════════ */
newPage();
pageTitle("API ↔ Module Map", "Which API route file powers which part of the system");

const apiRows: [string, string, string][] = [
  ["auth.ts", "ERP Login, /users (change/reset password)", "JWT login, logout, me, change-password, reset-password"],
  ["users.ts", "ERP /users", "Staff user CRUD, role management"],
  ["portal.ts + portal-customer.ts", "Portal /portal-login, /portal/dashboard", "Portal auth, dashboard, bookings, invoices, docs"],
  ["portal-users.ts", "ERP /portal-users", "Approve/reject/list portal accounts"],
  ["clients.ts", "ERP /crm, /crm/:id", "Client/party CRUD, search, profile data"],
  ["quotations.ts", "ERP /quotations, /quotations/pending", "Quotation create/edit/status/PDF"],
  ["booking-inquiries.ts", "ERP, Public website inquiry form", "Store & list flight/booking inquiries"],
  ["package-inquiries.ts", "Public website package inquiry", "Store & list package inquiry submissions"],
  ["hotel-invoices.ts", "ERP /accounting/invoices, /hotel-invoice/:id", "DN invoice CRUD, next-DN generation"],
  ["hotels.ts", "ERP /hotels, Public /public/hotels", "Hotel master CRUD, public listing"],
  ["vendors.ts", "ERP /vendors", "Vendor/supplier CRUD"],
  ["flights.ts", "ERP /flights and sub-pages", "Flight record CRUD, BSP, cancellations, passengers"],
  ["transport.ts", "ERP /transport", "Transport booking CRUD"],
  ["visa.ts", "ERP /visa", "Visa application tracking CRUD"],
  ["vouchers.ts", "ERP /accounting/vouchers", "Double-entry voucher create/edit/post"],
  ["accounting.ts", "ERP /accounting/ledger, trial-balance", "Chart of accounts, ledger, trial balance"],
  ["accounting-reports.ts", "ERP /accounting/pnl, /balance-sheet", "P&L and balance sheet reports"],
  ["financial-year.ts", "ERP /financial-years", "Financial year CRUD, open/close"],
  ["currency-settings.ts", "ERP /currency-settings, /api/currency/rates", "Exchange rates, live rate proxy (public)"],
  ["whatsapp.ts", "ERP /whatsapp-inbox, /bot-campaign", "WhatsApp send, session, groups, inbox"],
  ["automations.ts + ai-settings.ts", "ERP /automation-settings, /ai-settings", "Automation rules, OpenAI key management"],
  ["website-config.ts", "ERP /website-settings, /api/website-config (public)", "Branding, homepage config (public read)"],
];

const apiColW = [130, 155, CW - 285];
table(M, 70, CW,
  ["API Route File", "ERP / Website Page", "What it Does"],
  apiRows.map(r => [[r[0]], [r[1]], [r[2]]]),
  apiColW, C.purple, 18, 8
);

footer("API ↔ Module Map");

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE 7 — DATABASE TABLES
═══════════════════════════════════════════════════════════════════════════ */
newPage();
pageTitle("Database Table Directory", "Every table in PostgreSQL — what it stores and how it connects");

const dbGroups: { label: string; color: string; tables: [string, string, string][] }[] = [
  { label: "Core / Authentication", color: C.navy, tables: [
    ["users", "ERP staff accounts", "Linked to: vouchers, invoices, quotations (salesman)"],
    ["portal_users", "Customer/DC portal accounts", "Linked to: clients (party)"],
    ["auth_audit_log", "Every login/logout/password event", "Linked to: users"],
  ]},
  { label: "CRM & Sales", color: C.red, tables: [
    ["clients", "Client/party master", "Linked to: quotations, invoices, portal_users"],
    ["quotations", "Price quotations with status", "Linked to: clients, users (salesman)"],
    ["hotel_requests", "Hotel availability requests", "Linked to: clients, users"],
    ["booking_inquiries", "Inbound flight/booking inquiries", "Standalone + client link"],
    ["package_inquiries", "Inbound package inquiries from website", "Standalone"],
  ]},
  { label: "Operations", color: C.teal, tables: [
    ["hotels", "Hotel master: name, city, stars, rooms", "Linked to: hotel_invoices"],
    ["vendors", "Supplier/vendor master", "Linked to: hotel_invoices, transport_bookings"],
    ["hotel_invoices", "Hotel DN invoices", "Linked to: clients, vendors, hotels, users"],
    ["flights", "Flight segment records", "Linked to: clients, passengers"],
    ["group_tickets", "Group flight ticket records", "Linked to: flights"],
    ["transport_bookings", "Transport bookings", "Linked to: clients, vendors"],
    ["visa_applications", "Visa applications", "Linked to: clients"],
    ["passenger_documents", "Uploaded passport/visa scans", "Linked to: clients, portal_users"],
  ]},
  { label: "Finance & Accounting", color: C.amber, tables: [
    ["accounts", "Chart of accounts (assets/liab/equity/income/expense)", "Linked to: voucher_lines"],
    ["vouchers", "RV/PV/JV/CV voucher headers", "Linked to: accounts, users"],
    ["voucher_lines", "Individual debit/credit lines", "Linked to: vouchers, accounts"],
    ["financial_years", "Accounting period definitions", "Linked to: vouchers"],
    ["currency_settings", "Exchange rates and base currency config", "Standalone"],
  ]},
  { label: "Communications & System", color: C.violet, tables: [
    ["whatsapp_groups", "WhatsApp group targets", "Standalone"],
    ["whatsapp_messages", "Sent/received message log", "Linked to: clients"],
    ["bot_campaigns", "Automated campaign definitions", "Linked to: whatsapp_groups"],
    ["automation_configs", "Automation rule settings", "Standalone"],
    ["media_library", "Uploaded media files for WhatsApp", "Standalone"],
    ["website_config", "Key-value store for branding & settings", "Standalone"],
  ]},
];

let y7 = 70;
dbGroups.forEach(g => {
  y7 = sectionBar(g.label, M, y7, CW, g.color);
  g.tables.forEach(([tname, desc, links]) => {
    doc.fontSize(8).font("Helvetica-Bold").fillColor(g.color)
      .text(tname, M + 6, y7, { width: 130, lineBreak: false });
    doc.fontSize(7.5).font("Helvetica").fillColor(C.text)
      .text(desc, M + 140, y7, { width: 170, lineBreak: false });
    doc.fontSize(7.5).font("Helvetica").fillColor(C.muted)
      .text(links, M + 315, y7, { width: CW - 319, lineBreak: false });
    y7 += 12;
  });
  y7 += 5;
});

footer("Database Table Directory");

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE 8 — KEY WORKFLOWS
═══════════════════════════════════════════════════════════════════════════ */
newPage();
pageTitle("Key Operational Workflows", "Step-by-step process guides for the most common staff tasks");

const workflows: { title: string; color: string; steps: string[] }[] = [
  {
    title: "1.  Create & Confirm a Quotation",
    color: C.red,
    steps: [
      "Go to CRM (/crm) and open the client's profile, or create a new client.",
      "Click 'New Quotation' → fill in the package details, hotel, nights, pax count.",
      "Add hotel cost (payable) and selling price (receivable) — system calculates profit.",
      "Save as 'Draft'. Review and update if needed.",
      "Change status to 'Sent' when shared with the client.",
      "When client confirms, update status to 'Confirmed'. This triggers an option date alert.",
      "Proceed to raise a Hotel Invoice (DN) from the Accounting module.",
    ],
  },
  {
    title: "2.  Raise a Hotel Invoice (DN)",
    color: C.teal,
    steps: [
      "Go to Accounting → Invoices (/accounting/invoices) → click 'New Hotel Invoice'.",
      "Select the client (Party) and hotel vendor from the dropdowns.",
      "Fill in hotel details: check-in/out dates (Nights auto-calculates), rooms, bed type.",
      "In the Calculation section, enter the Rate per Night per Room (SAR).",
      "System auto-multiplies: Rate × Nights × Rooms = Receivable Total.",
      "Enter the PKR exchange rate or click 'live' to fetch the current rate.",
      "Click Accept. The DN number (e.g. DN-0042) is assigned automatically.",
      "Print the formal invoice, DN invoice, or accommodation voucher using the print buttons.",
    ],
  },
  {
    title: "3.  Post a Payment Voucher (RV / PV)",
    color: C.amber,
    steps: [
      "Go to Accounting → Vouchers (/accounting/vouchers) → click 'New Voucher'.",
      "Select type: RV (Receipt Voucher = money received), PV (Payment Voucher = money paid).",
      "Enter Date, Narration (description of the transaction).",
      "Add at least 2 lines: one DEBIT line and one CREDIT line. Totals must balance (DR = CR).",
      "Select the account for each line from the Chart of Accounts dropdown.",
      "Click Save. The voucher is posted to the General Ledger immediately.",
      "Verify in Ledger (/accounting/ledger) by filtering on the relevant account.",
    ],
  },
  {
    title: "4.  Send a WhatsApp Message to a Vendor",
    color: C.violet,
    steps: [
      "Go to WhatsApp Inbox (/whatsapp-inbox).",
      "Ensure WhatsApp is connected (scan QR code once; session persists on server).",
      "Click 'New Message' → select the vendor's saved contact/group.",
      "Type the message or select a template from Media Library.",
      "Click Send. Message appears in the inbox log with delivery status.",
    ],
  },
  {
    title: "5.  Portal Customer: Register → Access Documents",
    color: C.sky,
    steps: [
      "Customer visits the public website and clicks 'Customer Portal' or /portal-register.",
      "Fills in name, email/phone, and password. Account created with status 'Pending Approval'.",
      "Staff goes to ERP → Portal Users (/portal-users) and clicks 'Approve'.",
      "Customer receives confirmation and logs in at /portal-login.",
      "Portal dashboard shows their bookings, invoices, vouchers, visa status, transport.",
      "Customer downloads travel documents from /portal/downloads.",
    ],
  },
];

// Two-column layout: workflows 1-3 left, 4-5 right
const wfColW = Math.floor((CW - 10) / 2); // ~252 per column with 10pt gutter
let y8L = 70; // left column y
let y8R = 70; // right column y

workflows.forEach((wf, wi) => {
  const isRight = wi >= 3;
  const xBase = isRight ? M + wfColW + 10 : M;
  const colW = wfColW;
  const yRef = isRight ? y8R : y8L;

  drawBox(xBase, yRef, colW, 20, wf.color, undefined, 4);
  doc.fontSize(8.5).font("Helvetica-Bold").fillColor(C.white)
    .text(wf.title, xBase + 6, yRef + 6, { width: colW - 12, lineBreak: false });
  let curY = yRef + 24;

  wf.steps.forEach((step, si) => {
    const numW = 14;
    doc.roundedRect(xBase + 6, curY, numW, 12, 2).fill(wf.color);
    doc.fontSize(7).font("Helvetica-Bold").fillColor(C.white)
      .text(String(si + 1), xBase + 6, curY + 2, { width: numW, align: "center", lineBreak: false });
    doc.fontSize(7.5).font("Helvetica").fillColor(C.text)
      .text(step, xBase + numW + 10, curY, { width: colW - numW - 20, lineBreak: false });
    curY += 14;
  });
  curY += 8;

  if (isRight) y8R = curY;
  else y8L = curY;
});

footer("Key Operational Workflows");

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE 9 — CODEBASE QUICK REFERENCE
═══════════════════════════════════════════════════════════════════════════ */
newPage();
pageTitle("Developer Quick-Reference", "Where to find or change anything in the codebase");

const refRows: [string, string, string][] = [
  ["Add a new ERP page / screen", "artifacts/umrah-erp/src/pages/", "Create a new .tsx file, add a route in App.tsx"],
  ["Add a new public website page", "artifacts/frontend/src/pages/", "Create .tsx file, add route in frontend App.tsx"],
  ["Add or change a database table", "lib/db/src/schema/", "Edit the Drizzle schema file, then run: pnpm --filter @workspace/db run push"],
  ["Add a new API endpoint", "artifacts/api-server/src/routes/", "Add route handler, register in index.ts, update OpenAPI spec"],
  ["Update the OpenAPI spec", "artifacts/api-spec/openapi.yaml", "Edit spec, then run: pnpm --filter @workspace/api-spec run codegen"],
  ["Change company branding (print)", "ERP → Website Settings (/website-settings)", "Update keys in website_config table via the settings UI"],
  ["Change company logo", "ERP → Website Settings → Logo Upload", "Uploads to object storage; keys: logo_url, print_logo_url"],
  ["Add a WhatsApp automation rule", "ERP → Automation Settings (/automation-settings)", "Configure trigger/action pairs in the UI"],
  ["Change exchange rates", "ERP → Currency Settings (/currency-settings)", "Manual entry or live fetch from currency API"],
  ["Reset a staff password", "ERP → Users (/users) → Reset Password", "Sends a temporary password; user must change on login"],
  ["Approve a portal customer", "ERP → Portal Users (/portal-users)", "Click Approve on pending registration"],
  ["View accounting ledger", "ERP → Accounting → Ledger (/accounting/ledger)", "Filter by account code or date range"],
  ["Generate a P&L report", "ERP → Accounting → P&L (/accounting/pnl)", "Select date range; exports to print"],
  ["Check server logs", "Workflow console / deployment logs", "Use the Replit workflow console for live logs"],
  ["Run a DB migration (dev)", "Terminal: pnpm --filter @workspace/db run push", "Pushes schema changes to the development database"],
  ["Build the API server", "Terminal: pnpm --filter @workspace/api-server run build", "Compiles TypeScript via esbuild to dist/"],
  ["Run full typecheck", "Terminal: pnpm run typecheck", "Typechecks all workspace packages"],
  ["Regenerate API hooks & schemas", "Terminal: pnpm --filter @workspace/api-spec run codegen", "Regenerates React Query hooks from OpenAPI spec"],
];

const refColW = [168, 188, CW - 356];
table(M, 70, CW,
  ["If You Need To…", "Look In / Go To", "Notes"],
  refRows.map(r => [[r[0]], [r[1]], [r[2]]]),
  refColW, C.navy, 20, 8
);

// Workspace structure
const structY = doc.y + 10;
doc.fontSize(10).font("Helvetica-Bold").fillColor(C.text).text("PROJECT FOLDER STRUCTURE", M, structY > H - 200 ? H - 200 : structY);
const sY2 = (structY > H - 200 ? H - 200 : structY) + 14;
const folders = [
  { path: "artifacts/api-server/", desc: "Express API server — all backend code", color: C.purple },
  { path: "artifacts/umrah-erp/", desc: "Staff ERP dashboard (React + Vite)", color: C.navy },
  { path: "artifacts/frontend/", desc: "Public website + customer portal (React + Vite)", color: C.sky },
  { path: "lib/db/", desc: "Drizzle ORM schema + migrations (shared library)", color: C.green },
  { path: "lib/api-spec/", desc: "OpenAPI contract + generated client hooks", color: C.teal },
  { path: "scripts/", desc: "Utility scripts (e.g. this PDF generator)", color: C.gray },
];
folders.forEach((f, i) => {
  const fx = M + (i % 2) * (CW / 2 + 5);
  const fy = sY2 + Math.floor(i / 2) * 26;
  drawBox(fx, fy, CW / 2 - 5, 22, C.lightBg, f.color, 3);
  doc.fontSize(8).font("Helvetica-Bold").fillColor(f.color)
    .text(f.path, fx + 6, fy + 4, { width: CW / 2 - 20, lineBreak: false });
  doc.fontSize(7.5).font("Helvetica").fillColor(C.text)
    .text(f.desc, fx + 6, fy + 13, { width: CW / 2 - 20, lineBreak: false });
});

footer("Developer Quick-Reference");

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE 10 — ESTIMATED DEVELOPMENT COST
═══════════════════════════════════════════════════════════════════════════ */
newPage();

// Header
doc.rect(0, 0, W, 70).fill(C.gold);
doc.rect(0, 0, W, 6).fill("#92400e");
doc.fontSize(17).font("Helvetica-Bold").fillColor(C.white)
  .text("Estimated Development Cost", M, 16, { width: CW });
doc.fontSize(9).font("Helvetica").fillColor("#f1f5f9")
  .text("Market rate estimate for a mid-senior full-stack developer team  •  Exchange rate: 1 USD = 290 PKR", M, 40, { width: CW });

const RATE = 35;
const PKR_RATE = 290;

const costData: { module: string; features: string; hours: number }[] = [
  { module: "Project Setup & Infrastructure", features: "Monorepo, API server, DB schema, CI, deployment config", hours: 40 },
  { module: "Authentication & User Roles", features: "Login, sessions, roles, forced password change, audit log", hours: 30 },
  { module: "CRM / Clients", features: "Client list, profile, follow-ups, hotel requests", hours: 35 },
  { module: "Quotations", features: "Create/edit quotation, PDF generation, status workflow, pending approvals", hours: 45 },
  { module: "Hotel Invoices (DN)", features: "Invoice form, rate×nights auto-calc, 3 print formats, status tracking", hours: 50 },
  { module: "Flight Management", features: "Flight records, BSP report, cancellations, passenger manifest", hours: 40 },
  { module: "Transport Bookings", features: "Transport invoice form, vendor assignment, status tracking", hours: 25 },
  { module: "Visa Applications", features: "Visa tracking, document upload, status workflow", hours: 25 },
  { module: "Hotels & Vendors Directory", features: "Hotel master list, vendor list, room types, WhatsApp numbers", hours: 20 },
  { module: "Double-Entry Accounting", features: "Chart of accounts, RV/PV/JV/CV vouchers, ledger, trial balance, P&L, balance sheet", hours: 70 },
  { module: "Financial Years", features: "Year open/close, period locking, reporting periods", hours: 15 },
  { module: "Currency Settings", features: "Multi-currency support, live rate fetching, PKR conversion", hours: 15 },
  { module: "WhatsApp Automation", features: "Inbox, bot campaigns, media library, group messaging, session persistence", hours: 60 },
  { module: "Customer Portal", features: "Portal login/register, dashboard, invoices, vouchers, visa, transport, downloads", hours: 55 },
  { module: "Public Website", features: "Landing page, package listings, flight search, GDS booking, package inquiry", hours: 50 },
  { module: "Print & Branding System", features: "Company branding config, print layouts for all document types, logo upload", hours: 20 },
  { module: "AI / OCR Integration", features: "Document scanning stub, AI settings page, OpenAI key management", hours: 15 },
  { module: "ERP Settings & Admin", features: "Website settings, automation, GDS/AI/ERP config pages", hours: 20 },
  { module: "Portal Users Management", features: "Staff approval workflow, portal user list, status management", hours: 15 },
  { module: "Testing, Bug Fixes & Polish", features: "Cross-module testing, UI polish, error handling, security hardening", hours: 50 },
];

const totalHours = costData.reduce((s, r) => s + r.hours, 0);
const totalUSD = totalHours * RATE;
const totalPKR = totalUSD * PKR_RATE;

// Column widths: Module | Features | Hours | Rate | USD | PKR
const cw10 = [108, 192, 32, 40, 55, 88];
const totalCW = cw10.reduce((s, v) => s + v, 0);

// Header row
let y10 = 78;
doc.rect(M, y10, totalCW, 22).fill(C.gold);
const hdrs10 = ["Module / Area", "Features Included", "Hrs", "$/hr", "Cost (USD)", "Cost (PKR)"];
let hx = M;
hdrs10.forEach((h, i) => {
  doc.fontSize(8).font("Helvetica-Bold").fillColor(C.white)
    .text(h, hx + 4, y10 + 7, { width: cw10[i] - 8, lineBreak: false, align: i >= 2 ? "right" : "left" });
  hx += cw10[i];
});
y10 += 22;

costData.forEach((row, ri) => {
  const rh = 17;
  doc.rect(M, y10, totalCW, rh).fill(ri % 2 === 0 ? C.white : "#fef9ec");
  const cells = [
    row.module,
    row.features,
    String(row.hours),
    `$${RATE}`,
    `$${(row.hours * RATE).toLocaleString()}`,
    `Rs ${(row.hours * RATE * PKR_RATE).toLocaleString()}`,
  ];
  let rx = M;
  cells.forEach((cell, ci) => {
    doc.fontSize(ci === 1 ? 6.8 : 7.5)
      .font(ci === 0 ? "Helvetica-Bold" : "Helvetica")
      .fillColor(ci === 0 ? C.navy : C.text)
      .text(cell, rx + 4, y10 + (rh - 8) / 2, { width: cw10[ci] - 8, lineBreak: false, align: ci >= 2 ? "right" : "left" });
    rx += cw10[ci];
  });
  doc.rect(M, y10, totalCW, rh).lineWidth(0.25).stroke("#f0e6c8");
  y10 += rh;
});

// Outer border
doc.rect(M, 78, totalCW, y10 - 78).lineWidth(0.75).stroke(C.gold);

// Totals box
y10 += 6;
drawBox(M, y10, totalCW, 52, "#fffbeb", C.gold, 5);

const totLabelX = M + cw10[0] + cw10[1] + cw10[2] + cw10[3] - 4;
const valW = cw10[4] + cw10[5];

doc.fontSize(9).font("Helvetica-Bold").fillColor(C.text)
  .text("TOTAL ESTIMATED HOURS:", M + 8, y10 + 8, { lineBreak: false });
doc.fontSize(9).font("Helvetica-Bold").fillColor(C.navy)
  .text(`${totalHours} hours`, M + 8, y10 + 8, { width: totalCW - 16, align: "right", lineBreak: false });

doc.fontSize(9).font("Helvetica-Bold").fillColor(C.text)
  .text(`TOTAL COST (USD @ $${RATE}/hr):`, M + 8, y10 + 22, { lineBreak: false });
doc.fontSize(10).font("Helvetica-Bold").fillColor(C.green)
  .text(`USD ${totalUSD.toLocaleString()}`, M + 8, y10 + 22, { width: totalCW - 16, align: "right", lineBreak: false });

doc.fontSize(9).font("Helvetica-Bold").fillColor(C.text)
  .text(`TOTAL COST (PKR @ ${PKR_RATE} per USD):`, M + 8, y10 + 36, { lineBreak: false });
doc.fontSize(10).font("Helvetica-Bold").fillColor(C.amber)
  .text(`PKR ${totalPKR.toLocaleString()}`, M + 8, y10 + 36, { width: totalCW - 16, align: "right", lineBreak: false });

y10 += 60;

// Disclaimer
doc.fontSize(7).font("Helvetica").fillColor(C.muted)
  .text(
    "DISCLAIMER: This is a market-rate estimate only. Actual cost varies by developer location, experience level, and team size. " +
    "Project management and QA overhead typically adds 20–30% to the above figures. " +
    "Does not include third-party service costs (cloud hosting, WhatsApp Business API, SMS gateway, GDS/Amadeus fees, domain/SSL).",
    M, y10, { width: totalCW, lineGap: 2 }
  );

footer("Estimated Development Cost");

/* ── Finalize ── */
writeStream.on("finish", () => {
  const h = costData.reduce((s, r) => s + r.hours, 0);
  console.log(`\nPDF generated: ${outPath}`);
  console.log(`Pages: ${pageNum}  |  Hours: ${h}  |  USD: $${(h * 35).toLocaleString()}  |  PKR: Rs ${(h * 35 * 290).toLocaleString()}`);
  process.exit(0);
});
writeStream.on("error", (err) => { console.error("Stream error:", err); process.exit(1); });
doc.end();
