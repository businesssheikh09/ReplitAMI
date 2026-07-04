# Accounting

**Purpose**: Full double-entry accounting system covering package invoicing, hotel procurement billing, flight ticketing revenue, foreign exchange, and financial period management.  
**Backend routes**: `artifacts/api-server/src/routes/accounting.ts`, `accounting-reports.ts`, `vouchers.ts`, `financial-year.ts`  
**Journal posting service**: `artifacts/api-server/src/services/journal-poster.ts`  

---

## Architecture

The system uses a **two-layer architecture**:

1. **Auto-posted layer** — business events (invoice creation, payment, hotel DN, flight issuance) trigger automatic journal entries via `journal-poster.ts`
2. **Manual voucher layer** — accounts staff create RV/PV/JV/CV drafts, which are approved then posted using waterfall allocation

Both layers write to the **`general_journal`** table, which is the single source of truth for all balances.

---

## Chart of Accounts

Eight core accounts are seeded by `journal-poster.ts` on startup:

| Code | Name | Type | Normal Balance |
|---|---|---|---|
| `VENDOR` | Vendor Payables | Liability | Credit |
| `PARTY` | Client Receivables | Asset | Debit |
| `UMRA` | Umrah Package Revenue | Revenue | Credit |
| `AIR` | Airline Ticket Revenue | Revenue | Credit |
| `HOTEL` | Hotel Procurement Revenue | Revenue | Credit |
| `MSFR` | Cash / Main Bank Account | Asset | Debit |
| `FOREX` | Foreign Exchange Gain/Loss | Revenue | Credit |
| `PROFIT` | Retained Earnings / P&L | Equity | Credit |

Additional accounts can be created manually via `POST /api/accounting/journal` manual entries or the General Journal page.

---

## Auto-Journal Posting Events

`journal-poster.ts` is called by route handlers after business events. Each function creates an atomic entry in `general_journal` with a crash-safe sequential `entry_number` from `journal_counters`.

| Business Event | DR Account | CR Account | Source Type |
|---|---|---|---|
| Invoice created (Umrah package) | PARTY | UMRA | `invoice` |
| Invoice created (air ticket) | PARTY | AIR | `invoice` |
| Invoice created (hotel) | PARTY | HOTEL | `invoice` |
| Payment received | MSFR | PARTY | `payment` |
| Hotel DN created (receivable) | PARTY | HOTEL | `hotel_invoice` |
| Hotel DN created (payable) | HOTEL | VENDOR | `hotel_invoice` |
| Flight ticket issued | PARTY | AIR | `flight` |
| Flight cancelled | AIR | PARTY | `flight` (reversal) |
| Flight refund paid | PARTY | MSFR | `flight` (refund) |
| Currency transaction | MSFR / FOREX | varies | `currency` |

---

## Voucher System

Vouchers act as a drafting layer before general journal posting. They support multi-line DR/CR entries and a structured approval workflow.

### Voucher Types

| Code | Name | Typical Use |
|---|---|---|
| `RV` | Receipt Voucher | Incoming cash / bank deposits |
| `PV` | Payment Voucher | Outgoing payments to vendors |
| `JV` | Journal Voucher | General adjustments, corrections |
| `CV` | Contra Voucher | Internal cash-to-bank transfers |

### Voucher Lifecycle

```
Draft → Approved → Posted → (Reversed)
         ↓              ↓
      Cancelled     Cancelled
```

1. **Create** (`POST /api/accounting/vouchers`) — status: `draft`; add voucher lines (DR/CR amounts, accounts)
2. **Approve** (`POST /api/accounting/vouchers/:id/approve`) — management review; status: `approved`
3. **Post** (`POST /api/accounting/vouchers/:id/post`) — waterfall allocation pairs DR and CR lines to create `general_journal` entries; status: `posted`
4. **Reverse** (`POST /api/accounting/vouchers/:id/reverse`) — creates a mirrored draft voucher with swapped DR/CR amounts; original status unchanged

### Waterfall Posting Logic

When a voucher is posted, the system pairs debit and credit lines sequentially:
- Takes the smaller of the remaining DR vs CR amount
- Creates a `general_journal` entry for that pair
- Continues until all lines are consumed
- Ensures balanced posting even with multi-line vouchers

---

## Financial Years

Financial years define accounting periods. Rules:
- New years cannot overlap with any existing `open` year
- Each year can have **opening balances** set per account
- **Year closing** calculates Net Profit (total Revenue − total Expense from `general_journal` entries in the period) and posts a closing JE to the `PROFIT` account; status changes to `closed`

### Endpoints
| Action | Endpoint |
|---|---|
| List years | `GET /api/accounting/financial-years` |
| Create year | `POST /api/accounting/financial-years` |
| Get detail | `GET /api/accounting/financial-years/:id` |
| Get opening balances | `GET /api/accounting/financial-years/:id/opening-balances` |
| Save opening balances | `PUT /api/accounting/financial-years/:id/opening-balances` |
| Close year | `POST /api/accounting/financial-years/:id/close` |

---

## Reports

### Trial Balance (`GET /api/accounting/trial-balance`)
Aggregates all `general_journal` entries per account. For each account:
- Sum of all debit amounts → `totalDR`
- Sum of all credit amounts → `totalCR`
- Net balance: `netBalance = totalDR - totalCR`

Grand totals: `grandDR === grandCR` confirms the journal is balanced.

### General Ledger (`GET /api/accounting/ledger?accountId=`)
Returns all journal entries touching a specific account with a running balance, plus the "opposite account" for each entry (the other side of the double-entry).

### P&L Statement (`GET /api/accounting/pnl`)
Parameters: `yearId` or `from`/`to` date range.  
Groups `general_journal` entries by account type:
- Revenue accounts: summed as income
- Expense accounts: summed as expenses
- `netProfit = totalRevenue − totalExpenses`

### Balance Sheet (`GET /api/accounting/balance-sheet`)
Parameters: `yearId` or `asOf` date.  
Combines opening balances for the year + year-to-date journal entries:
- **Assets**: PARTY, MSFR + any asset accounts
- **Liabilities**: VENDOR + any liability accounts
- **Equity**: PROFIT + any equity accounts
- `isBalanced = (totalAssets === totalLiabilities + totalEquity)`

### Party Statement (`GET /api/accounting/reports/party-statement?clientId=`)
Full chronological ledger for a specific client (PARTY account), with running balance.

### Vendor Statement (`GET /api/accounting/reports/vendor-statement?vendorId=`)
Full ledger for a specific vendor (VENDOR account).

### Cash Book (`GET /api/accounting/reports/cash-book`)
All transactions touching the `MSFR` account, sorted by date.

### Receipt Book (`GET /api/accounting/reports/receipt-book`)
RV (Receipt Voucher) entries combined with auto-posted payment journal entries.

### DN Report (`GET /api/accounting/reports/dn-report`)
Hotel Debit Notes with client receivable and vendor payable amounts in both SAR and PKR.

---

## Hotel Invoices (DN System)

Hotel invoices use a dedicated **Debit Note (DN)** number sequence (`DN-XXXX`).

**Creation** (`POST /api/invoices/hotel`):
1. Allocates next DN number from sequence
2. Creates `hotel_invoices` record
3. Auto-posts two journal entries:
   - `DR PARTY / CR HOTEL` — client receivable
   - `DR HOTEL / CR VENDOR` — vendor payable

**Dual currency**: Amounts stored in both SAR (Saudi Riyal) and PKR (Pakistani Rupee) separately, reflecting the multi-currency nature of Umrah hotel procurement.

---

## Currency Module

Supports PKR as the home currency with configurable daily exchange rates for USD, SAR, and others.

### Daily Rates Structure
- `vendor_rate` — rate to pay vendors
- `guest_rate` — rate for guest/customer billing
- `client_rate` — rate for B2B agency clients

### Live Rates
`GET /api/currency/rates` scrapes **forex.pk** in real-time to provide current PKR exchange rates for the GDS booking flow.

### Currency Transactions
When a forex transaction is recorded (`POST /api/currency/transactions`):
1. Creates `currency_transactions` record
2. Auto-posts `FOREX` journal entry for the gain/loss

### FX Profit Report
`GET /api/currency/profit-report` — summarises profit from all currency transactions over a period.

---

## Permissions

| Role | Capabilities |
|---|---|
| `accounts` | Create/post vouchers, view all reports, record payments |
| `management` | All accounts actions + approve vouchers, close financial years, create financial years |
| `admin` | Full access |
| `sales` | View invoices only |
| `operations` | View invoices only |

---

## Database Tables

| Table | Purpose |
|---|---|
| `chart_of_accounts` | Account master (code, name, type) |
| `general_journal` | All double-entry records (source of truth) |
| `journal_counters` | Atomic counter for entry_number sequence |
| `vouchers` | Voucher drafts with workflow status |
| `voucher_lines` | Individual DR/CR lines per voucher |
| `financial_years` | Accounting periods |
| `opening_balances` | Per-account opening balances per year |
| `invoices` | Customer package invoices |
| `payments` | Payments against invoices |
| `expenses` | Operational expenses |
| `hotel_invoices` | Hotel DN records (dual currency) |
| `currency_daily_rates` | Daily FX rates |
| `currency_transactions` | Logged FX transactions |

---

## Known Limitations

- The `PROFIT` account accumulates all closed-year P&L entries; no separate retained earnings roll-forward mechanism.
- Voucher reversal creates a new draft — it does not automatically cancel the original posting in the journal.
- The portal statement uses `voucher_lines` (posted vouchers) rather than `general_journal`, so auto-posted entries (e.g., from invoice creation) are not visible to customers in the statement.
- All `general_journal` amounts are stored in a single `currency` column; multi-currency journals are not natively disaggregated.

---

## Future Extension Points

- Multi-currency general journal with base-currency equivalents
- Bank reconciliation module
- Cheque / payment batch processing
- Automated closing entries (depreciation, accruals)
- Integration with tax authority reporting (FBR/SECP)
