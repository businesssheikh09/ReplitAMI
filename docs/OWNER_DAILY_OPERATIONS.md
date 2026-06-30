# Owner Daily Operations Guide — Al Musafir International ERP

Last updated: June 2026

This guide is written for the business owner and office staff. No technical knowledge is needed.

---

## Morning Routine (Start of Day)

**Time needed: 5–10 minutes**

1. Open the ERP and log in with your email and password.
2. Go to the **Dashboard** — check the summary numbers at the top:
   - How many bookings are active?
   - How many follow-ups are due today?
   - What is the revenue this month?
3. Go to **CRM → Follow-ups** — look for any tasks that are overdue or due today. Assign them to the right staff member if not already assigned.
4. Go to **Portal → Portal Users** — check if any Party agents are waiting for approval. Approve or reject them.
5. Check the **WhatsApp Inbox** — review any overnight messages and make sure someone is assigned to reply to them.

---

## How to Process a New Flight Inquiry

**Who does this:** Sales staff

1. Go to **Flights** in the menu.
2. Click **Search Flights** and enter the route, date, number of passengers, and cabin class.
3. The system will show available flights. Choose the best option for the client.
4. Click **Create Quotation** and fill in the client's name, contact, and price details.
5. Save the quotation. Its status is now "quotation".
6. Share the quotation with the client (currently manual — send via WhatsApp message).
7. When the client confirms, update the booking status to **"booked"**.
8. Once payment is confirmed, an authorised staff member issues the ticket:
   - Open the booking and click **Issue Ticket**
   - Enter the ticketing PIN
   - The system generates a ticket number and changes the booking status to "ticketed"

**Important — two rules enforced automatically:**
- Only staff with the "Can Issue Tickets" permission and a PIN can issue a ticket
- The Accounts role can never issue tickets — this is blocked by the system

**Important — GDS data:** If GDS settings have not been configured with real credentials, all flight search results are test data. Do not use them for real bookings. Ask your developer to confirm live mode is active before processing real bookings.

---

## How to Handle a Group Ticket Booking from the Portal

**Who does this:** Operations staff + Accounts staff

1. Go to **Booking Inquiries** in the menu.
2. Look for new inquiries from Party agents or direct customers.
3. Click on an inquiry to view passenger details, uploaded documents, and payment status.
4. The system shows a **payment deadline** — the remaining time for the customer to upload a receipt (see deadlines below).
5. When a receipt is uploaded, the inquiry shows status "uploaded". Review the receipt.
6. If the payment is genuine, mark the receipt as **Verified**.
7. After verification, process the booking in your normal ticket system.

**Payment deadline tiers (automatic):**
| Time until flight | Deadline given to customer |
|---|---|
| Less than 24 hours | 1 hour |
| 25 to 48 hours | 3 hours |
| 49 hours to 10 days | 12 hours |
| More than 10 days | 24 hours |

The system automatically marks receipts as "expired" every 10 minutes if the deadline passes without verification.

---

## How to Verify a Payment Receipt

**Who does this:** Accounts staff

1. Go to **Booking Inquiries** and open the inquiry.
2. Scroll to the payment receipt section and click the receipt link to view the uploaded file.
3. Check:
   - Does the amount match the agreed fare?
   - Is the sender's name the same as the portal user?
   - Is the receipt dated within a reasonable timeframe?
4. If everything matches, click **Verify**. If not, contact the customer and ask for a correct receipt.

**Do not verify a receipt if:**
- The amount does not match
- The sender name does not match the registered customer
- The receipt looks edited or unclear

---

## How to Use WhatsApp Campaigns

**Who does this:** Sales or management staff

**Before starting:** Make sure WhatsApp is connected. Check the WhatsApp status indicator in the menu. If it shows disconnected, go to WhatsApp Settings and scan the QR code to reconnect.

**Sending a text message:**

1. Go to **Campaigns** in the menu.
2. If a campaign is already running, stop it first — only one can run at a time.
3. In the Message Mode section, choose **Text only**.
4. Type your message. A preview shows exactly what recipients will see.
5. In the Recipients panel, choose:
   - **All** — sends to every contact in the WhatsApp group lists, OR
   - **Select contacts** — use the search box and checkboxes to choose specific people
6. Read the delay estimate shown on screen — the system decides the gap between messages automatically.
7. Click **Start Campaign** — the campaign begins in the background.
8. Track progress on the same screen. Use **Pause**, **Resume**, or **Stop** as needed.

**Sending a file (image, PDF, video):**

Follow the same steps, but in step 3 choose **Media + Caption** mode. Click "Browse Media Library" to pick the file, then add an optional caption. The rest of the steps are the same.

**Rules the system enforces automatically:**
- The system adds a delay between messages to prevent the number from being banned by WhatsApp. This cannot be turned off.
- Only one campaign can run at a time. If you want to send a new campaign, stop the current one first.
- Contacts come from WhatsApp group membership only. You cannot add contacts manually.

---

## How to Create an Invoice

**Who does this:** Accounts staff

1. Go to **Accounting → Invoices**.
2. Click **New Invoice**.
3. Choose type: **Customer** (for money clients owe you) or **Vendor** (for money you owe suppliers).
4. Link to a client or vendor record.
5. Enter the amount, currency, and due date.
6. Save. The invoice number is assigned automatically (format: INV-2026-XXXX).
7. When payment is received, open the invoice and click **Record Payment**.
8. The system automatically posts the payment to the general journal — no separate journal entry needed.

**Current limitation:** Invoices cannot be exported as PDF yet. To send an invoice to a client, you will need to screenshot the screen or write the details manually.

---

## How to Approve or Reject a Party Registration

**Who does this:** Management or operations staff

1. Go to **Portal → Portal Users** in the menu.
2. Filter by status "Pending Approval" to see new registrations.
3. Click on a registration to view their details and any uploaded documents (DTS certificate, company registration, visiting card).
4. Review the documents.
5. If approved, change their status to **Active**. They can now log in and make bookings.
6. If rejected, change their status to **Rejected** and note the reason.

**Note:** There is no automatic notification to the customer when you approve or reject — you will need to contact them manually (e.g. via WhatsApp) until email notifications are built.

---

## How to Manage Staff Users

**Who does this:** Management only

1. Go to **Users** in the menu.
2. To add a new staff member: click **New User**, fill in their name, email, and assign a role.
3. Roles:
   - `management` — full access
   - `sales` — flights, clients, CRM
   - `accounts` — invoicing and payments (cannot issue tickets)
   - `operations` — hotels, transport, visa, portal
4. To allow ticket issuance: tick the "Can Issue Tickets" checkbox and set a ticketing PIN.
5. To deactivate a departing staff member: uncheck **Active**. Their records remain but they cannot log in.

---

## How to Check Pending Work at Any Time

| What to check | Where to look |
|---|---|
| Overdue follow-ups | CRM → Follow-ups |
| New portal registrations waiting for approval | Portal → Portal Users (filter: Pending) |
| Unread WhatsApp messages | WhatsApp → Inbox |
| Payment receipts not yet verified | Booking Inquiries (filter by payment status "uploaded") |
| Unpaid invoices | Accounting → Invoices (filter: unpaid or overdue) |
| Active campaign progress | Campaigns page |
| Flight bookings in progress | Flights → Quotations |

---

## What Staff Must Never Do

These are actions that bypass the system's safeguards. They can cause data loss, accounting errors, or compliance problems.

| Action | Why it must not happen |
|---|---|
| Issue a ticket without entering the ticketing PIN | The PIN confirms the right person is responsible for the issuance |
| Verify a payment receipt without viewing it | Verification is the only record that payment was actually received |
| Edit the database directly (bypassing the ERP screens) | Direct changes skip all business rules and can corrupt records |
| Send bulk WhatsApp messages directly from the phone (not through the ERP) | The ERP's delay system prevents the number from being banned. Sending manually risks permanently losing the business WhatsApp number |
| Approve a Party portal registration without checking their documents | DTS certificate and company registration are required for compliance |
| Create an invoice without linking it to a client or quotation | Unlinked invoices cannot be traced or reconciled |
| Share a ticketing PIN with another staff member | Each PIN is tied to one person. Sharing removes accountability if something goes wrong |
| Use flight search results without confirming GDS live mode is active | If GDS is not configured with live credentials, all results are test data that cannot be booked |

---

## What to Do If Something Goes Wrong

| Problem | What to do |
|---|---|
| WhatsApp shows "disconnected" | Go to WhatsApp Settings, scan the QR code with the office phone |
| Flight search results look wrong or prices are clearly fake | GDS is likely using test/mock data — ask your developer to check GDS settings |
| A campaign is stuck and won't stop | Click Stop on the Campaigns page. If it does not respond, contact your developer |
| A staff member cannot log in | Check their account is set to Active in the Users page |
| An invoice number was already used by another invoice | This can happen after a server restart — contact your developer to fix the invoice counter |
| A payment receipt expired incorrectly | Contact your developer to manually revert it, or record it through a manual workaround |
| A Portal user says they registered but cannot log in | Check their status in Portal → Portal Users. If "Pending Approval", approve them |
