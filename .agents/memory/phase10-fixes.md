---
name: Phase 10 UAT Bug Fix Patterns
description: Key patterns established while fixing UAT-01–04 bugs (B-01–B-89)
---

## Sub-ledger journal posting (T001)
- `resolveSubLedger(code, name, type, description)` in journal-poster.ts creates C-{id}/V-{id} accounts on-the-fly via INSERT ON CONFLICT
- `postRawEntry()` accepts account IDs directly — bypasses the code-string lookup for dynamic sub-ledgers
- Domain functions (postInvoiceCreated, postInvoicePayment, postHotelInvoice, postFlightIssued) now accept optional `clientId`/`clientName`/`vendorId`/`vendorName` for sub-ledger posting
- **Why:** PARTY/VENDOR aggregate accounts caused all clients to appear as one balance in statements

## Balance sheet balanced by including retained earnings in equity
- `totalEquity = equity_accounts_net + (revenue_total - expense_total)`
- Assets = Liabilities + totalEquity is always balanced if all journal entries are double-entry
- **Why:** Revenue/expense accounts are P&L, not balance sheet — retained earnings bridges them

## Schema columns added in Phase 10
- `payments`: receiptNumber (text), collectedBy (integer), notes (text)
- `hotel_invoices`: paidAmount (numeric default 0), paidStatus (text default 'unpaid')
- `quotations`: bookingNumber (text), convertedAt (timestamp), convertedBy (integer)

## Quotation → Booking conversion
- POST /quotations/:id/convert-to-booking
- Generates BK-{YEAR}-{XXXX} from MAX of existing bookingNumber sequences
- Sets status='accepted', bookingNumber, convertedAt, convertedBy
- 409 if already converted (idempotency guard)

## PV post → DN paidAmount tracking
- When POST /accounting/vouchers/:id/post runs on a PV with hotelInvoiceId:
  - Sums `drLines.reduce(debitAmount)` = total paid
  - Updates hotel_invoices.paidAmount += total, paidStatus = paid/partial/unpaid
