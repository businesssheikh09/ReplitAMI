import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, paymentsTable, expensesTable, clientsTable, vendorsTable, documentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

let invoiceCounter = 1000;
function generateInvoiceNumber() {
  invoiceCounter++;
  return `INV-${new Date().getFullYear()}-${String(invoiceCounter).padStart(4, "0")}`;
}

router.get("/invoices", async (req, res) => {
  try {
    const { type, clientId, status } = req.query as Record<string, string>;
    let invoices = await db.select().from(invoicesTable);
    if (type) invoices = invoices.filter(i => i.type === type);
    if (clientId) invoices = invoices.filter(i => i.clientId === parseInt(clientId));
    if (status) invoices = invoices.filter(i => i.status === status);
    const [clients, vendors] = await Promise.all([
      db.select().from(clientsTable),
      db.select().from(vendorsTable),
    ]);
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const vendorMap = new Map(vendors.map(v => [v.id, v.name]));
    return res.json(invoices.map(i => ({
      ...i,
      clientName: i.clientId ? clientMap.get(i.clientId) || null : null,
      vendorName: i.vendorId ? vendorMap.get(i.vendorId) || null : null,
      amount: parseFloat(i.amount),
      paidAmount: parseFloat(i.paidAmount),
      dueDate: i.dueDate.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "List invoices error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invoices", async (req, res) => {
  try {
    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber: generateInvoiceNumber(),
      type: req.body.type || "customer",
      clientId: req.body.clientId || null,
      vendorId: req.body.vendorId || null,
      quotationId: req.body.quotationId || null,
      amount: req.body.amount.toString(),
      paidAmount: "0",
      currency: req.body.currency || "USD",
      status: "draft",
      dueDate: new Date(req.body.dueDate),
      notes: req.body.notes,
    }).returning();
    return res.status(201).json({
      ...invoice,
      clientName: null,
      vendorName: null,
      amount: parseFloat(invoice.amount),
      paidAmount: parseFloat(invoice.paidAmount),
      dueDate: invoice.dueDate.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Create invoice error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invoices/:id", async (req, res) => {
  try {
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, parseInt(req.params.id)));
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    const clients = await db.select().from(clientsTable);
    const vendors = await db.select().from(vendorsTable);
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const vendorMap = new Map(vendors.map(v => [v.id, v.name]));
    return res.json({
      ...invoice,
      clientName: invoice.clientId ? clientMap.get(invoice.clientId) || null : null,
      vendorName: invoice.vendorId ? vendorMap.get(invoice.vendorId) || null : null,
      amount: parseFloat(invoice.amount),
      paidAmount: parseFloat(invoice.paidAmount),
      dueDate: invoice.dueDate.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Get invoice error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/invoices/:id", async (req, res) => {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = ["status", "notes"];
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (req.body.dueDate) updates.dueDate = new Date(req.body.dueDate);
    const [invoice] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, parseInt(req.params.id))).returning();
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    return res.json({
      ...invoice,
      clientName: null,
      vendorName: null,
      amount: parseFloat(invoice.amount),
      paidAmount: parseFloat(invoice.paidAmount),
      dueDate: invoice.dueDate.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Update invoice error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invoices/:id/payments", async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const [payment] = await db.insert(paymentsTable).values({
      invoiceId,
      amount: req.body.amount.toString(),
      currency: req.body.currency || "USD",
      method: req.body.method,
      reference: req.body.reference,
      paidAt: new Date(req.body.paidAt),
    }).returning();

    // Update invoice paid amount and status
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
    if (invoice) {
      const newPaid = parseFloat(invoice.paidAmount) + req.body.amount;
      const totalAmount = parseFloat(invoice.amount);
      const newStatus = newPaid >= totalAmount ? "paid" : "partial";
      await db.update(invoicesTable).set({ paidAmount: newPaid.toString(), status: newStatus }).where(eq(invoicesTable.id, invoiceId));
    }

    return res.status(201).json({
      ...payment,
      amount: parseFloat(payment.amount),
      paidAt: payment.paidAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Record payment error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/expenses", async (req, res) => {
  try {
    const { category, from, to } = req.query as Record<string, string>;
    let expenses = await db.select().from(expensesTable);
    if (category) expenses = expenses.filter(e => e.category === category);
    if (from) expenses = expenses.filter(e => e.date >= new Date(from));
    if (to) expenses = expenses.filter(e => e.date <= new Date(to));
    const vendors = await db.select().from(vendorsTable);
    const vendorMap = new Map(vendors.map(v => [v.id, v.name]));
    return res.json(expenses.map(e => ({
      ...e,
      vendorName: e.vendorId ? vendorMap.get(e.vendorId) || null : null,
      amount: parseFloat(e.amount),
      date: e.date.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "List expenses error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/expenses", async (req, res) => {
  try {
    const [expense] = await db.insert(expensesTable).values({
      title: req.body.title,
      category: req.body.category,
      amount: req.body.amount.toString(),
      currency: req.body.currency || "USD",
      vendorId: req.body.vendorId || null,
      date: new Date(req.body.date),
      notes: req.body.notes,
    }).returning();
    return res.status(201).json({
      ...expense,
      vendorName: null,
      amount: parseFloat(expense.amount),
      date: expense.date.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Create expense error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Documents
router.get("/documents", async (req, res) => {
  try {
    const { type, clientId } = req.query as Record<string, string>;
    let docs = await db.select().from(documentsTable);
    if (type) docs = docs.filter(d => d.type === type);
    if (clientId) docs = docs.filter(d => d.clientId === parseInt(clientId));
    const clients = await db.select().from(clientsTable);
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    return res.json(docs.map(d => ({
      ...d,
      clientName: d.clientId ? clientMap.get(d.clientId) || null : null,
    })));
  } catch (err) {
    req.log.error({ err }, "List documents error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/documents/generate", async (req, res) => {
  try {
    const [doc] = await db.insert(documentsTable).values({
      type: req.body.type,
      title: `${req.body.type.charAt(0).toUpperCase() + req.body.type.slice(1)} #${req.body.entityId}`,
      clientId: null,
      url: `/api/documents/${req.body.entityId}/download`,
    }).returning();
    return res.status(201).json({ ...doc, clientName: null });
  } catch (err) {
    req.log.error({ err }, "Generate document error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
