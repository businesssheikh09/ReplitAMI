---
name: Agency Business Workflow
description: Standard Al Musafir International Umrah agency workflow from quotation to vendor payment — confirmed by the user.
---

# Agency Business Workflow

The standard flow for an Umrah booking at Al Musafir International involves **three ledger sides**: client/party, vendor, and own cash/bank.

## Flow

1. **Quotation** — Sales creates a quotation for the client. Quotation ref is auto-generated async from DB.

2. **Invoice** — When the client confirms, the quotation is converted to an invoice (customer-side). Invoice status: draft → tentative → confirmed.

3. **Receive payment from client (RV — Receipt Voucher)**
   - Debit: Cash/Bank account
   - Credit: Client's individual party ledger account (e.g. "Ahmad Ali")
   - Voucher type: RV (Receipt Voucher)

4. **Record the payment in accounts** — Post the RV to the general journal to update the trial balance and ledger.

5. **Pay vendor / hotel (PV — Payment Voucher)**
   - Debit: Vendor's individual sub-ledger account (e.g. "Al-Noor Hotels")
   - Credit: Cash/Bank account
   - Voucher type: PV (Payment Voucher)

6. **Record vendor payment in accounts** — Post the PV to the general journal.

## Three-sided account maintenance

Every Umrah booking touches three ledger sides:
- **Client/Party account** — tracks what the client owes / has paid
- **Vendor account** — tracks what the agency owes the hotel/flight/visa vendor
- **Own account (Cash/Bank)** — tracks actual money movement

## Account coding convention (as of Task #127)

Individual sub-ledger accounts are auto-created in `chart_of_accounts`:
- Clients: code `C-{clientId}`, type `party_ledger`
- Vendors: code `V-{vendorId}`, type `vendor_ledger`
- These are auto-synced on every `GET /api/accounting/accounts` call via ON CONFLICT DO UPDATE (keeps names fresh if renamed)

**Why:** The voucher form's account dropdown needs real integer FKs into `chart_of_accounts`, so virtual accounts aren't possible — real rows are auto-seeded per client/vendor.

## Voucher types

| Type | Purpose |
|------|---------|
| RV | Receipt Voucher — money received from client |
| PV | Payment Voucher — money paid to vendor |
| JV | Journal Voucher — internal adjustments |
| CV | Contra/Cash Voucher — cash transfers between own accounts |
