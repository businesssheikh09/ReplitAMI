---
name: Payment Deadline Tiers
description: Dynamic payment deadline logic for group ticket bookings
---

Party accounts get a payment deadline based on hours until the flight:
- ≤ 24h until flight → 1h payment deadline
- 25–48h until flight → 3h payment deadline  
- 49–240h (10 days) until flight → 12h payment deadline
- > 240h until flight → 24h payment deadline

Implemented in `artifacts/api-server/src/services/deadline-calculator.ts`.

The `paymentReceiptsTable` stores `deadlineAt`, `deadlineTier`, `hoursUntilFlight`, `paymentStatus`.

`inventory-sweep.ts` runs every 10 minutes and marks expired receipts (`pending_receipt` where `deadlineAt < now()`) as `expired`.

**Why:** Mimics airline industry standard — tighter windows for late bookings to guarantee payment before seat release.
