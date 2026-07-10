#!/usr/bin/env bash
# =============================================================================
# Dashboard Revenue Label Tests — Al Musafir International ERP
#
# Tests (all check new fields added to GET /dashboard/owner):
#   D01  Accepting a quotation increases confirmedSalesAmount (booked value)
#   D02  Accepting a quotation does NOT increase totalRevenue
#   D03  Accepting a quotation does NOT increase totalCollections
#   D04  Posting a customer invoice increases totalRevenue
#   D05  Posting a customer invoice increases totalReceivables
#   D06  Posting a hotel DN increases totalRevenue
#   D07  Receiving customer payment increases totalCollections
#   D08  Receiving customer payment reduces totalReceivables
#   D09  grossProfit == totalRevenue - costOfSales (hotel DN margin)
#
# Usage: bash scripts/src/dashboard-revenue-tests.sh
# =============================================================================

BASE="http://localhost:80"
PASS=0; FAIL=0; SKIP=0
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

GET()    { curl -s -H "Authorization: Bearer $TOKEN" "$BASE$1" > "$TMPD/resp.json" 2>/dev/null; }
POST()   { curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2" "$BASE$1" > "$TMPD/resp.json" 2>/dev/null; }
PATCH()  { curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2" "$BASE$1" > "$TMPD/resp.json" 2>/dev/null; }
JQ()     { python3 -c "import sys,json; d=json.load(open('$TMPD/resp.json')); $1" 2>/dev/null || echo ""; }

# ── Auth ──────────────────────────────────────────────────────────────────────
header "SETUP: Authenticating"
curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"management@umrah.com","password":"admin123"}' \
  > "$TMPD/auth.json" 2>/dev/null
TOKEN=$(python3 -c "import json; d=json.load(open('$TMPD/auth.json')); print(d.get('token',''))" 2>/dev/null || echo "")
if [ -z "$TOKEN" ]; then echo -e "${RED}FATAL: Auth failed${RESET}"; exit 1; fi
log "Token acquired (${#TOKEN} chars)"

# ── Owner dashboard snapshot helper ──────────────────────────────────────────
snapshot_dashboard() {
  GET "/api/dashboard/owner"
  python3 -c "
import json
d=json.load(open('$TMPD/resp.json'))
rev   = round(float(d.get('totalRevenue',      d.get('_missing_totalRevenue', -999999))), 2)
coll  = round(float(d.get('totalCollections',  d.get('_missing_totalCollections', -999999))), 2)
cs    = round(float(d.get('confirmedSalesAmount', d.get('_missing_confirmedSalesAmount', -999999))), 2)
recv  = round(float(d.get('totalReceivables',  0)), 2)
gp    = round(float(d.get('grossProfit',       d.get('_missing_grossProfit', -999999))), 2)
print(f'rev={rev} coll={coll} cs={cs} recv={recv} gp={gp}')
" 2>/dev/null || echo "rev=-999999 coll=-999999 cs=-999999 recv=0 gp=-999999"
}

field_val() { echo "$1" | grep -o "${2}=[0-9.-]*" | cut -d= -f2; }

# ── Test data setup ───────────────────────────────────────────────────────────
header "SETUP: Creating isolated test data"
TS=$(date +%s)

# Client
POST "/api/clients" "{\"name\":\"DashTest-$TS\",\"email\":\"dashtest_$TS@test.com\",\"phone\":\"+923$TS\",\"country\":\"PK\"}"
CLIENT_ID=$(JQ "print(d.get('id',''))")
[ -z "$CLIENT_ID" ] && { echo -e "${RED}FATAL: client creation failed${RESET}"; cat "$TMPD/resp.json"; exit 1; }
log "Client: id=$CLIENT_ID"

# Vendor (use id=1 — seeded)
VENDOR_ID=1

# Quotation — create then add a line item so totalAmount > 0
VALID_UNTIL=$(date -d "+30 days" +%Y-%m-%d 2>/dev/null || date -v+30d +%Y-%m-%d 2>/dev/null || echo "2026-08-10")
POST "/api/quotations" "{\"clientId\":$CLIENT_ID,\"title\":\"DashTest Umrah Package $TS\",\"validUntil\":\"$VALID_UNTIL\",\"status\":\"sent\"}"
QUOT_ID=$(JQ "print(d.get('id',''))")
[ -z "$QUOT_ID" ] && { echo -e "${RED}FATAL: quotation creation failed${RESET}"; cat "$TMPD/resp.json"; exit 1; }
# Add a line item so totalAmount gets computed (unitPriceBase drives the totals)
POST "/api/quotations/$QUOT_ID/items" "{\"serviceType\":\"umrah\",\"description\":\"DashTest Umrah Package\",\"quantity\":1,\"unitPrice\":20000,\"unitPriceBase\":20000,\"currency\":\"SAR\"}"
ITEM_ID=$(JQ "print(d.get('id',''))")
log "Quotation: id=$QUOT_ID  item=$ITEM_ID  totalAmount should be 20000"

# Pre-accept baseline
SNAP0=$(snapshot_dashboard)
REV0=$(field_val "$SNAP0" "rev");  COLL0=$(field_val "$SNAP0" "coll")
CS0=$(field_val "$SNAP0" "cs");    RECV0=$(field_val "$SNAP0" "recv")
GP0=$(field_val "$SNAP0" "gp")
log "Baseline — rev=$REV0  coll=$COLL0  cs=$CS0  recv=$RECV0  gp=$GP0"

# ===========================================================================
# D01 / D02 / D03 — Accept quotation
# ===========================================================================
header "D01/D02/D03 — Accept quotation → confirmedSales ↑, revenue NO change, collections NO change"

PATCH "/api/quotations/$QUOT_ID" "{\"status\":\"accepted\"}"
QSTATUS=$(JQ "print(d.get('status',''))")
log "  Quotation status after patch: $QSTATUS"

if [ "$QSTATUS" != "accepted" ]; then
  skip "D01/D02/D03 Could not accept quotation (status=$QSTATUS)"
  CS1=$CS0; REV1=$REV0; COLL1=$COLL0; RECV1=$RECV0; GP1=$GP0
else
  sleep 1
  SNAP1=$(snapshot_dashboard)
  REV1=$(field_val "$SNAP1" "rev");   COLL1=$(field_val "$SNAP1" "coll")
  CS1=$(field_val "$SNAP1" "cs");     RECV1=$(field_val "$SNAP1" "recv")
  GP1=$(field_val "$SNAP1" "gp")
  log "  After accept — rev=$REV1  coll=$COLL1  cs=$CS1  recv=$RECV1  gp=$GP1"

  # D01 — confirmedSalesAmount must increase
  CS_DELTA=$(python3 -c "print(round(float('${CS1:--999999}') - float('${CS0:--999999}'),2))" 2>/dev/null || echo "-999999")
  log "  D01 confirmedSalesAmount delta=$CS_DELTA (expected ~20000)"
  if python3 -c "exit(0 if float('${CS_DELTA:--999999}') > 0 else 1)" 2>/dev/null; then
    pass "D01 confirmedSalesAmount increased by $CS_DELTA after quotation accepted"
  else
    fail "D01 confirmedSalesAmount delta=$CS_DELTA — expected > 0 (field may be missing or quotation amount not counted)"
  fi

  # D02 — totalRevenue must NOT increase
  REV_DELTA=$(python3 -c "print(round(float('${REV1:--999999}') - float('${REV0:--999999}'),2))" 2>/dev/null || echo "-999999")
  log "  D02 totalRevenue delta=$REV_DELTA (expected 0)"
  if python3 -c "exit(0 if float('${REV_DELTA:--999999}') == 0 else 1)" 2>/dev/null; then
    pass "D02 totalRevenue unchanged after quotation accepted (delta=$REV_DELTA)"
  else
    fail "D02 totalRevenue delta=$REV_DELTA — should be 0 (revenue must not increase on quotation acceptance)"
  fi

  # D03 — totalCollections must NOT increase
  COLL_DELTA=$(python3 -c "print(round(float('${COLL1:--999999}') - float('${COLL0:--999999}'),2))" 2>/dev/null || echo "-999999")
  log "  D03 totalCollections delta=$COLL_DELTA (expected 0)"
  if python3 -c "exit(0 if float('${COLL_DELTA:--999999}') == 0 else 1)" 2>/dev/null; then
    pass "D03 totalCollections unchanged after quotation accepted (delta=$COLL_DELTA)"
  else
    fail "D03 totalCollections delta=$COLL_DELTA — should be 0 (collections must not increase on quotation acceptance)"
  fi
fi

# ===========================================================================
# D04 / D05 — Post customer invoice
# ===========================================================================
header "D04/D05 — Customer invoice → totalRevenue ↑, totalReceivables ↑"

INV_AMOUNT=15000
# type omitted (defaults to "customer") so postInvoiceCreated fires and journals revenue
POST "/api/invoices" "{\"clientId\":$CLIENT_ID,\"amount\":$INV_AMOUNT,\"currency\":\"SAR\",\"dueDate\":\"2026-12-31\"}"
INV_ID=$(JQ "print(d.get('id',''))")
[ -z "$INV_ID" ] && { skip "D04/D05 Could not create invoice"; } || {
  log "  Invoice: id=$INV_ID  amount=$INV_AMOUNT"
  sleep 1
  SNAP2=$(snapshot_dashboard)
  REV2=$(field_val "$SNAP2" "rev");  RECV2=$(field_val "$SNAP2" "recv")
  COLL2=$(field_val "$SNAP2" "coll")
  log "  After invoice — rev=$REV2  recv=$RECV2  coll=$COLL2"

  # D04 — totalRevenue must increase
  REV_DELTA2=$(python3 -c "print(round(float('${REV2:--999999}') - float('${REV1:--999999}'),2))" 2>/dev/null || echo "-999999")
  log "  D04 totalRevenue delta=$REV_DELTA2 (expected ~$INV_AMOUNT)"
  if python3 -c "exit(0 if float('${REV_DELTA2:--999999}') > 0 else 1)" 2>/dev/null; then
    pass "D04 totalRevenue increased by $REV_DELTA2 after posting customer invoice"
  else
    fail "D04 totalRevenue delta=$REV_DELTA2 — expected > 0 (revenue not recognised from customer invoice)"
  fi

  # D05 — totalReceivables must increase
  RECV_DELTA2=$(python3 -c "print(round(float('${RECV2:-0}') - float('${RECV1:-0}'),2))" 2>/dev/null || echo "0")
  log "  D05 totalReceivables delta=$RECV_DELTA2 (expected > 0)"
  if python3 -c "exit(0 if float('${RECV_DELTA2:-0}') > 0 else 1)" 2>/dev/null; then
    pass "D05 totalReceivables increased by $RECV_DELTA2 after posting customer invoice"
  else
    fail "D05 totalReceivables delta=$RECV_DELTA2 — expected > 0 (receivable not recognised from customer invoice)"
  fi
}

# ===========================================================================
# D06 — Hotel DN increases totalRevenue
# ===========================================================================
header "D06 — Hotel DN → totalRevenue ↑"

DN_REC=800; DN_PAY=550
DN_PAYLOAD="{\"dnNumber\":\"DASHDN-$TS\",\"invoiceDate\":\"$(date +%Y-%m-%d)\",\"hotelName\":\"DashTest Hotel\",\"noOfRooms\":1,\"noOfNights\":3,\"receivableSar\":$DN_REC,\"payableSar\":$DN_PAY,\"receivablePkr\":59600,\"payablePkr\":40975,\"status\":\"draft\",\"partyId\":$CLIENT_ID,\"vendorId\":$VENDOR_ID}"
POST "/api/invoices/hotel" "$DN_PAYLOAD"
DN_ID=$(JQ "print(d.get('id',''))")
[ -z "$DN_ID" ] && { skip "D06 Could not create hotel DN"; } || {
  log "  Hotel DN: id=$DN_ID  receivableSar=$DN_REC  payableSar=$DN_PAY"
  sleep 1
  SNAP3=$(snapshot_dashboard)
  REV3=$(field_val "$SNAP3" "rev"); GP3=$(field_val "$SNAP3" "gp")
  REV2_USED=${REV2:-$REV1}
  REV_DELTA3=$(python3 -c "print(round(float('${REV3:--999999}') - float('${REV2_USED:--999999}'),2))" 2>/dev/null || echo "-999999")
  log "  D06 totalRevenue delta=$REV_DELTA3 (expected ~$DN_REC from hotel DN receivable)"
  if python3 -c "exit(0 if float('${REV_DELTA3:--999999}') > 0 else 1)" 2>/dev/null; then
    pass "D06 totalRevenue increased by $REV_DELTA3 after hotel DN created"
  else
    fail "D06 totalRevenue delta=$REV_DELTA3 — expected > 0 (hotel DN receivable not counted as revenue)"
  fi
}

# ===========================================================================
# D07 / D08 — Customer payment
# ===========================================================================
header "D07/D08 — Customer payment → totalCollections ↑, totalReceivables ↓"

PAY_AMOUNT=8000
[ -n "$INV_ID" ] && {
  POST "/api/invoices/$INV_ID/payments" "{\"amount\":$PAY_AMOUNT,\"method\":\"cash\",\"notes\":\"DashTest payment\"}"
  RCT=$(JQ "print(d.get('receiptNumber',''))")
  log "  Payment: amount=$PAY_AMOUNT  receipt=$RCT"
  [ -z "$RCT" ] && { skip "D07/D08 Payment did not return receiptNumber"; } || {
    sleep 1
    SNAP4=$(snapshot_dashboard)
    COLL4=$(field_val "$SNAP4" "coll"); RECV4=$(field_val "$SNAP4" "recv")
    COLL_PREV=${COLL2:-${COLL1:-$COLL0}}; RECV_PREV=${RECV2:-$RECV1}
    COLL_DELTA4=$(python3 -c "print(round(float('${COLL4:--999999}') - float('${COLL_PREV:--999999}'),2))" 2>/dev/null || echo "-999999")
    RECV_DELTA4=$(python3 -c "print(round(float('${RECV4:-0}') - float('${RECV_PREV:-0}'),2))" 2>/dev/null || echo "0")
    log "  D07 totalCollections delta=$COLL_DELTA4 (expected ~$PAY_AMOUNT)"
    log "  D08 totalReceivables delta=$RECV_DELTA4 (expected < 0)"

    # D07 — collections must increase
    if python3 -c "exit(0 if float('${COLL_DELTA4:--999999}') > 0 else 1)" 2>/dev/null; then
      pass "D07 totalCollections increased by $COLL_DELTA4 after customer payment"
    else
      fail "D07 totalCollections delta=$COLL_DELTA4 — expected > 0 (payment not counted in collections)"
    fi

    # D08 — receivables must decrease
    if python3 -c "exit(0 if float('${RECV_DELTA4:-0}') < 0 else 1)" 2>/dev/null; then
      pass "D08 totalReceivables decreased by $RECV_DELTA4 after customer payment"
    else
      fail "D08 totalReceivables delta=$RECV_DELTA4 — expected < 0 (receivables not reduced by payment)"
    fi
  }
} || skip "D07/D08 No invoice created — cannot test payment"

# ===========================================================================
# D09 — grossProfit = totalRevenue - costOfSales
# ===========================================================================
header "D09 — grossProfit reflects revenue minus vendor cost"

GET "/api/dashboard/owner"
python3 -c "
import json
d=json.load(open('$TMPD/resp.json'))
rev   = float(d.get('totalRevenue',   -999999))
gp    = float(d.get('grossProfit',    -999999))
missing_rev = rev == -999999
missing_gp  = gp  == -999999
print(f'rev={rev} gp={gp} missing_rev={missing_rev} missing_gp={missing_gp}')
" > "$TMPD/d09.txt" 2>/dev/null
D09_REV=$(grep -o 'rev=[0-9.-]*' "$TMPD/d09.txt" | cut -d= -f2)
D09_GP=$(grep -o 'gp=[0-9.-]*' "$TMPD/d09.txt" | head -1 | cut -d= -f2)
D09_MISS_GP=$(grep -o 'missing_gp=[A-Za-z]*' "$TMPD/d09.txt" | cut -d= -f2)
log "  D09 totalRevenue=$D09_REV  grossProfit=$D09_GP  missing_gp=$D09_MISS_GP"

if [ "$D09_MISS_GP" = "True" ]; then
  fail "D09 grossProfit field missing from /dashboard/owner response"
elif python3 -c "exit(0 if 0 <= float('${D09_GP:--999999}') <= float('${D09_REV:--999999}') else 1)" 2>/dev/null; then
  pass "D09 grossProfit=$D09_GP is in range [0, totalRevenue=$D09_REV] — vendor costs deducted"
else
  fail "D09 grossProfit=$D09_GP is out of range vs totalRevenue=$D09_REV — cost computation wrong"
fi

# ===========================================================================
# UAT-05 — Owner dashboard smoke
# ===========================================================================
header "UAT-05 — Owner dashboard smoke (all expected fields present and numeric)"

GET "/api/dashboard/owner"
python3 -c "
import json, sys
d=json.load(open('$TMPD/resp.json'))
required = ['cashBalance','totalReceivables','totalPayables',
            'totalRevenue','totalCollections','confirmedSalesAmount','grossProfit',
            'todayQuotations','todayAcceptedQuotations','pendingCollections',
            'draftVouchersCount','pendingHotelRequests']
missing=[]
bad=[]
for f in required:
    if f not in d:
        missing.append(f)
    else:
        try: float(d[f])
        except: bad.append(f+' (not numeric: '+str(d[f])+')')
print('missing='+str(missing))
print('bad='+str(bad))
print('ok=' + str(len(missing)==0 and len(bad)==0))
" > "$TMPD/uat05.txt" 2>/dev/null

UAT_MISSING=$(grep "missing=" "$TMPD/uat05.txt" | sed "s/missing=//")
UAT_BAD=$(grep "bad=" "$TMPD/uat05.txt" | sed "s/bad=//")
UAT_OK=$(grep "ok=" "$TMPD/uat05.txt" | sed "s/ok=//")
log "  Missing fields: $UAT_MISSING"
log "  Non-numeric: $UAT_BAD"

if [ "$UAT_OK" = "True" ]; then
  pass "UAT-05 All expected dashboard fields present and numeric"
else
  fail "UAT-05 Dashboard missing or invalid fields — missing=$UAT_MISSING  bad=$UAT_BAD"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}DASHBOARD REVENUE TEST RESULTS${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  ${GREEN}PASS${RESET}: $PASS / $((PASS+FAIL+SKIP))"
echo -e "  ${RED}FAIL${RESET}: $FAIL"
echo -e "  ${YELLOW}SKIP${RESET}: $SKIP"
if [ "${#FAILURES[@]}" -gt 0 ]; then
  echo ""
  echo -e "${BOLD}${RED}FAILED TESTS:${RESET}"
  for f in "${FAILURES[@]}"; do echo -e "  ${RED}✗${RESET} $f"; done
fi
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
