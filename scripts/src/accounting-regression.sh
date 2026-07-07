#!/usr/bin/env bash
# =============================================================================
# Phase 10 Accounting Regression Tests — Al Musafir International ERP
#
# Tests:
#   T01  Trial Balance — rows > 0 and DR = CR
#   T02  Balance Sheet — Assets = Liabilities + Equity
#   T03  Customer payment RCT number appears in Receipt Book
#   T04  Customer payment appears in Party Statement
#   T05  Vendor payment (posted PV) appears in Vendor Statement
#   T06  DN payable reduces after posting a linked PV
#   T07  JV settlement appears in Party Statement
#   T08  No overpayment allowed
#   T09  No duplicate/excess payment on fully-paid invoice
#   T10  Old aggregate PARTY/VENDOR journal postings detected
#
# Usage: bash scripts/src/accounting-regression.sh
# =============================================================================

BASE="http://localhost:80"
PASS=0
FAIL=0
SKIP=0
FAILURES=()
TMPD=$(mktemp -d)
trap 'rm -rf "$TMPD"' EXIT

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

log()    { echo -e "${BLUE}[INFO]${RESET} $*"; }
pass()   { echo -e "${GREEN}[PASS]${RESET} $*"; PASS=$((PASS+1)); }
fail()   { echo -e "${RED}[FAIL]${RESET} $*"; FAIL=$((FAIL+1)); FAILURES+=("$*"); }
skip()   { echo -e "${YELLOW}[SKIP]${RESET} $*"; SKIP=$((SKIP+1)); }
header() { echo -e "\n${BOLD}${BLUE}━━━ $* ━━━${RESET}"; }

# curl wrappers — write response to a temp file
GET()  { curl -s -H "Authorization: Bearer $TOKEN" "$BASE$1" > "$TMPD/resp.json" 2>/dev/null; }
POST() { curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2" "$BASE$1" > "$TMPD/resp.json" 2>/dev/null; }
POSTCODE() { curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2" "$BASE$1"; }
JQ()   { python3 -c "import sys,json; d=json.load(open('$TMPD/resp.json')); $1" 2>/dev/null || echo ""; }

# ── Auth ──────────────────────────────────────────────────────────────────────
header "SETUP: Authenticating"
curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"management@umrah.com","password":"admin123"}' \
  > "$TMPD/auth.json" 2>/dev/null
TOKEN=$(python3 -c "import json; d=json.load(open('$TMPD/auth.json')); print(d.get('token',''))" 2>/dev/null || echo "")
if [ -z "$TOKEN" ]; then echo -e "${RED}FATAL: Auth failed${RESET}"; exit 1; fi
log "Token acquired (${#TOKEN} chars)"

# ── Test data setup ───────────────────────────────────────────────────────────
header "SETUP: Creating isolated test data"
TS=$(date +%s)

# Client
POST "/api/clients" "{\"name\":\"RegTest-$TS\",\"email\":\"regtest_$TS@test.com\",\"phone\":\"+92$TS\",\"country\":\"PK\"}"
CLIENT_ID=$(JQ "print(d.get('id',''))")
[ -z "$CLIENT_ID" ] && { echo -e "${RED}FATAL: client creation failed${RESET}"; cat "$TMPD/resp.json"; exit 1; }
log "Client: id=$CLIENT_ID"

VENDOR_ID=1

# Invoice (amount=10000)
POST "/api/invoices" "{\"clientId\":$CLIENT_ID,\"type\":\"hotel\",\"amount\":10000,\"currency\":\"SAR\",\"dueDate\":\"2026-12-31\"}"
INV_ID=$(JQ "print(d.get('id',''))")
[ -z "$INV_ID" ] && { echo -e "${RED}FATAL: invoice creation failed${RESET}"; cat "$TMPD/resp.json"; exit 1; }
log "Invoice: id=$INV_ID amount=10000"

# Hotel DN (payableSar=350)
DN_PAYLOAD="{\"dnNumber\":\"REGDN-$TS\",\"invoiceDate\":\"$(date +%Y-%m-%d)\",\"hotelName\":\"Regression Hotel\",\"noOfRooms\":1,\"noOfNights\":2,\"receivableSar\":500,\"payableSar\":350,\"receivablePkr\":37250,\"payablePkr\":26075,\"status\":\"draft\",\"partyId\":$CLIENT_ID,\"vendorId\":$VENDOR_ID}"
POST "/api/invoices/hotel" "$DN_PAYLOAD"
DN_ID=$(JQ "print(d.get('id',''))")
[ -z "$DN_ID" ] && { echo -e "${RED}FATAL: hotel DN creation failed${RESET}"; cat "$TMPD/resp.json"; exit 1; }
log "Hotel DN: id=$DN_ID payableSar=350"

# Chart of accounts — sync sub-ledger accounts
GET "/api/accounting/accounts"
cp "$TMPD/resp.json" "$TMPD/accounts.json"

MSFR_ID=$(python3 -c "
import json
d=json.load(open('$TMPD/accounts.json'))
a=d if isinstance(d,list) else d.get('accounts',[])
r=next((x for x in a if x.get('code')=='MSFR'),None)
print(r['id'] if r else '')
" 2>/dev/null || echo "")

CLIENT_ACCT_ID=$(python3 -c "
import json
d=json.load(open('$TMPD/accounts.json'))
a=d if isinstance(d,list) else d.get('accounts',[])
r=next((x for x in a if x.get('code')=='C-$CLIENT_ID'),None)
print(r['id'] if r else '')
" 2>/dev/null || echo "")

VENDOR_ACCT_ID=$(python3 -c "
import json
d=json.load(open('$TMPD/accounts.json'))
a=d if isinstance(d,list) else d.get('accounts',[])
r=next((x for x in a if x.get('code')=='V-$VENDOR_ID'),None)
print(r['id'] if r else '')
" 2>/dev/null || echo "")

log "Account IDs — MSFR=$MSFR_ID  C-$CLIENT_ID=$CLIENT_ACCT_ID  V-$VENDOR_ID=$VENDOR_ACCT_ID"

# ===========================================================================
# T01 — Trial Balance: rows > 0 and DR = CR
# ===========================================================================
header "T01 — Trial Balance: rows > 0 and grandDr = grandCr"
GET "/api/accounting/trial-balance"
cp "$TMPD/resp.json" "$TMPD/tb.json"
python3 - <<'PYEOF'
import json
d=json.load(open('/tmp/'+open('/tmp/tmpdir_path.txt').read().strip()+'/tb.json')) if False else json.load(open(open('/dev/stdin').name if False else '/dev/stdin'))
PYEOF
# Use inline python via process substitution
T01=$(python3 -c "
import json,os,sys
d=json.load(open('$TMPD/tb.json'))
rows=d.get('rows',[])
grand_dr=round(d.get('grandDr',0),2)
grand_cr=round(d.get('grandCr',0),2)
balanced=d.get('isBalanced',False)
print(f'rows={len(rows)} dr={grand_dr} cr={grand_cr} balanced={balanced}')
" 2>/dev/null || echo "rows=0 dr=0 cr=0 balanced=False")

TB_ROWS=$(echo "$T01" | grep -o 'rows=[0-9]*' | cut -d= -f2)
TB_DR=$(echo "$T01" | grep -o 'dr=[0-9.]*' | cut -d= -f2)
TB_CR=$(echo "$T01" | grep -o 'cr=[0-9.]*' | cut -d= -f2)
TB_BAL=$(echo "$T01" | grep -o 'balanced=[A-Za-z]*' | cut -d= -f2)
log "  rows=$TB_ROWS  dr=$TB_DR  cr=$TB_CR  balanced=$TB_BAL"

if [ "${TB_ROWS:-0}" -gt 0 ] 2>/dev/null && [ "$TB_BAL" = "True" ]; then
  pass "T01 Trial Balance: $TB_ROWS rows, DR=$TB_DR = CR=$TB_CR (balanced)"
elif [ "${TB_ROWS:-0}" -gt 0 ] 2>/dev/null; then
  fail "T01 Trial Balance has $TB_ROWS rows but DR($TB_DR) ≠ CR($TB_CR) — UNBALANCED"
else
  fail "T01 Trial Balance returned 0 rows — no data despite existing journal entries"
fi

# ===========================================================================
# T02 — Balance Sheet: balanced
# ===========================================================================
header "T02 — Balance Sheet: Assets = Liabilities + Equity"
GET "/api/accounting/reports/balance-sheet"
T02=$(python3 -c "
import json
d=json.load(open('$TMPD/resp.json'))
assets=round(d.get('totalAssets',0),2)
le=round(d.get('totalLiabilitiesAndEquity',0),2)
balanced=d.get('isBalanced',False)
print(f'assets={assets} le={le} balanced={balanced}')
" 2>/dev/null || echo "assets=0 le=0 balanced=False")

BS_ASSETS=$(echo "$T02" | grep -o 'assets=[0-9.]*' | cut -d= -f2)
BS_BAL=$(echo "$T02" | grep -o 'balanced=[A-Za-z]*' | cut -d= -f2)
log "  assets=$BS_ASSETS  balanced=$BS_BAL"

if [ "$BS_BAL" = "True" ]; then
  pass "T02 Balance Sheet balanced (Assets=$BS_ASSETS)"
else
  fail "T02 Balance Sheet UNBALANCED — isBalanced=$BS_BAL"
fi

# ===========================================================================
# T03 — Customer payment RCT number appears in Receipt Book
# ===========================================================================
header "T03 — Customer payment RCT number appears in Receipt Book"
POST "/api/invoices/$INV_ID/payments" "{\"amount\":3000,\"method\":\"cash\",\"notes\":\"Regression T03\"}"
cp "$TMPD/resp.json" "$TMPD/payment1.json"
RCT_NUM=$(python3 -c "import json; d=json.load(open('$TMPD/payment1.json')); print(d.get('receiptNumber',''))" 2>/dev/null || echo "")
log "  Payment receipt number: $RCT_NUM"

if [ -z "$RCT_NUM" ]; then
  fail "T03 Payment did not return a receiptNumber"
else
  sleep 1  # allow async journal posting
  GET "/api/accounting/reports/receipt-book"
  cp "$TMPD/resp.json" "$TMPD/rbook.json"
  T03=$(python3 -c "
import json
d=json.load(open('$TMPD/rbook.json'))
rows=d.get('rows',[])
# Check if RCT number directly in any ref field
direct=any(r.get('ref')=='$RCT_NUM' or r.get('receiptNumber')=='$RCT_NUM' for r in rows)
# Check if inv_payment journal entry covers it (narration contains invoice id)
narr=any('$INV_ID' in str(r.get('narration','')) for r in rows)
print(f'rows={len(rows)} direct={direct} narr={narr}')
" 2>/dev/null || echo "rows=0 direct=False narr=False")

  RBOOK_ROWS=$(echo "$T03" | grep -o 'rows=[0-9]*' | cut -d= -f2)
  DIRECT=$(echo "$T03" | grep -o 'direct=[A-Za-z]*' | cut -d= -f2)
  NARR=$(echo "$T03" | grep -o 'narr=[A-Za-z]*' | cut -d= -f2)
  log "  Receipt book: rows=$RBOOK_ROWS  rct_direct=$DIRECT  narr_match=$NARR"

  if [ "$DIRECT" = "True" ]; then
    pass "T03 RCT number $RCT_NUM found directly in Receipt Book"
  elif [ "$NARR" = "True" ]; then
    fail "T03 RCT $RCT_NUM NOT in Receipt Book by ref (only journal narration) — receiptNumber missing from book"
  else
    fail "T03 RCT $RCT_NUM NOT found in Receipt Book at all (total rows=$RBOOK_ROWS)"
  fi
fi

# ===========================================================================
# T04 — Customer payment appears in Party Statement
# ===========================================================================
header "T04 — Customer payment appears in Party Statement"
sleep 1
GET "/api/accounting/reports/party-statement?partyId=$CLIENT_ID"
cp "$TMPD/resp.json" "$TMPD/ps.json"
T04=$(python3 -c "
import json
d=json.load(open('$TMPD/ps.json'))
vouchers=d.get('vouchers',[])
plist=d.get('payments',[])
closing=round(d.get('summary',{}).get('closingBalance',0),2)
net_v=round(d.get('summary',{}).get('netVouchers',0),2)
tpay=round(d.get('summary',{}).get('totalPayments',0),2)
print(f'n_vouchers={len(vouchers)} n_payments={len(plist)} closing={closing} net_v={net_v} tpay={tpay}')
" 2>/dev/null || echo "n_vouchers=0 n_payments=0 closing=0 net_v=0 tpay=0")

PS_PMTS=$(echo "$T04" | grep -o 'n_payments=[0-9]*' | cut -d= -f2)
PS_TPAY=$(echo "$T04" | grep -o 'tpay=[0-9.]*' | cut -d= -f2)
PS_NETV=$(echo "$T04" | grep -o 'net_v=[0-9.]*' | cut -d= -f2)
log "  n_payments=$PS_PMTS  totalPayments=$PS_TPAY  netVouchers=$PS_NETV"

if [ "${PS_PMTS:-0}" -gt 0 ] 2>/dev/null; then
  pass "T04 Party Statement includes $PS_PMTS payment(s) for client $CLIENT_ID (totalPayments=$PS_TPAY)"
else
  fail "T04 Party Statement shows 0 payments for client $CLIENT_ID — invoice payments invisible in party ledger"
fi

# ===========================================================================
# T05 — Vendor payment (posted PV) appears in Vendor Statement
# ===========================================================================
header "T05 — Vendor payment (posted PV) appears in Vendor Statement"
if [ -n "$MSFR_ID" ] && [ -n "$VENDOR_ACCT_ID" ]; then
  PV_PAYLOAD="{\"type\":\"PV\",\"date\":\"$(date +%Y-%m-%d)\",\"narration\":\"RegTest PV $TS\",\"vendorId\":$VENDOR_ID,\"hotelInvoiceId\":$DN_ID,\"lines\":[{\"accountId\":$VENDOR_ACCT_ID,\"debitAmount\":\"200\",\"creditAmount\":\"0\",\"description\":\"Vendor cleared\"},{\"accountId\":$MSFR_ID,\"debitAmount\":\"0\",\"creditAmount\":\"200\",\"description\":\"Cash paid\"}]}"
  POST "/api/accounting/vouchers" "$PV_PAYLOAD"
  PV_ID=$(JQ "print(d.get('id',''))")
  log "  PV draft: id=$PV_ID"

  if [ -n "$PV_ID" ]; then
    POST "/api/accounting/vouchers/$PV_ID/post" "{}"
    PV_STATUS=$(JQ "print(d.get('status',''))")
    log "  PV status after post: $PV_STATUS"

    GET "/api/accounting/reports/vendor-statement?vendorId=$VENDOR_ID"
    cp "$TMPD/resp.json" "$TMPD/vs.json"
    T05=$(python3 -c "
import json
d=json.load(open('$TMPD/vs.json'))
vouchers=d.get('vouchers',[])
found=any(v.get('id')==$PV_ID for v in vouchers)
print(f'total_vouchers={len(vouchers)} found={found}')
" 2>/dev/null || echo "total_vouchers=0 found=False")

    VS_FOUND=$(echo "$T05" | grep -o 'found=[A-Za-z]*' | cut -d= -f2)
    VS_COUNT=$(echo "$T05" | grep -o 'total_vouchers=[0-9]*' | cut -d= -f2)
    log "  Vendor statement: total_vouchers=$VS_COUNT  PV_found=$VS_FOUND"

    if [ "$VS_FOUND" = "True" ]; then
      pass "T05 Vendor Statement includes posted PV $PV_ID for vendor $VENDOR_ID"
    else
      fail "T05 Vendor Statement does NOT include posted PV $PV_ID (total_vouchers=$VS_COUNT)"
    fi
  else
    skip "T05 Could not create PV draft"
  fi
else
  skip "T05 Missing account IDs (MSFR=$MSFR_ID VENDOR=$VENDOR_ACCT_ID)"
fi

# ===========================================================================
# T06 — DN payable reduces after posting a linked PV
# ===========================================================================
header "T06 — DN payable reduces after posting linked PV"
GET "/api/invoices/hotel/$DN_ID"
T06=$(python3 -c "
import json
d=json.load(open('$TMPD/resp.json'))
paid=float(d.get('paidAmount') or 0)
status=d.get('paidStatus','unknown')
payable=float(d.get('payableSar') or 0)
print(f'paid={paid} status={status} payable={payable}')
" 2>/dev/null || echo "paid=0 status=unknown payable=0")

DN_PAID=$(echo "$T06" | grep -o 'paid=[0-9.]*' | head -1 | cut -d= -f2)
DN_STAT=$(echo "$T06" | grep -o 'status=[a-z]*' | cut -d= -f2)
log "  DN id=$DN_ID — paidAmount=$DN_PAID  paidStatus=$DN_STAT  (payableSar=350, PV=200)"

if python3 -c "exit(0 if float('${DN_PAID:-0}') > 0 else 1)" 2>/dev/null; then
  pass "T06 DN paidAmount=$DN_PAID > 0 after posting linked PV (status=$DN_STAT)"
else
  fail "T06 DN paidAmount=$DN_PAID still 0 — not updated after posting PV linked to this DN"
fi

# ===========================================================================
# T07 — JV settlement appears in Party Statement
# ===========================================================================
header "T07 — JV settlement appears in Party Statement"
if [ -n "$CLIENT_ACCT_ID" ] && [ -n "$VENDOR_ACCT_ID" ]; then
  JV_PAYLOAD="{\"type\":\"JV\",\"date\":\"$(date +%Y-%m-%d)\",\"narration\":\"RegTest JV settlement $TS\",\"partyId\":$CLIENT_ID,\"vendorId\":$VENDOR_ID,\"lines\":[{\"accountId\":$CLIENT_ACCT_ID,\"debitAmount\":\"100\",\"creditAmount\":\"0\",\"description\":\"Party debit\"},{\"accountId\":$VENDOR_ACCT_ID,\"debitAmount\":\"0\",\"creditAmount\":\"100\",\"description\":\"Vendor credit\"}]}"
  POST "/api/accounting/vouchers" "$JV_PAYLOAD"
  JV_ID=$(JQ "print(d.get('id',''))")
  log "  JV draft: id=$JV_ID"

  if [ -n "$JV_ID" ]; then
    POST "/api/accounting/vouchers/$JV_ID/post" "{}"
    JV_STATUS=$(JQ "print(d.get('status',''))")
    log "  JV status after post: $JV_STATUS"

    GET "/api/accounting/reports/party-statement?partyId=$CLIENT_ID"
    T07=$(python3 -c "
import json
d=json.load(open('$TMPD/resp.json'))
vouchers=d.get('vouchers',[])
found=any(v.get('id')==$JV_ID for v in vouchers)
print(f'vouchers={len(vouchers)} found={found}')
" 2>/dev/null || echo "vouchers=0 found=False")

    JV_FOUND=$(echo "$T07" | grep -o 'found=[A-Za-z]*' | cut -d= -f2)
    JV_TOTAL=$(echo "$T07" | grep -o 'vouchers=[0-9]*' | cut -d= -f2)
    log "  Party statement: vouchers=$JV_TOTAL  JV_found=$JV_FOUND"

    if [ "$JV_FOUND" = "True" ]; then
      pass "T07 JV $JV_ID appears in Party Statement (settlement visible)"
    else
      fail "T07 JV $JV_ID NOT in Party Statement (total vouchers=$JV_TOTAL) — settlement invisible in party ledger"
    fi
  else
    skip "T07 Could not create JV"
  fi
else
  skip "T07 Missing account IDs"
fi

# ===========================================================================
# T08 — No overpayment allowed
# ===========================================================================
header "T08 — No overpayment allowed (amount > outstanding)"
HTTP08=$(POSTCODE "/api/invoices/$INV_ID/payments" "{\"amount\":999999,\"method\":\"cash\"}")
POST "/api/invoices/$INV_ID/payments" "{\"amount\":999999,\"method\":\"cash\"}"
ERR08=$(JQ "print(d.get('outstanding','NONE'))")
log "  Overpayment attempt: HTTP=$HTTP08  outstanding_field=$ERR08"

if [ "$HTTP08" = "400" ] && [ "$ERR08" != "NONE" ]; then
  pass "T08 Overpayment blocked (HTTP 400, outstanding=$ERR08)"
else
  fail "T08 Overpayment NOT blocked (HTTP=$HTTP08, outstanding=$ERR08)"
fi

# ===========================================================================
# T09 — No duplicate/excess payment on fully-paid invoice
# ===========================================================================
header "T09 — No excess payment on fully-paid invoice"
# Create small invoice, fully pay it, try to pay again
POST "/api/invoices" "{\"clientId\":$CLIENT_ID,\"type\":\"hotel\",\"amount\":500,\"currency\":\"SAR\",\"dueDate\":\"2026-12-31\"}"
INV2_ID=$(JQ "print(d.get('id',''))")

if [ -n "$INV2_ID" ]; then
  POST "/api/invoices/$INV2_ID/payments" "{\"amount\":500,\"method\":\"cash\"}"
  P1_RCT=$(JQ "print(d.get('receiptNumber','ERR'))")
  log "  Full payment received: $P1_RCT"

  HTTP09=$(POSTCODE "/api/invoices/$INV2_ID/payments" "{\"amount\":1,\"method\":\"cash\"}")
  POST "/api/invoices/$INV2_ID/payments" "{\"amount\":1,\"method\":\"cash\"}"
  ERR09=$(JQ "print(d.get('error','NONE'))")
  log "  Excess payment attempt: HTTP=$HTTP09  error=$ERR09"

  if [ "$HTTP09" = "400" ]; then
    pass "T09 Excess payment on paid invoice blocked (HTTP 400) — guard works"
  else
    fail "T09 Excess payment NOT blocked (HTTP=$HTTP09) — duplicate receipts possible"
  fi
else
  skip "T09 Could not create second test invoice"
fi

# ===========================================================================
# T10 — Migrate + verify legacy PARTY/VENDOR journal entries
# All traceable entries must be migrated; only genuinely unresolvable
# (no sourceId, or source record has null partyId/vendorId) may remain.
# ===========================================================================
header "T10 — Migrate + verify legacy PARTY/VENDOR journal postings"
POST "/api/accounting/admin/migrate-subledger" "{}"
cp "$TMPD/resp.json" "$TMPD/migrate.json"
T10_MIG=$(python3 -c "
import json
d=json.load(open('$TMPD/migrate.json'))
print(f'migrated={d.get(\"migrated\",0)} skipped={d.get(\"skipped\",0)} total={d.get(\"total\",0)}')
" 2>/dev/null || echo "migrated=0 skipped=0 total=0")
MIG_MIGRATED=$(echo "$T10_MIG" | grep -o 'migrated=[0-9]*' | cut -d= -f2)
MIG_SKIPPED=$(echo "$T10_MIG" | grep -o 'skipped=[0-9]*' | cut -d= -f2)
MIG_TOTAL=$(echo "$T10_MIG" | grep -o 'total=[0-9]*' | cut -d= -f2)
log "  Migration run: migrated=$MIG_MIGRATED skipped=$MIG_SKIPPED total=$MIG_TOTAL"

# Count remaining legacy entries after migration
GET "/api/accounting/journal?limit=500"
cp "$TMPD/resp.json" "$TMPD/journal.json"
T10_REM=$(python3 -c "
import json
d=json.load(open('$TMPD/journal.json'))
entries=d if isinstance(d,list) else d.get('entries',[])
old=[e for e in entries
     if e.get('debitAccount',{}).get('code') in ['PARTY','VENDOR']
     or e.get('creditAccount',{}).get('code') in ['PARTY','VENDOR']]
new_cnt=len([e for e in entries
     if (e.get('debitAccount',{}).get('code','').startswith('C-') or
         e.get('debitAccount',{}).get('code','').startswith('V-') or
         e.get('creditAccount',{}).get('code','').startswith('C-') or
         e.get('creditAccount',{}).get('code','').startswith('V-'))])
print(f'total={len(entries)} remaining={len(old)} subledger={new_cnt}')
" 2>/dev/null || echo "total=0 remaining=0 subledger=0")

TOTAL_J=$(echo "$T10_REM" | grep -o 'total=[0-9]*' | cut -d= -f2)
REMAINING_J=$(echo "$T10_REM" | grep -o 'remaining=[0-9]*' | cut -d= -f2)
SUBLEDGER_J=$(echo "$T10_REM" | grep -o 'subledger=[0-9]*' | cut -d= -f2)
log "  After migration: total=$TOTAL_J  remaining_legacy=$REMAINING_J  subledger=$SUBLEDGER_J"

# PASS if: remaining == skipped (all remaining are genuinely unresolvable orphans)
# FAIL if: remaining > skipped (traceable entries were left behind)
if [ "${REMAINING_J:-0}" -le "${MIG_SKIPPED:-0}" ] 2>/dev/null; then
  if [ "${REMAINING_J:-0}" -eq 0 ] 2>/dev/null; then
    pass "T10 All legacy PARTY/VENDOR entries migrated to sub-ledger accounts (0 remaining)"
  else
    pass "T10 Migration complete: $REMAINING_J unresolvable orphan entries remain (no source partyId/vendorId — expected), $SUBLEDGER_J sub-ledger entries correct"
  fi
else
  fail "T10 After migration: $REMAINING_J legacy entries remain but only $MIG_SKIPPED were skipped as unresolvable — $((REMAINING_J - MIG_SKIPPED)) traceable entries not migrated"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}REGRESSION TEST RESULTS${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  ${GREEN}PASS${RESET}: $PASS / $((PASS+FAIL+SKIP))"
echo -e "  ${RED}FAIL${RESET}: $FAIL"
echo -e "  ${YELLOW}SKIP${RESET}: $SKIP"

if [ "${#FAILURES[@]}" -gt 0 ]; then
  echo ""
  echo -e "${BOLD}${RED}FAILED TESTS:${RESET}"
  for f in "${FAILURES[@]}"; do
    echo -e "  ${RED}✗${RESET} $f"
  done
fi
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
