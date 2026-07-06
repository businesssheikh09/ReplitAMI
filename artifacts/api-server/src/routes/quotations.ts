import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import { quotationsTable, quotationItemsTable, clientsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

async function generateRef(): Promise<string> {
  const existing = await db.select({ ref: quotationsTable.referenceNo }).from(quotationsTable);
  const nums = existing
    .map(q => parseInt(q.ref.split("-").pop() || "0"))
    .filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1001;
  return `QT-${new Date().getFullYear()}-${String(next).padStart(4, "0")}`;
}

router.get("/quotations", requireAuth, async (req, res) => {
  try {
    const { clientId, status, search } = req.query as Record<string, string>;
    let quotations = await db.select().from(quotationsTable);
    if (clientId) quotations = quotations.filter(q => q.clientId === parseInt(clientId));
    if (status) quotations = quotations.filter(q => q.status === status);
    if (search) {
      const s = search.toLowerCase();
      quotations = quotations.filter(q => q.referenceNo.toLowerCase().includes(s));
    }
    const [clients, users] = await Promise.all([
      db.select().from(clientsTable),
      db.select().from(usersTable),
    ]);
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const userMap = new Map(users.map(u => [u.id, u.name]));
    return res.json(quotations.map(q => ({
      ...q,
      clientName: clientMap.get(q.clientId) || "",
      createdByName: userMap.get(q.createdBy) || null,
      totalAmount: parseFloat(q.totalAmount),
      validUntil: q.validUntil.toISOString(),
      createdAt: q.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "List quotations error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quotations", requireAuth, async (req, res) => {
  try {
    const [quotation] = await db.insert(quotationsTable).values({
      clientId: req.body.clientId,
      referenceNo: await generateRef(),
      title: req.body.title,
      status: "draft",
      totalAmount: "0",
      currency: req.body.currency || "USD",
      validUntil: new Date(req.body.validUntil),
      termsAndConditions: req.body.termsAndConditions,
      notes: req.body.notes,
      createdBy: req.body.createdBy || 1,
    }).returning();
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, req.body.clientId));
    return res.status(201).json({
      ...quotation,
      clientName: client?.name || "",
      createdByName: null,
      totalAmount: parseFloat(quotation.totalAmount),
      validUntil: quotation.validUntil.toISOString(),
      createdAt: quotation.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Create quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/quotations/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [quotation] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
    if (!quotation) return res.status(404).json({ error: "Quotation not found" });
    const [items, clients, users] = await Promise.all([
      db.select().from(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id)),
      db.select().from(clientsTable),
      db.select().from(usersTable),
    ]);
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const userMap = new Map(users.map(u => [u.id, u.name]));
    return res.json({
      ...quotation,
      clientName: clientMap.get(quotation.clientId) || "",
      createdByName: userMap.get(quotation.createdBy) || null,
      totalAmount: parseFloat(quotation.totalAmount),
      validUntil: quotation.validUntil.toISOString(),
      createdAt: quotation.createdAt.toISOString(),
      items: items.map(i => ({
        ...i,
        unitPrice: parseFloat(i.unitPrice),
        totalPrice: parseFloat(i.totalPrice),
        totalPriceBase: i.totalPriceBase != null ? parseFloat(i.totalPriceBase) : null,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Get quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/quotations/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = ["title", "status", "currency", "termsAndConditions", "notes"];
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (req.body.validUntil) updates.validUntil = new Date(req.body.validUntil);
    const [quotation] = await db.update(quotationsTable).set(updates).where(eq(quotationsTable.id, id)).returning();
    if (!quotation) return res.status(404).json({ error: "Quotation not found" });
    return res.json({
      ...quotation,
      clientName: "",
      createdByName: null,
      totalAmount: parseFloat(quotation.totalAmount),
      validUntil: quotation.validUntil.toISOString(),
      createdAt: quotation.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Update quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/quotations/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    await db.delete(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
    await db.delete(quotationsTable).where(eq(quotationsTable.id, id));
    return res.json({ message: "Quotation deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quotations/:id/items", requireAuth, async (req, res) => {
  try {
    const quotationId = parseInt(String(req.params.id));
    const unitPrice = req.body.unitPrice;
    const quantity = req.body.quantity || 1;
    const totalPrice = unitPrice * quantity;
    const currency = req.body.currency || "USD";
    const unitPriceBase = req.body.unitPriceBase;
    const totalPriceBase = unitPriceBase != null ? (unitPriceBase * quantity).toString() : null;

    const [item] = await db.insert(quotationItemsTable).values({
      quotationId,
      serviceType: req.body.serviceType,
      description: req.body.description,
      quantity,
      unitPrice: unitPrice.toString(),
      totalPrice: totalPrice.toString(),
      currency,
      totalPriceBase,
      notes: req.body.notes,
      metadata: req.body.metadata ?? null,
    }).returning();

    // Recalculate total using base-converted values when available
    const allItems = await db.select().from(quotationItemsTable).where(eq(quotationItemsTable.quotationId, quotationId));
    const newTotal = allItems.reduce((sum, i) => {
      const base = i.totalPriceBase != null ? parseFloat(i.totalPriceBase) : parseFloat(i.totalPrice);
      return sum + base;
    }, 0);
    await db.update(quotationsTable).set({ totalAmount: newTotal.toString() }).where(eq(quotationsTable.id, quotationId));

    return res.status(201).json({
      ...item,
      unitPrice: parseFloat(item.unitPrice),
      totalPrice: parseFloat(item.totalPrice),
      totalPriceBase: item.totalPriceBase != null ? parseFloat(item.totalPriceBase) : null,
    });
  } catch (err) {
    req.log.error({ err }, "Add quotation item error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/quotations/:id/items/:itemId", requireAuth, async (req, res) => {
  try {
    const itemId = parseInt(String(req.params.itemId));
    const quotationId = parseInt(String(req.params.id));
    const updates: Record<string, unknown> = {};
    if (req.body.serviceType) updates.serviceType = req.body.serviceType;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.currency !== undefined) updates.currency = req.body.currency;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;
    if (req.body.metadata !== undefined) updates.metadata = req.body.metadata;

    const unitPrice = req.body.unitPrice;
    const quantity = req.body.quantity;
    if (unitPrice !== undefined || quantity !== undefined) {
      const existingArr = await db.select().from(quotationItemsTable).where(eq(quotationItemsTable.id, itemId));
      const existing = existingArr[0];
      const newUnitPrice = unitPrice !== undefined ? unitPrice : parseFloat(existing.unitPrice);
      const newQty = quantity !== undefined ? quantity : existing.quantity;
      updates.unitPrice = newUnitPrice.toString();
      updates.quantity = newQty;
      updates.totalPrice = (newUnitPrice * newQty).toString();

      const unitPriceBase = req.body.unitPriceBase;
      if (unitPriceBase != null) {
        updates.totalPriceBase = (unitPriceBase * newQty).toString();
      } else if (req.body.currency !== undefined) {
        // Currency changed to base — clear totalPriceBase
        const quotArr = await db.select().from(quotationsTable).where(eq(quotationsTable.id, quotationId));
        const quot = quotArr[0];
        const baseCurr = quot?.currency || "USD";
        if (req.body.currency === baseCurr) updates.totalPriceBase = null;
      }
    } else if (req.body.unitPriceBase != null) {
      const existingArr = await db.select().from(quotationItemsTable).where(eq(quotationItemsTable.id, itemId));
      const existing = existingArr[0];
      updates.totalPriceBase = (req.body.unitPriceBase * existing.quantity).toString();
    }

    const [item] = await db.update(quotationItemsTable).set(updates).where(eq(quotationItemsTable.id, itemId)).returning();

    // Recalculate quotation total using base-converted values where available
    const allItems = await db.select().from(quotationItemsTable).where(eq(quotationItemsTable.quotationId, quotationId));
    const newTotal = allItems.reduce((sum, i) => {
      const base = i.totalPriceBase != null ? parseFloat(i.totalPriceBase) : parseFloat(i.totalPrice);
      return sum + base;
    }, 0);
    await db.update(quotationsTable).set({ totalAmount: newTotal.toString() }).where(eq(quotationsTable.id, quotationId));

    return res.json({
      ...item,
      unitPrice: parseFloat(item.unitPrice),
      totalPrice: parseFloat(item.totalPrice),
      totalPriceBase: item.totalPriceBase != null ? parseFloat(item.totalPriceBase) : null,
    });
  } catch (err) {
    req.log.error({ err }, "Update quotation item error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/quotations/:id/items/:itemId", requireAuth, async (req, res) => {
  try {
    const itemId = parseInt(String(req.params.itemId));
    const quotationId = parseInt(String(req.params.id));
    await db.delete(quotationItemsTable).where(eq(quotationItemsTable.id, itemId));
    const allItems = await db.select().from(quotationItemsTable).where(eq(quotationItemsTable.quotationId, quotationId));
    const newTotal = allItems.reduce((sum, i) => {
      const base = i.totalPriceBase != null ? parseFloat(i.totalPriceBase) : parseFloat(i.totalPrice);
      return sum + base;
    }, 0);
    await db.update(quotationsTable).set({ totalAmount: newTotal.toString() }).where(eq(quotationsTable.id, quotationId));
    return res.json({ message: "Item deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete quotation item error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quotations/:id/send", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [quotation] = await db.update(quotationsTable).set({ status: "sent", updatedAt: new Date() }).where(eq(quotationsTable.id, id)).returning();
    if (!quotation) return res.status(404).json({ error: "Quotation not found" });
    return res.json({
      ...quotation,
      clientName: "",
      createdByName: null,
      totalAmount: parseFloat(quotation.totalAmount),
      validUntil: quotation.validUntil.toISOString(),
      createdAt: quotation.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Send quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
