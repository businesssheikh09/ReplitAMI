---
name: Auto-derived fields pattern
description: When a form field's value can be calculated from other fields, wire the calculation into the source field's onChange — never leave derived fields as manual-only.
---

## Rule

When field C = f(A, B), update C automatically whenever A or B changes.

Do NOT rely on the user to manually fill C. A separate editable input for C is fine (let them override), but the auto-calculation must fire first.

**Why:** The user reported that entering check-in/check-out dates did not fill the Nights field. The fix was a 2-line calculation in the date onChange handlers. Without it, users double-enter data and make arithmetic mistakes.

## How to apply

- Hotel: nights = (checkOut - checkIn) in days. Recalculate in both checkIn and checkOut onChange. Allow manual override.
- Flight: if you have both departure and arrival dates, you can compute duration. Wire it.
- Any date range → duration field: always auto-calculate.
- Any quantity × unit price → total: always auto-calculate (already done in quotation items).

## Implementation pattern (React)

```ts
onChange={e => {
  const checkIn = e.target.value;
  const checkOut = v("checkOut");
  const next = { ...metadata, checkIn };
  if (checkIn && checkOut) {
    const diff = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
    if (diff > 0) next.nights = String(diff);
  }
  onChange(next);
}}
```

Update the whole metadata object in one shot — do not call onChange twice (once for the date, once for nights), that can cause stale closure bugs.
