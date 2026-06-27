# Manual Testing Checklist

Run through these steps when verifying a build. Each section covers one functional area.

---

## 1. ERP Login & Role Guards

- [ ] Navigate to ERP (`/`). Unauthenticated users are redirected to `/login`.
- [ ] Log in with a `management` account → lands on `/dashboard`.
- [ ] Log in with a `sales` account → redirected to `/quotations`.
- [ ] Log in with an `accounts` account → redirected to `/accounting/invoices`.
- [ ] Log in with an `operations` account → redirected to `/quotations`.
- [ ] Try navigating to `/users` as a `sales` user → redirected to `/access-denied`.
- [ ] Log out → session token is cleared; navigating to any protected route redirects to `/login`.

---

## 2. Flight Requests (Public → ERP)

- [ ] On the public website (`/frontend/flights`), open the **Custom Request** tab.
- [ ] Fill in origin, destination, departure date, passenger count, and contact info. Submit.
- [ ] Response returns a request reference number (e.g. `FR-XXXXXX`).
- [ ] In the ERP, navigate to `/flight-requests`. The new request appears with status `pending`.
- [ ] Assign the request to a staff member and change status to `reviewing`.
- [ ] Set `actualFare` and `bookingFare`; change status to `issued`.
- [ ] Confirm a journal entry is posted automatically in `/general-journal` (debit: Accounts Receivable — Flights [ASSET], credit: Flight Revenue [REVENUE], amount = bookingFare in PKR).

---

## 3. Group Tickets (Public Booking)

- [ ] In the ERP, navigate to `/flights` and create a group ticket (or sync via `/api/group-tickets/sync`).
- [ ] On the public website (`/frontend/flights`), open the **Group Tickets** tab. The ticket appears in the list.
- [ ] Click **Book** → `/frontend/book-flight/:id` opens.
- [ ] Fill in passenger details and submit. Response includes a reference number.
- [ ] In the ERP, navigate to `/booking-inquiries`. The inquiry appears with status `new`.
- [ ] Update status to `confirmed`. Confirm the inquiry reflects the change on re-fetch.

---

## 4. Portal Auth

- [ ] On the public website, register a new portal user (`/frontend/register` or equivalent). Status is `pending_approval`.
- [ ] In the ERP, navigate to `/portal-users`. The new user appears. Approve them.
- [ ] Portal user logs in (`POST /api/portal/login`). Response contains a session token.
- [ ] Make an authenticated portal request (`GET /api/portal/my-bookings`) with `Authorization: Bearer <token>`. Returns 200.
- [ ] Make the same request with an invalid or missing token. Returns 401.

---

## 5. Accounting

- [ ] In the ERP, navigate to `/general-journal`. Create a new journal entry (debit account, credit account, amount, description).
- [ ] Entry appears in the list with a unique `entryNumber`.
- [ ] Navigate to `/accounting`. Summary figures update to reflect the new entry.
- [ ] Navigate to `/accounting/invoices`. Create a draft invoice, send it, then mark it paid.
- [ ] Payment record appears under the invoice.

---

## 6. GDS Settings

- [ ] In the ERP, navigate to `/gds-settings`. Three providers are listed: Amadeus, Sabre, Galileo.
- [ ] Save credentials for one provider and set `isActive = true`.
- [ ] On the public website, perform a flight search. Results come from the configured GDS (check API server logs).
- [ ] Set `isActive = false` (or clear `clientId`). Repeat the search → results come from `mockFlights()` (mock data).

---

## 7. WhatsApp

- [ ] In the ERP, navigate to the WhatsApp section. Status shows disconnected.
- [ ] Click **Connect** and scan the QR code with a WhatsApp-linked phone.
- [ ] Status changes to connected.
- [ ] Navigate to `/whatsapp-inbox`. Groups monitored in `/whatsapp-groups` are listed.
- [ ] Enable a group. Incoming messages from that group appear in the inbox.
- [ ] Send a reply from the inbox. Sent message appears as a right-side bubble (isSent = true).

---

## 8. Package Inquiries

- [ ] On the public website, submit a package inquiry (select hotels, dates, passenger counts, contact info).
- [ ] Response contains a `referenceNumber`.
- [ ] In the ERP, navigate to a package inquiries list (accessible via API `GET /api/package-inquiries`).
- [ ] The new inquiry appears with status `pending`.
- [ ] Update status to `quoted`; link a quotation ID. Confirm the inquiry reflects the change.

---

## 9. Hotel Invoices

- [ ] In the ERP, navigate to `/accounting/hotel-invoice/new`. Create a hotel invoice (fill DN number, hotel, room details, SAR/PKR amounts).
- [ ] Invoice saved with status `draft`.
- [ ] Navigate to `/hotel-invoices`. Invoice appears in the list.
- [ ] Open the invoice and click **Accept** (`PATCH .../accept`). Status changes to `accepted`.

---

## 10. Bot Campaigns

- [ ] In the ERP, navigate to `/bot-campaign`. Create a campaign with a message and a list of contacts.
- [ ] Start the campaign. Status changes to `running`.
- [ ] Pause the campaign. Status changes to `paused`.
- [ ] Check `bot_campaign_sends` table — one row per sent message.
