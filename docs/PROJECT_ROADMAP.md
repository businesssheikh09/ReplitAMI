# Al Musafir International — ERP Project Roadmap

Last updated: June 2026

---

## Current Stage

**Active development — not yet in production.**

The ERP is being built and tested. Core modules (Flights, WhatsApp, Accounting, Dashboard) are functional and usable internally. Several modules are partially built. The system has not been deployed to a live production server for customer use yet.

---

## Overall Progress

| Area | Status |
|---|---|
| Core infrastructure (server, database, login) | ✅ Complete |
| Flight management | 🟡 Mostly complete |
| WhatsApp & Campaigns | 🟡 Mostly complete |
| Dashboard | 🟡 Mostly complete |
| Media Library | 🟡 Mostly complete |
| Accounting | 🟡 Functional, some gaps |
| Hotels | 🟡 Functional, some gaps |
| Customer Portal | 🟡 Partial |
| CRM (Clients & Follow-ups) | 🟡 Partial |
| Transport | 🟠 Basic only |
| Visa Applications | 🟠 Basic only |
| Reports | 🔴 Very early |

---

## Completed Modules

These modules have working front-end screens, working back-end logic, and saved data in the database.

- **Login & User Management** — Staff can log in with email and password. Roles (management, sales, accounts, operations) are enforced. Management can create or deactivate users and set ticketing permissions.
- **Dashboard** — Shows key stats, recent activity, revenue chart, and staff performance at a glance.
- **Flight Search & Quotations** — Staff can search flights via GDS providers (Amadeus, Sabre, Galileo), create quotations, and issue tickets using a PIN.
- **WhatsApp Inbox** — Staff can read incoming WhatsApp messages and reply, grouped by contact or group.
- **WhatsApp Campaigns** — Send bulk messages (text or media) to all contacts or a selected list, with automatic delay to prevent bans. Campaign history is recorded.
- **Media Library** — Upload, organise, and reuse files (images, PDFs, videos) for campaigns and other modules.
- **GDS Settings** — Configure Amadeus, Sabre, and Galileo API credentials.
- **Group Tickets** — Manage Umrah group flight seats. Customers can book seats through the public portal.

---

## Modules in Progress

These modules have meaningful functionality but are not fully finished.

- **Accounting** — Invoices, payments, expenses, chart of accounts, and a general journal all work. Missing: PDF invoice export, bank reconciliation, financial period reporting.
- **Hotels** — Hotel and vendor list management, hotel requests, and hotel invoices all work. Missing: full quote comparison workflow, automated cost allocation.
- **Customer Portal** — Party (travel agencies) and DC (direct customers) can register, log in, view group tickets, submit booking inquiries, and upload documents. Missing: customer-facing booking history, payment confirmation notifications.
- **CRM** — Client records, notes, lead status, and follow-up tasks all work. Missing: pipeline view, bulk actions, follow-up reminders.

---

## Pending / Early Modules

These modules exist in the system but are not ready for daily use.

- **Transport** — A basic booking screen exists. No quotation or invoicing flow yet.
- **Visa Applications** — A basic application tracking screen exists. No document workflow or status automation.
- **Reports** — Revenue and staff performance charts are in the Dashboard. No dedicated reports module with filters, date ranges, or exports.

---

## Deployment Readiness

The system is **not ready for production deployment** yet. The following must be completed first:

1. **Fix plain-text password storage** — Critical security issue. Passwords are currently stored unencrypted in the database. Must be fixed before any customer faces the system.
2. GDS credentials entered and tested in live mode (currently using mock/test data if not configured)
3. Customer portal end-to-end tested with real party bookings
4. Accounting data reviewed for correctness
5. All staff user accounts created with correct roles

---

## Next 7-Day Priorities

These are the most important things to complete this week, based on what is closest to done:

1. **Fix plain-text passwords** — Critical security issue before any deployment.
2. **Transport module** — Add quotation and invoicing so transport bookings are financially tracked.
3. **Visa module** — Add basic status workflow (received → processing → approved/rejected).
4. **PDF invoice export** — Accounting team needs to send invoices to clients.
5. **CRM follow-up reminders** — Staff need alerts when a follow-up task is due.
6. **Portal payment confirmation** — Party agents need to know when their payment receipt has been verified.
7. **Production deployment preparation** — Set up live environment, configure real GDS credentials.
