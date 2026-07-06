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

## Rule 2 — Build complete, immediately usable UIs — not stubs that need follow-up

When adding a feature (button, form, section):
- Include ALL fields that a user would reasonably expect to edit/interact with
- Every field that is displayed should also be editable if it makes business sense
- Do not leave read-only cards next to edit modals when inline editing is possible
- If a form only handles half the fields (e.g., edit quotation modal missing terms/notes), that is incomplete work

**Why:** The user has repeatedly had to ask for follow-up edits because the initial implementation was missing obvious fields or left data visible but not editable. Each follow-up costs additional messages and time.

**How to apply:** Before implementing any form or settings panel, list every field the user will see on that screen and make sure each one is editable where it should be. Ask: "Would a user expect to edit this?" If yes, include it in the first pass.
