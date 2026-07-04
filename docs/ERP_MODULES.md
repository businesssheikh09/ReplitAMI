# ERP Modules

**Application**: `artifacts/umrah-erp`  
**Framework**: React 19, Vite 7, Wouter (routing), TanStack Query, Radix UI, Tailwind CSS  
**Entry**: `src/main.tsx` → `src/App.tsx`  
**Auth provider**: `src/lib/auth.tsx`  
**Permissions**: `src/lib/permissions.ts`  

---

## Authentication Flow

1. User visits `/login` → `Login` component
2. `POST /api/auth/login` with email + password
3. Server validates bcrypt hash, writes UUID to `users.session_token`, returns token + user object
4. Token and user stored in `localStorage`
5. `AuthProvider` context exposes `user`, `login()`, `logout()`
6. **Heartbeat**: every 2 minutes calls `GET /api/auth/me` to validate session
7. **Inactivity timeout**: 10-minute mousemove/keydown listener; logs out automatically
8. `ProtectedRoute` component wraps all authenticated pages; redirects to `/login` on failure

---

## Sidebar Navigation Structure

The ERP sidebar (`src/components/layout/`) groups pages into logical domains:

### 1. Dashboard
| Route | Page | Description |
|---|---|---|
| `/dashboard` | Dashboard | Operational metrics, automation health, inventory sweep status |

### 2. Sales
| Route | Page | Description |
|---|---|---|
| `/crm` | CRM Clients | Client list, lead status, search |
| `/crm/:id` | Client Detail | Notes, follow-ups, linked bookings |
| `/quotations` | Quotations | Sales proposals management |
| `/quotations/pending` | Pending Inquiries | Convert public inquiries to quotations |
| `/hotel-requests` | Hotel Requests | Active procurement requests |

### 3. Recording (Direct Entry)
| Route | Page | Description |
|---|---|---|
| `/accounting/hotel-invoices/new` | New Hotel Invoice | Direct DN entry |
| `/accounting/vouchers/rv` | Receipt Voucher | Record incoming cash |
| `/accounting/vouchers/pv` | Payment Voucher | Record outgoing cash |
| `/accounting/vouchers/jv` | Journal Voucher | General adjustment |
| `/accounting/vouchers/cv` | Contra Voucher | Internal transfer |

### 4. Finance
| Route | Page | Description |
|---|---|---|
| `/accounting` | Accounting | Invoice list + expense list + summary |
| `/accounting/invoices` | Invoices | Customer invoice management |
| `/accounting/expenses` | Expenses | Operational expense records |
| `/accounting/vouchers` | Vouchers | Draft/approved/posted voucher list |
| `/general-journal` | General Journal | Chart of Accounts + journal entry feed |
| `/accounting/ledger` | Ledger | Per-account running balance |
| `/accounting/trial-balance` | Trial Balance | DR/CR totals per account |
| `/accounting/pnl` | P&L Statement | Revenue vs expenses for a period |
| `/accounting/balance-sheet` | Balance Sheet | Assets / liabilities / equity snapshot |
| `/accounting/financial-years` | Financial Years | Period management and year closing |
| `/currency` | Currency | Daily rates, transactions, FX profit |

### 5. Reports
| Route | Page | Description |
|---|---|---|
| `/reports` | Reports Overview | Links to all report types |
| `/accounting/reports/party-statement` | Party Statement | Full client ledger |
| `/accounting/reports/vendor-statement` | Vendor Statement | Full vendor ledger |
| `/accounting/reports/cash-book` | Cash Book | MSFR account transactions |
| `/accounting/reports/receipt-book` | Receipt Book | RV vouchers + auto-postings |
| `/accounting/reports/dn-report` | DN Report | Hotel Debit Notes |
| `/bsp-report` | BSP Report | Airline ticket sales summary |
| `/staff-ticket-log` | Staff Ticket Log | Ticket issuance by staff |

### 6. Operations
| Route | Page | Description |
|---|---|---|
| `/flights` | Flights | GDS search, group tickets, quotations |
| `/transport` | Transport | Ground transport bookings |
| `/visa` | Visa | Visa application tracking |
| `/passenger-documents` | Passenger Docs | OCR passport/CNIC management |
| `/cancellations-refunds` | Cancellations | Refund workflow management |

### 7. Portal
| Route | Page | Description |
|---|---|---|
| `/portal-users` | Portal Users | Approve/reject/link portal accounts |
| `/booking-inquiries` | Booking Inquiries | Website flight booking requests |
| `/flight-requests` | Flight Requests | Direct flight request management |

### 8. Messaging
| Route | Page | Description |
|---|---|---|
| `/whatsapp-inbox` | WhatsApp Inbox | Group message inbox + send |
| `/bot-campaigns` | Message Campaign | Bot campaign creation and control |
| `/media-library` | Media Library | File asset manager |

### 9. Files (Master Records)
| Route | Page | Description |
|---|---|---|
| `/hotels` | Hotels | Hotel master database |
| `/vendors` | Vendors | Vendor/supplier directory |

### 10. Admin (Settings)
| Route | Page | Description |
|---|---|---|
| `/users` | Users | ERP user management |
| `/gds-settings` | GDS Settings | Amadeus/Sabre/Galileo credentials |
| `/ai-settings` | AI Settings | OpenAI API key + OCR mode |
| `/local-airline-settings` | Airlines | Local carrier configuration |
| `/website-settings` | Website Config | Branding, templates, announcement |
| `/automation-settings` | Automation Engine | Enable/disable/configure automations |
| `/automation-logs` | Automation Logs | Run history for all automations |

---

## Page Descriptions

### Dashboard (`/dashboard`)
- **API calls**: `GET /api/dashboard/operational`, `GET /api/inventory-sweep/status`, `GET /api/automations-summary`
- Shows: today's arrivals, check-ins, pending requests, unpaid invoices, unread WhatsApp messages, automation health panel, sweep status

### CRM — Client List (`/crm`)
- **API calls**: `GET /api/clients`
- Filter by lead_status, search by name/phone/email
- Actions: create client, delete client, navigate to detail

### CRM — Client Detail (`/crm/:id`)
- **API calls**: `GET /api/clients/:id`, `GET /api/clients/:id/notes`, `GET /api/follow-ups?clientId=`
- Tabs: Overview, Notes, Follow-ups, Bookings
- Actions: edit client fields, add/delete notes, create/complete follow-ups

### Quotations (`/quotations`)
- **API calls**: `GET /api/quotations`
- Create, edit, and manage sales proposals

### Pending Inquiries (`/quotations/pending`)
- **API calls**: `GET /api/package-inquiries`, `POST /api/quotations`, `PATCH /api/package-inquiries/:id`
- Converts public website inquiries into formal quotations

### Hotel Requests (`/hotel-requests`)
- **API calls**: `GET /api/hotel-requests`, `POST /api/hotel-requests/:id/send-to-vendor`, `POST /api/hotel-requests/:id/quotes`
- Manages procurement pipeline from request → vendor broadcast → quote selection → invoice

### Accounting (`/accounting`)
- **API calls**: `GET /api/invoices`, `GET /api/expenses`, `GET /api/invoices/hotel`
- Tabs: Invoices (UMRA packages), Hotel Invoices (DN), Expenses

### Vouchers (`/accounting/vouchers`)
- **API calls**: `GET /api/accounting/vouchers`, `POST /api/accounting/vouchers/:id/approve`, `POST /api/accounting/vouchers/:id/post`
- Workflow: Draft → Approve → Post → (Reverse if needed)
- Supports RV, PV, JV, CV types

### General Journal (`/general-journal`)
- **API calls**: `GET /api/accounting/journal`, `GET /api/accounting/accounts`, `POST /api/accounting/journal`
- Two tabs: Chart of Accounts view, Journal entry feed
- Manual journal entry creation for accounts staff

### Flights (`/flights`)
- **API calls**: `GET /api/group-tickets`, `POST /api/group-tickets/sync`, `POST /api/flights/search`, `POST /api/flights/issue-ticket`, `GET /api/flight-quotations`
- Three panels: Group Tickets inventory, Live GDS Search, Quotation list
- PIN-protected ticket issuance

### Portal Users (`/portal-users`)
- **API calls**: `GET /api/portal/users`, `PATCH /api/portal/users/:id/status`, `PATCH /api/portal/users/:id`, `POST /api/portal/users/:id/scan-doc/:docId`
- Approve, reject, or suspend portal accounts
- Link portal user to ERP client (clientId)
- View uploaded documents, trigger OCR re-scan

### Booking Inquiries (`/booking-inquiries`)
- **API calls**: `GET /api/booking-inquiries`, `PATCH /api/booking-inquiries/:id`, `PATCH /api/payment-receipts/:id/verify`
- Review public booking requests, verify uploaded payment receipts

### WhatsApp Inbox (`/whatsapp-inbox`)
- **API calls**: `GET /api/whatsapp-inbox/groups`, `GET /api/whatsapp-inbox/messages/:jid`, `POST /api/whatsapp-inbox/send`, `POST /api/whatsapp-inbox/links`
- Group-based inbox with unread badge counts
- Send text/media messages, link groups to ERP entities

### Bot Campaigns (`/bot-campaigns`)
- **API calls**: `GET /api/bot/contacts`, `POST /api/bot/campaign`, `POST /api/bot/campaign/:id/start`
- Create text or media campaigns targeting all contacts or a selection
- Real-time progress display with send rate control

### Automation Settings (`/automation-settings`)
- **API calls**: `GET /api/automations`, `PATCH /api/automations/:type`, `POST /api/automations/:type/run`
- Toggle each of the 8 automations on/off
- Override cron expression and WhatsApp message templates
- Trigger manual runs

### AI Settings (`/ai-settings`)
- **API calls**: `GET /api/ai-settings/status`, `POST /api/ai-settings`, `GET /api/ocr-settings`, `PATCH /api/ocr-settings`
- Enter OpenAI API key (stored in `process.env` for session; note about Replit Secrets)
- Configure OCR provider (local Tesseract / AI GPT-4o-mini / both) and confidence thresholds

---

## RBAC Integration

Every route is wrapped by `ProtectedRoute`. The component calls:
- `canAccess(user.role, routePath)` — from `ROUTE_PERMISSIONS` map
- `canDo(user.role, action)` — for fine-grained UI actions (e.g. `viewPassport`, `refundTicket`)

`management` and `admin` roles bypass all permission checks.

See [PERMISSIONS.md](PERMISSIONS.md) for the full role-to-route mapping.

---

## Components

### Layout Components
- `src/components/layout/Sidebar.tsx` — grouped navigation with role-filtered items
- `src/components/layout/Header.tsx` — page title, breadcrumbs, user menu
- `src/components/layout/ProtectedRoute.tsx` — auth + RBAC gate

### Shared UI Components
- `src/components/ui/` — full Radix UI + Tailwind component library (Button, Dialog, Table, Form, Select, etc.)
- `src/components/ui/data-table.tsx` — sortable, filterable table with pagination
- `src/components/ui/stat-card.tsx` — dashboard metric card

### Domain Components
- `src/components/accounting/VoucherForm.tsx` — multi-line voucher entry
- `src/components/flights/FlightSearchForm.tsx` — GDS search form with GDS selector
- `src/components/whatsapp/MessageThread.tsx` — chat-style message display

---

## Dependencies (Key)

| Package | Purpose |
|---|---|
| `react` 19.1 | UI framework |
| `wouter` | Lightweight client-side routing |
| `@tanstack/react-query` | Server state management |
| `@workspace/api-client-react` | Generated React Query hooks |
| `@workspace/api-zod` | Generated Zod schemas |
| `lucide-react` | Icon set |
| `framer-motion` | Animations |
| `zod` | Runtime validation |
| `tailwind-merge` + `clsx` | Conditional Tailwind classes |
| Radix UI (all primitives) | Accessible headless UI |

---

## Known Limitations

- Password visibility in the user list is available to admin roles but hash is shown, not plaintext.
- WhatsApp QR code must be scanned once per session restart; session files in `whatsapp-session/` persist across restarts.
- Inactivity timeout (10 min) cannot be configured per-user.
- The `admin` role is not a DB enum value — it is a special in-code role accepted by `requireAuth`.
