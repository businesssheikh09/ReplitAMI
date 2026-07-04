# Reports

**Purpose**: Financial, operational, and compliance reports across accounting, flights, hotels, and customer account management.  
**Backend routes**: `routes/accounting-reports.ts`, `routes/accounting.ts` (financial statements), `routes/flights.ts` (BSP/staff log), `routes/portal-customer.ts` (customer statement)  
**ERP page**: `/reports` (overview), individual report pages  

---

## Accounting Reports

All accounting reports query the `general_journal` as the source of truth. Running balances are computed in-memory during request processing.

---

### Party Statement (`GET /api/accounting/reports/party-statement`)

**Purpose**: Complete account statement for a single client — all debits (amounts billed), credits (payments received), and running balance.

**Parameters**: `clientId` (required)

**Data source**: `general_journal` entries where `debit_account_id` or `credit_account_id` = client's PARTY account

**Response columns**:
| Column | Description |
|---|---|
| `date` | Journal entry date |
| `entryNumber` | Journal entry reference |
| `description` | Narration / source description |
| `debit` | Amount charged to client |
| `credit` | Amount received from client |
| `runningBalance` | Cumulative outstanding balance |
| `sourceType` | invoice / payment / hotel_invoice / voucher |

**ERP use**: Sales and management review outstanding client balances; identify overdue accounts.

---

### Vendor Statement (`GET /api/accounting/reports/vendor-statement`)

**Purpose**: Complete account statement for a single vendor — amounts payable and amounts paid.

**Parameters**: `vendorId` (required)

**Data source**: `general_journal` entries touching the vendor's VENDOR account

**Response columns**: Same structure as party statement but for vendor side.

---

### Cash Book (`GET /api/accounting/reports/cash-book`)

**Purpose**: All transactions touching the `MSFR` (Main Safe / Bank) account — cash inflows and outflows.

**Parameters**: `from`, `to` (date range, optional)

**Data source**: `general_journal` entries where `debit_account_id` or `credit_account_id` = MSFR account

**Response columns**:
| Column | Description |
|---|---|
| `date` | Transaction date |
| `description` | Source description |
| `receipts` | Cash in (credit side of MSFR) |
| `payments` | Cash out (debit side of MSFR) |
| `balance` | Running balance |
| `oppositeAccount` | The other side of the entry |

---

### Receipt Book (`GET /api/accounting/reports/receipt-book`)

**Purpose**: All incoming cash receipts — combines RV (Receipt Vouchers) with auto-posted payment entries.

**Parameters**: `from`, `to` (date range, optional)

**Data source**: 
- RV vouchers with status `posted` from `vouchers` + `voucher_lines`
- Auto-posted payment entries from `general_journal` where `sourceType = 'payment'`

**Response columns**: Date, RV/entry number, client name, narration, amount, received by.

---

### DN Report (`GET /api/accounting/reports/dn-report`)

**Purpose**: All hotel Debit Notes with dual-currency amounts for procurement reconciliation.

**Parameters**: `from`, `to` (date range, optional)

**Data source**: `hotel_invoices` joined with `clients`, `vendors`, `hotels`

**Response columns**:
| Column | Description |
|---|---|
| `dnNumber` | Debit Note number (DN-XXXX) |
| `hotelName` | Hotel property |
| `clientName` | Client billed |
| `vendorName` | Vendor to be paid |
| `checkIn` / `checkOut` | Stay dates |
| `rooms` | Room count |
| `clientAmountSar` | Receivable in SAR |
| `clientAmountPkr` | Receivable in PKR |
| `vendorAmountSar` | Payable in SAR |
| `vendorAmountPkr` | Payable in PKR |
| `margin` | Difference (profit on the booking) |
| `status` | draft / accepted / paid |

---

## Financial Statements

### Trial Balance (`GET /api/accounting/trial-balance`)

**Purpose**: Verify ledger balance and review net position per account.

**Data source**: All `general_journal` entries, grouped by account.

**Response**:
```json
{
  "accounts": [
    {
      "code": "PARTY",
      "name": "Client Receivables",
      "type": "asset",
      "totalDebit": 500000,
      "totalCredit": 350000,
      "netBalance": 150000,
      "normalSide": "debit"
    },
    ...
  ],
  "grandDebit": 1200000,
  "grandCredit": 1200000,
  "isBalanced": true
}
```

**Validation**: `grandDebit === grandCredit` confirms double-entry integrity.

---

### P&L Statement (`GET /api/accounting/pnl`)

**Purpose**: Revenue vs expenses for a period; net profit calculation.

**Parameters**: `yearId` OR `from`+`to` date range

**Logic**:
1. Query `general_journal` for entries in the period
2. Group by account type:
   - Revenue accounts (UMRA, AIR, HOTEL, FOREX): summed as income
   - Expense accounts: summed as costs
3. `netProfit = totalRevenue - totalExpenses`

**Response**:
```json
{
  "revenue": [
    { "account": "UMRA", "name": "Umrah Revenue", "amount": 800000 },
    { "account": "AIR",  "name": "Airline Revenue", "amount": 300000 }
  ],
  "expenses": [
    { "account": "EXP", "name": "Office Expenses", "amount": 50000 }
  ],
  "totalRevenue": 1100000,
  "totalExpenses": 50000,
  "netProfit": 1050000
}
```

---

### Balance Sheet (`GET /api/accounting/balance-sheet`)

**Purpose**: Snapshot of assets, liabilities, and equity at a point in time.

**Parameters**: `yearId` OR `asOf` date

**Logic**:
1. Load opening balances for the financial year
2. Add year-to-date journal entries up to `asOf` date
3. Classify into Assets / Liabilities / Equity
4. Check: `totalAssets === totalLiabilities + totalEquity`

**Response**:
```json
{
  "assets": [
    { "account": "PARTY", "balance": 150000 },
    { "account": "MSFR",  "balance": 300000 }
  ],
  "liabilities": [
    { "account": "VENDOR", "balance": 75000 }
  ],
  "equity": [
    { "account": "PROFIT", "balance": 375000 }
  ],
  "totalAssets": 450000,
  "totalLiabilities": 75000,
  "totalEquity": 375000,
  "isBalanced": true
}
```

---

### General Ledger (`GET /api/accounting/ledger`)

**Purpose**: Detailed transaction history for a single account with running balance.

**Parameters**: `accountId` (required), `from`, `to` (optional)

**Response**: Chronological list of all journal entries touching the account, with debit, credit, running balance, and opposite account code.

---

## Flight Reports

### BSP Report (`GET /api/bsp-report`)

**Purpose**: Airline Billing Settlement Plan — summary of all issued tickets for settlement with airlines.

**Permissions**: Management, Admin only

**Data source**: `flight_quotations` where `status = 'issued'`

**Response columns**:
| Column | Description |
|---|---|
| `ticketNumber` | Issued ticket identifier |
| `airline` | Carrier code |
| `route` | Origin → Destination |
| `departureDate` | Travel date |
| `passengerCount` | Number of passengers |
| `fare` | Ticket fare |
| `commissionRate` | Agreed commission % |
| `commissionAmount` | Commission earned |
| `netPayable` | Fare - commission |
| `issuedBy` | ERP staff member |
| `issuedAt` | Issuance timestamp |

**Filter options**: Date range, airline, staff member.

---

### Staff Ticket Log (`GET /api/staff-ticket-log`)

**Purpose**: Audit trail of all ticket issuances by staff — for accountability and performance tracking.

**Permissions**: All ERP roles

**Data source**: `flight_quotations` joined with `users` (issued_by)

**Response columns**: Staff name, ticket number, client, route, departure date, fare, issuance date.

---

## Customer Portal — Statement

### Account Statement (`GET /api/portal/statement`)

**Purpose**: Customer-facing view of their account — amounts billed and payments made.

**Auth**: Portal authentication (customer must be approved and linked to ERP client)

**Data source**: `voucher_lines` for vouchers linked to the customer's `clientId`

**Response**: Chronological list with date, description, debit, credit, running balance.

**Export**: Frontend downloads as CSV file.

**Limitation**: Only reflects *posted vouchers* — auto-journal entries from invoice creation are not included.

---

## Dashboard Summary

`GET /api/dashboard/operational` powers the ERP Dashboard:

| Metric | Source |
|---|---|
| Today's check-ins | `hotel_requests` where check_in = today |
| Today's departures | `flight_requests/quotations` where departure = today |
| Pending hotel requests | `hotel_requests` where status = 'pending' or 'notified' |
| Overdue invoices | `invoices` where status != 'paid' and due_date < today |
| Unread WhatsApp | `whatsapp_messages` where is_read = false |
| Draft vouchers | `vouchers` where status = 'draft' |
| Pending portal users | `portal_users` where status = 'pending_approval' |

---

## Automation Summary

`GET /api/automations-summary` powers the automation health panel:

| Metric | Description |
|---|---|
| `totalEnabled` | Count of enabled automations |
| `last24hRuns` | Automation executions in last 24 hours |
| `last24hSuccess` | Successful runs |
| `last24hFailure` | Failed runs |
| `automations[]` | Per-type last_status and last_run_at |

---

## Permissions

| Report | Required Role |
|---|---|
| Party Statement | Accounts, Management, Admin |
| Vendor Statement | Accounts, Management, Admin |
| Cash Book | Accounts, Management, Admin |
| Receipt Book | Accounts, Management, Admin |
| DN Report | Accounts, Management, Admin |
| Trial Balance | Accounts, Management, Admin |
| P&L Statement | Accounts, Management, Admin |
| Balance Sheet | Accounts, Management, Admin |
| General Ledger | Accounts, Management, Admin |
| BSP Report | Management, Admin |
| Staff Ticket Log | All ERP roles |
| Customer Statement | Portal (self-only) |

---

## Known Limitations

- Reports compute running balances in-memory per request — for large datasets (thousands of journal entries), response time may increase.
- There is no report caching layer; each request re-queries the database.
- The Portal statement derives from `voucher_lines`, not `general_journal` — this means auto-posted entries (invoice creation, payments) are invisible to customers until a voucher is also posted for the same transaction.
- Date range filtering is available on most reports but there is no saved filter or scheduled report generation.
- BSP Report does not aggregate commissions by airline for settlement; it lists individual tickets.
- No export to PDF or Excel from the ERP — frontend print functionality is available for some pages.

---

## Future Extension Points

- PDF export for all financial statements
- Excel/CSV export from the ERP for all reports
- Scheduled report delivery via WhatsApp / email
- Comparative reports (this year vs last year)
- Budget vs actuals tracking
- Aging analysis for receivables and payables
- Tax report generation (FBR / GST)
