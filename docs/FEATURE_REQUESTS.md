# Feature Requests — Al Musafir International ERP

Last updated: June 2026

Priority key: 🔴 High (blocks operations) · 🟡 Medium (important but workaround exists) · 🟢 Low (nice to have)
Status key: Partial (work has started in code) · Planned (agreed but not started) · Not confirmed (idea only, not in code)

---

## Security

| Feature | Business Purpose | Priority | Status | Notes |
|---|---|---|---|---|
| Secure password storage (hashing) | Passwords are currently stored as plain text in the database. Anyone with database access can read all passwords. | 🔴 High | Planned | Must be fixed before real customers use the portal. |

---

## Flights

| Feature | Business Purpose | Priority | Status | Notes |
|---|---|---|---|---|
| Live GDS credentials in production mode | Without live credentials, all flight search results are fake test data | 🔴 High | Planned | GDS Settings screen exists — needs real API keys from Amadeus, Sabre, or Galileo |
| PDF quotation / itinerary | Send clients a formatted quotation document via WhatsApp or email | 🔴 High | Not confirmed | Currently staff copy details manually |
| Link quotation to invoice | When a quotation is confirmed, auto-create a matching accounting invoice | 🟡 Medium | Not confirmed | Currently done manually |
| Email notification to client | Send client an email when their quotation is ready | 🟢 Low | Not confirmed | No email system integrated yet |

---

## Accounting

| Feature | Business Purpose | Priority | Status | Notes |
|---|---|---|---|---|
| PDF invoice export | Accounting team needs to send formatted invoices to clients and vendors | 🔴 High | Not confirmed | Currently no way to print or send a formatted invoice |
| Fix invoice counter persistence | Invoice numbers can repeat after a server restart | 🟡 Medium | Planned | Counter must be stored in the database, not in server memory |
| Profit & loss report | See monthly/quarterly income vs. expenses | 🟡 Medium | Not confirmed | Data exists in the system; no report screen yet |
| Accounts receivable aging | See which clients owe money and for how long | 🟡 Medium | Not confirmed | Important for collections follow-up |
| Bank reconciliation | Match recorded payments against bank statement | 🟢 Low | Not confirmed | |

---

## Customer Portal

| Feature | Business Purpose | Priority | Status | Notes |
|---|---|---|---|---|
| Staff notification on new party registration | Staff need to know when a party agent registers so they can approve quickly | 🔴 High | Not confirmed | Currently staff must check the portal users list manually |
| Payment receipt confirmation to customer | After a party agent uploads a receipt, they should get confirmation when it is verified | 🟡 Medium | Not confirmed | No feedback loop currently |
| Customer booking history | Customers should be able to log in and see their past bookings and status | 🟡 Medium | Not confirmed | Not built yet |
| Email on registration approval/rejection | Party agents should receive an email when their registration is approved or rejected | 🟡 Medium | Not confirmed | No email system integrated yet |

---

## CRM

| Feature | Business Purpose | Priority | Status | Notes |
|---|---|---|---|---|
| Follow-up due date alerts | Staff should be notified automatically when a follow-up task is overdue | 🔴 High | Not confirmed | Currently staff must check the follow-up list manually every day |
| Link clients to their quotations and invoices | See all bookings and payments for a client in one place | 🟡 Medium | Not confirmed | Currently requires checking separate modules |
| Pipeline / kanban view | See all leads by stage (new → contacted → quoted → converted) | 🟢 Low | Not confirmed | Useful for sales management |

---

## Transport

| Feature | Business Purpose | Priority | Status | Notes |
|---|---|---|---|---|
| Transport invoicing | Link transport bookings to the accounting module | 🟡 Medium | Not confirmed | Currently transport costs cannot be invoiced through the ERP |
| Driver and vehicle management | Maintain a list of drivers and vehicles for easy assignment | 🟢 Low | Not confirmed | |

---

## Visa Applications

| Feature | Business Purpose | Priority | Status | Notes |
|---|---|---|---|---|
| Document upload for visa | Attach passport copy, photos, and application forms to a visa record | 🟡 Medium | Not confirmed | No document handling for visas currently |
| Status change notifications | Alert staff when a visa application status changes | 🟢 Low | Not confirmed | |
| Link to client record | Connect visa applications to the client's CRM record | 🟡 Medium | Not confirmed | Currently separate |

---

## Reports

| Feature | Business Purpose | Priority | Status | Notes |
|---|---|---|---|---|
| Dedicated reports section | Management needs filtered, exportable reports | 🟡 Medium | Not confirmed | Currently only basic charts on the Dashboard |
| Date range filters on all reports | See data for a specific month or quarter | 🟡 Medium | Not confirmed | No date filters exist on any report currently |
| Export to Excel or PDF | Share reports with management or external accountants | 🟡 Medium | Not confirmed | |
| Umrah package performance report | Which packages are selling, which are not | 🟢 Low | Not confirmed | |

---

## WhatsApp & Campaigns

| Feature | Business Purpose | Priority | Status | Notes |
|---|---|---|---|---|
| Message templates / quick replies | Save common messages and send with one click | 🟢 Low | Not confirmed | Useful for daily follow-up messages |
| Campaign scheduling | Schedule a campaign to start at a specific future time | 🟢 Low | Not confirmed | Campaigns currently start immediately |
| Auto-reply / chatbot | Send automatic replies to common customer questions | 🟢 Low | Not confirmed | Outside current scope |

---

## General / Infrastructure

| Feature | Business Purpose | Priority | Status | Notes |
|---|---|---|---|---|
| Email integration | Send invoices, quotations, and notifications by email | 🟡 Medium | Not confirmed | No email provider connected yet — affects multiple modules |
| Audit log | Track who changed what and when, for accountability | 🟡 Medium | Not confirmed | `activity_logs` table exists in the database but is not fully used yet |
| Production deployment | Make the ERP accessible over the internet for all staff | 🔴 High | Planned | Blocked by the password security fix |
