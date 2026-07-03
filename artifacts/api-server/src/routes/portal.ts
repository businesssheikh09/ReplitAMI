import { Router } from "express";
import { db, portalUsersTable, portalUserDocumentsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { randomBytes } from "crypto";
import { requireAuth } from "../middlewares/auth.js";
import { requirePortalAuth } from "../middlewares/portal-auth.js";
import { scanDocument } from "../services/document-scan.js";
import { getSweepStatus } from "../services/inventory-sweep.js";

const router = Router();

// ── Public ──────────────────────────────────────────────────────────────────

router.post("/portal/register", async (req, res) => {
  try {
    const { type, fullName, email, phone, whatsapp, password,
      companyName, ownerName, address, dtsNumber, documentKeys } = req.body;

    if (!type || !fullName || !phone || !password) {
      return res.status(400).json({ error: "type, fullName, phone and password are required" });
    }
    if (!["party", "dc"].includes(type)) {
      return res.status(400).json({ error: "type must be party or dc" });
    }

    // Check duplicate phone
    const existing = await db
      .select({ id: portalUsersTable.id })
      .from(portalUsersTable)
      .where(eq(portalUsersTable.phone, phone))
      .limit(1);
    if (existing.length) return res.status(409).json({ error: "Phone already registered" });

    const [user] = await db.insert(portalUsersTable).values({
      type,
      status: type === "dc" ? "active" : "pending_approval",
      fullName,
      email: email ?? null,
      phone,
      whatsapp: whatsapp ?? null,
      companyName: companyName ?? null,
      ownerName: ownerName ?? null,
      address: address ?? null,
      dtsNumber: dtsNumber ?? null,
      passwordHash: password, // plain for now — upgrade to bcrypt when needed
    }).returning();

    if (documentKeys?.length) {
      await db.insert(portalUserDocumentsTable).values(
        (documentKeys as string[]).map((key: string, i: number) => ({
          portalUserId: user.id,
          documentType: ["dts", "visiting_card", "company_reg"][i] ?? "other",
          objectKey: key,
        })),
      );
    }

    const { passwordHash: _, portalSessionToken: __, ...safe } = user;
    return res.status(201).json({ user: safe });
  } catch (err) {
    req.log.error({ err }, "Portal register error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/portal/login", async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    if (!emailOrPhone || !password) return res.status(400).json({ error: "emailOrPhone and password required" });

    const [user] = await db
      .select()
      .from(portalUsersTable)
      .where(or(eq(portalUsersTable.phone, emailOrPhone), eq(portalUsersTable.email, emailOrPhone)))
      .limit(1);

    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (user.status === "pending_approval") {
      return res.status(403).json({ error: "Your account is pending approval. Our team will contact you within 1–2 business days." });
    }
    if (user.status === "suspended") {
      return res.status(403).json({ error: "Your account has been suspended. Please contact support." });
    }
    if (user.status === "rejected") {
      return res.status(403).json({ error: "Your account application was not approved. Please contact us for more information." });
    }

    const token = randomBytes(32).toString("hex");
    await db.update(portalUsersTable).set({ portalSessionToken: token }).where(eq(portalUsersTable.id, user.id));

    const { passwordHash: _, portalSessionToken: __, ...safe } = user;
    return res.json({ token, user: safe });
  } catch (err) {
    req.log.error({ err }, "Portal login error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/portal/logout", requirePortalAuth, async (req, res) => {
  try {
    await db.update(portalUsersTable)
      .set({ portalSessionToken: null })
      .where(eq(portalUsersTable.id, req.portalUser!.id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Portal logout error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/portal/me", requirePortalAuth, (req, res) => {
  res.json(req.portalUser);
});

// ── ERP-gated ───────────────────────────────────────────────────────────────

router.get("/portal/users", requireAuth, async (req, res) => {
  try {
    const { type, status } = req.query as Record<string, string>;
    let rows = await db.select({
      id: portalUsersTable.id,
      type: portalUsersTable.type,
      status: portalUsersTable.status,
      fullName: portalUsersTable.fullName,
      email: portalUsersTable.email,
      phone: portalUsersTable.phone,
      whatsapp: portalUsersTable.whatsapp,
      companyName: portalUsersTable.companyName,
      ownerName: portalUsersTable.ownerName,
      createdAt: portalUsersTable.createdAt,
      passwordHash: portalUsersTable.passwordHash,
    }).from(portalUsersTable);

    if (type && type !== "all") rows = rows.filter((u) => u.type === type);
    if (status && status !== "all") rows = rows.filter((u) => u.status === status);
    return res.json(rows.map(({ passwordHash, ...u }) => ({ ...u, password: passwordHash })));
  } catch (err) {
    req.log.error({ err }, "List portal users error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/portal/users/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [user] = await db.select().from(portalUsersTable).where(eq(portalUsersTable.id, id)).limit(1);
    if (!user) return res.status(404).json({ error: "Not found" });

    const docs = await db.select().from(portalUserDocumentsTable).where(eq(portalUserDocumentsTable.portalUserId, id));
    const { passwordHash: _, portalSessionToken: __, ...safe } = user;
    return res.json({ ...safe, documents: docs });
  } catch (err) {
    req.log.error({ err }, "Get portal user error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/portal/users/:id/status", requireAuth, async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const [updated] = await db
      .update(portalUsersTable)
      .set({ status, rejectionReason: rejectionReason ?? null, updatedAt: new Date() })
      .where(eq(portalUsersTable.id, parseInt(String(req.params.id))))
      .returning();
    const { passwordHash: _, portalSessionToken: __, ...safe } = updated;
    return res.json(safe);
  } catch (err) {
    req.log.error({ err }, "Update portal user status error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/portal/users/:id/scan-doc/:docId", requireAuth, async (req, res) => {
  try {
    const docId = parseInt(String(req.params.docId));
    const [doc] = await db.select().from(portalUserDocumentsTable).where(eq(portalUserDocumentsTable.id, docId)).limit(1);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const result = await scanDocument(doc.objectKey);
    await db.update(portalUserDocumentsTable)
      .set({ scanRawText: result.rawText, scanStatus: result.firstName ? "done" : "failed" })
      .where(eq(portalUserDocumentsTable.id, docId));
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Scan portal doc error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Inventory sweep status (ERP) ────────────────────────────────────────────

router.get("/inventory-sweep/status", requireAuth, (_req, res) => {
  res.json(getSweepStatus());
});

export default router;
