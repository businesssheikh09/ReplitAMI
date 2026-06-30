# Business Rules — Al Musafir International ERP

Last updated: June 2026

**Important:** This document only contains rules that are actually coded and enforced in the system today. If a rule does not appear here, it is not automatically enforced — staff must follow it manually or it does not yet exist in the system.

---

## 1. Staff Roles and What They Can Access

**Rule:** Every ERP user has exactly one of four roles. The system enforces what each role can and cannot do on every screen and every action.

| Role | What they can do |
|---|---|
| `management` | Full access to all modules |
| `sales` | Flights, clients, quotations, CRM, WhatsApp |
| `accounts` | Accounting, invoices, payments, expenses |
| `operations` | Hotels, transport, visa, portal user management |

These roles are checked on the server for every request. Changing a role takes effect at the staff member's next action.

---

## 2. Flight Ticket Issuance — Two Separate Locks

**Rule:** Issuing a flight ticket requires passing two independent checks. Both must pass or the system rejects the action.

**Check 1 — Role permission:**
The `accounts` role is permanently blocked from issuing tickets. This is enforced regardless of any other setting.

**Check 2 — Ticketing flag and PIN:**
All other roles (management, sales, operations) can issue tickets only if:
- Their account has the "Can Issue Tickets" flag turned on by management, AND
- They have been given a ticketing PIN, AND
- They enter the correct PIN at the time of issuance

**Check 3 — Booking status:**
A booking must be in **"booked"** status before a ticket can be issued. If the booking is in any other status (e.g. quotation, cancelled, ticketed), the system rejects the attempt.

**What the ticket number looks like:** `TKT-XXXXX-XXXX` (auto-generated, unique per booking)

---

## 3. Payment Deadline Tiers for Group Ticket Bookings

**Rule:** When a Party agent (travel agency) submits a booking inquiry for a group ticket seat through the portal, the system automatically calculates how long they have to upload their payment receipt. The window depends on how many hours are left until the flight departs.

| Hours Until Flight | Payment Deadline Given |
|---|---|
| 24 hours or less | 1 hour |
| 25 to 48 hours | 3 hours |
| 49 to 240 hours (up to 10 days) | 12 hours |
| More than 240 hours (more than 10 days) | 24 hours |

This deadline is calculated at the moment the booking inquiry is submitted and is stored permanently. It does not change after that.

**Automatic expiry:** The system runs a background check every 10 minutes. Any receipt still marked as "pending" after its deadline is automatically changed to "expired". No staff action is needed for this — it happens on its own.

**Only for Party agents:** Direct customers (DC) do not go through this payment receipt flow.

---

## 4. WhatsApp Campaign Delay (Ban Prevention)

**Rule:** When a WhatsApp campaign is started, the system automatically decides how long to wait between each individual message. This prevents WhatsApp from detecting bulk sending and banning the office number.

**The formula in plain language:**
- The system divides 48 hours (172,800 seconds) by the number of contacts in the campaign
- The result is used as the gap between messages
- The minimum gap is always 20 seconds — it never goes below this, no matter how few contacts

**Examples:**
- 10 contacts → 20 seconds between messages (minimum floor applies; total ~3 minutes)
- 100 contacts → approx. 29 minutes between messages (total ~48 hours)
- 1,000 contacts → approx. 173 seconds (just under 3 minutes) between messages

**When is the delay set:** The delay is calculated at the moment "Start" is clicked and is based on the exact number of contacts in that campaign. It is stored on the campaign record and stays the same if the campaign is paused and resumed.

---

## 5. Campaign Recipient Selection

**Rule:** When creating a WhatsApp campaign, staff must choose one of two recipient modes:

- **All contacts** — sends to every individual contact extracted from all monitored WhatsApp group participant lists
- **Selected contacts** — staff manually choose specific contacts from the list; only those selected receive the message

The selected contact list is locked in when the campaign is created. It cannot change after the campaign starts.

**Where contacts come from:** Contacts are not entered manually. They are extracted automatically from the participant lists of WhatsApp groups the office number is a member of. A person who has never been in a monitored group will not appear in the contact list.

---

## 6. Portal Registration Rules

**Rule:** Two types of users can register on the public portal. Each follows a different process.

**Party (travel agency / sub-agent):**
- Registration status is set to "pending approval" automatically
- They cannot log in or make bookings until an ERP staff member manually approves their account
- They are expected to upload their DTS certificate, visiting card, and company registration during sign-up (optional but expected for approval)

**DC (direct customer):**
- Registration status is set to "active" automatically — no staff approval required
- They can log in and browse group tickets immediately after registering

**Duplicate prevention:** The system checks the phone number at registration. If the same phone number is already registered, the registration is rejected with an error.

**Required fields for both types:** Full name, phone number, password, and account type (party or dc).

---

## 7. Automatic Payment Receipt Expiry

**Rule:** The server runs a background sweep every 10 minutes. It finds every payment receipt that is:
1. Still in "pending" status, AND
2. Past its calculated deadline

Any receipt meeting both conditions is automatically changed to "expired" status.

This runs automatically — staff do not need to do anything to trigger it. However, a staff member can manually change a receipt status if a receipt was incorrectly expired.

---

## 8. Flight Search GDS Fallback to Mock Data

**Rule:** If a GDS provider (Amadeus, Sabre, or Galileo) is not configured in GDS Settings, or if its API call fails for any reason, the system automatically returns fake test flight results. It does this silently — no error is shown to the staff member on screen.

**Practical meaning:** Until a GDS is configured with working live credentials, every flight search in the ERP returns test data that cannot be used for real bookings. Staff should not create quotations or confirm bookings based on mock data.

---

## 9. Invoice Auto-Numbering

**Rule:** Every new customer invoice or vendor bill is automatically assigned a number in the format `INV-YYYY-NNNN` (example: `INV-2026-1001`).

**Known limitation:** The number counter is stored in server memory, not in the database. If the server restarts, the counter resets to 1001 for the current year. This can result in duplicate invoice numbers. This is a known issue to be fixed.

---

## 10. Accounting Journal Auto-Posting

**Rule:** When a payment is recorded against an invoice, the system automatically creates the corresponding double-entry in the general journal. Staff do not need to create the journal entry separately.

This applies to payments recorded through the Accounting → Invoices screen.

---

## 11. Single WhatsApp Connection

**Rule:** Only one WhatsApp number can be connected to the ERP at any given time. Connecting a new number automatically disconnects the previous one.

**Reconnection is manual:** If the WhatsApp connection drops (e.g. phone goes offline, session times out), a staff member must go to the WhatsApp Settings screen and scan the QR code again. The system cannot reconnect automatically.

---

## 12. OCR Document Scan on Booking Inquiry

**Rule:** When a passenger's travel document (passport, ID) is uploaded with a booking inquiry, the system automatically attempts to read the document using OCR (text recognition) and fills in the passenger's details.

This requires the AI/OCR feature to be enabled and configured with an API key in AI Settings. If the key is not configured, the scan is skipped silently and fields remain blank for staff to fill in manually.

---

## Rules Checked and Not Found in the Code

The following were considered as possible business rules. They are **not confirmed** in the current codebase and should not be treated as automatically enforced:

| Rule | Status |
|---|---|
| Hidden service fee or markup added to flight prices | Not found in the database schema or flight pricing code |
| Minimum deposit requirement before confirming a booking | Not found |
| Automatic invoice sent by email on creation | Not found — no email system is integrated |
| Automatic follow-up reminders when due date passes | Not found — staff must check manually |
| Booking hold timer (auto-cancel if not confirmed within X hours) | Not found in the flights or quotations code |
