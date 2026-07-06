---
name: Recurring build mistakes — Al Musafir ERP
description: Two classes of mistake that have repeatedly broken this project and cost the user time and money. Check these before finishing any task.
---

## Rule 1 — Cross-reference every new name against all existing consumers

When you rename a hook, route, component, endpoint, or export:
- Search the full codebase for the old name BEFORE finishing the task
- Verify the import in every file that used it still resolves
- New routes added to api-server/src/routes/index.ts must match the prefix used in every client call
- Generated hooks from `pnpm --filter @workspace/api-spec run codegen` may rename things; always check the generated file after codegen

**Why:** Several crashes were caused by adding a new route/hook and not updating one or more call sites — the page loads, then crashes on first use. User loses time and money debugging something that a 30-second grep would have caught.

**How to apply:** Before marking any task complete, run `grep -r "oldName" artifacts/ lib/` and confirm zero stale references remain.

---

## Rule 3 — Multi-dimension pricing: always derive quantity from all multipliers

When a service has more than one quantity dimension (hotel = rooms × nights, group transport = vehicles × trips), the parent form's `quantity` field MUST be the product of ALL dimensions — not just one. UI must:
- Auto-set `quantity = dim1 × dim2` whenever either changes
- Hide the raw Qty input for these service types (replace with read-only derived display)
- Show the breakdown in the table row (e.g. "2 rm × 2 nts") not just the raw product

**Why:** Hotel items with 2 rooms and 2 nights showed `total = unitPrice × 1` because `quantity` stayed at 1 even though metadata had `roomCount=2` and `nights=2`. The user noticed the wrong total.

**How to apply:** Before implementing any pricing form, list EVERY multiplier for that service type. Wire all of them into `onQuantityChange`. Pattern: `ServiceMetadataFields` receives `onQuantityChange?: (qty: number) => void` and fires it from every dimension's `onChange`.

---

## Rule 2 — Build complete, immediately usable UIs — not stubs that need follow-up

When adding a feature (button, form, section):
- Include ALL fields that a user would reasonably expect to edit/interact with
- Every field that is displayed should also be editable if it makes business sense
- Do not leave read-only cards next to edit modals when inline editing is possible
- If a form only handles half the fields (e.g., edit quotation modal missing terms/notes), that is incomplete work

**Why:** The user has repeatedly had to ask for follow-up edits because the initial implementation was missing obvious fields or left data visible but not editable. Each follow-up costs additional messages and time.

**How to apply:** Before implementing any form or settings panel, list every field the user will see on that screen and make sure each one is editable where it should be. Ask: "Would a user expect to edit this?" If yes, include it in the first pass.
