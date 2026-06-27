# Bug Report Template

Copy this template when filing a bug. Fill in every section you can — partial reports slow down diagnosis.

---

## Title

_One-sentence summary. Example: "Flight request status update returns 500 when assignedTo is null"_

## Date

YYYY-MM-DD

## Reporter

Name / role of the person who found the bug.

## Affected Area

Check all that apply:

- [ ] ERP — Auth / Login
- [ ] ERP — CRM (clients, follow-ups)
- [ ] ERP — Quotations
- [ ] ERP — Flights (quotations)
- [ ] ERP — Flight Requests
- [ ] ERP — Group Tickets / Booking Inquiries
- [ ] ERP — Hotels / Hotel Invoices
- [ ] ERP — Transport
- [ ] ERP — Visa
- [ ] ERP — Accounting / Journal
- [ ] ERP — WhatsApp / Bot
- [ ] ERP — Portal Users
- [ ] ERP — GDS Settings
- [ ] ERP — Currency Settings
- [ ] ERP — Website Settings / AI Settings
- [ ] Public Website — Flights page
- [ ] Public Website — Package Inquiry
- [ ] Public Website — Book Flight
- [ ] Portal — Auth (register / login)
- [ ] Portal — Bookings
- [ ] API Server — specific route (fill below)
- [ ] Database / Schema
- [ ] Other: ___

## Steps to Reproduce

1. 
2. 
3. 

## Expected Result

_What should have happened._

## Actual Result

_What actually happened. Include error messages verbatim._

## Browser / Environment

- Browser + version (if frontend):
- OS:
- Device (desktop / mobile):
- Environment: `development` / `production`
- ERP user role (if applicable):

## Relevant API Route

```
METHOD /api/path/...
```

## Relevant DB Table(s)

```
table_name
```

## Console / Server Log Snippet

```
Paste the relevant portion of the browser console or server log here.
```

## Screenshot / Recording

_Attach if helpful._

## Proposed Fix (Optional)

_If you have a hypothesis about the root cause or a suggested fix, note it here._
