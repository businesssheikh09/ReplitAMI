#!/usr/bin/env bash
# =============================================================================
# Test Data Cleanup — Al Musafir International ERP
#
# Removes obvious QA/smoke-test rows created during development/testing:
#   - Clients with test-pattern emails/names (e.g. *@test.com, *@example.com,
#     "RegTest-<ts>", names containing "smoke", or the literal "Test" client
#     used for validation testing)
#   - Hotel invoices with test DN numbers (TEST-REG*, REGDN*, REGRDN*)
#   - Known test user accounts created for password-flow testing
#     (forced@almusafir.com, force2@almusafir.com, pwtest@almusafir.com)
#
# Safety:
#   - Defaults to DRY RUN — only reports what matches, deletes nothing.
#   - Requires DATABASE_URL to be set (same one the app uses).
#   - A row is only deleted if it has ZERO related records in any other
#     table (quotations, invoices, vouchers, payments, etc). If a matched
#     test row has real activity attached to it, it is SKIPPED and reported
#     for manual review instead of being force-deleted.
#   - Only rows matching the explicit test patterns above are ever
#     considered. Real records are never touched.
#
# Usage:
#   bash scripts/src/cleanup-test-data.sh            # dry run (report only)
#   bash scripts/src/cleanup-test-data.sh --confirm  # actually delete
# =============================================================================

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

CONFIRM=0
if [ "${1:-}" == "--confirm" ]; then
  CONFIRM=1
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
log()  { echo -e "${BLUE}[INFO]${RESET} $*"; }
ok()   { echo -e "${GREEN}[OK]${RESET} $*"; }
warn() { echo -e "${YELLOW}[SKIP]${RESET} $*"; }
psql_q() { psql "$DATABASE_URL" -At -c "$1"; }

CLIENT_MATCH="email ILIKE '%@test.com' OR email ILIKE '%@example.com' OR name ILIKE '%smoke%' OR name ~ '^RegTest-[0-9]+\$' OR (name = 'Test' AND email IN ('not-an-email','ok@ok.com'))"
INVOICE_MATCH="dn_number LIKE 'TEST-REG%' OR dn_number LIKE 'REGDN%' OR dn_number LIKE 'REGRDN%'"
USER_MATCH="email IN ('forced@almusafir.com','force2@almusafir.com','pwtest@almusafir.com')"

echo -e "${BOLD}${BLUE}━━━ Test Data Cleanup — $( [ "$CONFIRM" = 1 ] && echo 'LIVE RUN' || echo 'DRY RUN' ) ━━━${RESET}"

# ── Clients ──────────────────────────────────────────────────────────────
log "Matching clients (test emails/names)..."
CLIENT_IDS=$(psql_q "SELECT id FROM clients WHERE $CLIENT_MATCH ORDER BY id;")
CLIENT_COUNT=$(echo "$CLIENT_IDS" | grep -c . || true)
log "Found $CLIENT_COUNT test client(s)."

DELETED_CLIENTS=0
SKIPPED_CLIENTS=0
for id in $CLIENT_IDS; do
  REFS=$(psql_q "
    SELECT
      (SELECT count(*) FROM client_notes WHERE client_id = $id) +
      (SELECT count(*) FROM documents WHERE client_id = $id) +
      (SELECT count(*) FROM flight_quotations WHERE client_id = $id) +
      (SELECT count(*) FROM follow_ups WHERE client_id = $id) +
      (SELECT count(*) FROM hotel_invoices WHERE party_id = $id) +
      (SELECT count(*) FROM hotel_requests WHERE client_id = $id) +
      (SELECT count(*) FROM invoices WHERE client_id = $id) +
      (SELECT count(*) FROM portal_users WHERE client_id = $id) +
      (SELECT count(*) FROM quotations WHERE client_id = $id) +
      (SELECT count(*) FROM transport_bookings WHERE client_id = $id) +
      (SELECT count(*) FROM visa_applications WHERE client_id = $id) +
      (SELECT count(*) FROM vouchers WHERE party_id = $id);
  ")
  NAME=$(psql_q "SELECT name || ' <' || email || '>' FROM clients WHERE id = $id;")
  if [ "$REFS" -eq 0 ]; then
    if [ "$CONFIRM" = 1 ]; then
      psql "$DATABASE_URL" -q -c "DELETE FROM clients WHERE id = $id;" >/dev/null
      ok "Deleted client #$id ($NAME)"
    else
      log "  Would delete client #$id ($NAME) — no related records"
    fi
    DELETED_CLIENTS=$((DELETED_CLIENTS+1))
  else
    warn "client #$id ($NAME) has $REFS related record(s) — left untouched, review manually"
    SKIPPED_CLIENTS=$((SKIPPED_CLIENTS+1))
  fi
done

# ── Hotel invoices ───────────────────────────────────────────────────────
log "Matching hotel invoices (test DN numbers)..."
INVOICE_IDS=$(psql_q "SELECT id FROM hotel_invoices WHERE $INVOICE_MATCH ORDER BY id;")
INVOICE_COUNT=$(echo "$INVOICE_IDS" | grep -c . || true)
log "Found $INVOICE_COUNT test hotel invoice(s)."

DELETED_INVOICES=0
SKIPPED_INVOICES=0
for id in $INVOICE_IDS; do
  REFS=$(psql_q "SELECT count(*) FROM vouchers WHERE hotel_invoice_id = $id;")
  DN=$(psql_q "SELECT dn_number FROM hotel_invoices WHERE id = $id;")
  if [ "$REFS" -eq 0 ]; then
    if [ "$CONFIRM" = 1 ]; then
      psql "$DATABASE_URL" -q -c "DELETE FROM hotel_invoices WHERE id = $id;" >/dev/null
      ok "Deleted hotel invoice #$id ($DN)"
    else
      log "  Would delete hotel invoice #$id ($DN) — no related records"
    fi
    DELETED_INVOICES=$((DELETED_INVOICES+1))
  else
    warn "hotel invoice #$id ($DN) has $REFS linked voucher(s) — left untouched, review manually"
    SKIPPED_INVOICES=$((SKIPPED_INVOICES+1))
  fi
done

# ── Users ────────────────────────────────────────────────────────────────
log "Matching known test user accounts..."
USER_IDS=$(psql_q "SELECT id FROM users WHERE $USER_MATCH ORDER BY id;")
USER_COUNT=$(echo "$USER_IDS" | grep -c . || true)
log "Found $USER_COUNT test user(s)."

DELETED_USERS=0
SKIPPED_USERS=0
for id in $USER_IDS; do
  REFS=$(psql_q "
    SELECT
      (SELECT count(*) FROM quotations WHERE created_by = $id) +
      (SELECT count(*) FROM vouchers WHERE created_by = $id) +
      (SELECT count(*) FROM financial_years WHERE created_by = $id) +
      (SELECT count(*) FROM client_notes WHERE created_by = $id) +
      (SELECT count(*) FROM clients WHERE assigned_to = $id) +
      (SELECT count(*) FROM flight_requests WHERE assigned_to = $id) +
      (SELECT count(*) FROM follow_ups WHERE assigned_to = $id) +
      (SELECT count(*) FROM visa_applications WHERE assigned_to = $id) +
      (SELECT count(*) FROM payments WHERE collected_by = $id) +
      (SELECT count(*) FROM hotel_invoices WHERE salesman_id = $id);
  ")
  EMAIL=$(psql_q "SELECT name || ' <' || email || '>' FROM users WHERE id = $id;")
  if [ "$REFS" -eq 0 ]; then
    if [ "$CONFIRM" = 1 ]; then
      psql "$DATABASE_URL" -q -c "DELETE FROM users WHERE id = $id;" >/dev/null
      ok "Deleted user #$id ($EMAIL)"
    else
      log "  Would delete user #$id ($EMAIL) — no related records"
    fi
    DELETED_USERS=$((DELETED_USERS+1))
  else
    warn "user #$id ($EMAIL) has $REFS related record(s) — left untouched, review manually"
    SKIPPED_USERS=$((SKIPPED_USERS+1))
  fi
done

echo
echo -e "${BOLD}${BLUE}━━━ Summary ━━━${RESET}"
echo "Clients:        $( [ "$CONFIRM" = 1 ] && echo "deleted $DELETED_CLIENTS" || echo "would delete $DELETED_CLIENTS" ), skipped $SKIPPED_CLIENTS"
echo "Hotel invoices: $( [ "$CONFIRM" = 1 ] && echo "deleted $DELETED_INVOICES" || echo "would delete $DELETED_INVOICES" ), skipped $SKIPPED_INVOICES"
echo "Users:          $( [ "$CONFIRM" = 1 ] && echo "deleted $DELETED_USERS" || echo "would delete $DELETED_USERS" ), skipped $SKIPPED_USERS"
if [ "$CONFIRM" = 0 ]; then
  echo
  echo "This was a dry run. Re-run with --confirm to actually delete the rows above."
fi
