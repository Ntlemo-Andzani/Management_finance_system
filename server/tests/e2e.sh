#!/bin/bash
# =====================================================================
# End-to-end test: signs in as each role and walks a loan from
# application through approval, disbursement, repayment and closure.
# Requires the API on :4000 and a freshly seeded database.
#   bash server/tests/e2e.sh
# =====================================================================
BASE=http://localhost:4000/api
# Repeatable run: rebuild the database from schema + seed first.
if [ "${RESET:-1}" = "1" ]; then
  mysql < "$(dirname "$0")/../../database/schema.sql" && mysql mfms < "$(dirname "$0")/../../database/seed.sql"
  echo "Database reset from schema.sql + seed.sql"
fi
PASS=0; FAIL=0

check() { # check "name" "expected substring" "actual"
  if echo "$3" | grep -q "$2"; then echo "  PASS  $1"; PASS=$((PASS+1));
  else echo "  FAIL  $1"; echo "        expected to find: $2"; echo "        got: $3"; FAIL=$((FAIL+1)); fi
}
jqv() { # jqv "$json" key [key...]
  local doc="$1"; shift
  echo "$doc" | python3 -c 'import sys, json
d = json.load(sys.stdin)
for k in sys.argv[1:]:
    d = d[k]
print(d)' "$@" 2>/dev/null
}

echo ""
echo "E2E-01  Authentication and access control"
BAD=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@mfms.co.za","password":"wrongpass"}')
check "E2E-01a wrong password is refused" "incorrect" "$BAD"

ADMIN=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@mfms.co.za","password":"Admin@123"}')
AT=$(jqv "$ADMIN" token)
check "E2E-01b admin signs in" "\"success\": *true\|\"success\":true" "$ADMIN"

MGR=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"email":"manager@mfms.co.za","password":"Manager@123"}')
MT=$(jqv "$MGR" token)
OFF=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"email":"officer@mfms.co.za","password":"Officer@123"}')
OT=$(jqv "$OFF" token)
TEL=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"email":"teller@mfms.co.za","password":"Teller@123"}')
TT=$(jqv "$TEL" token)

NOAUTH=$(curl -s $BASE/clients)
check "E2E-01c unauthenticated request is blocked" "Sign in to continue" "$NOAUTH"

DENY=$(curl -s -X POST $BASE/users -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' -d '{"full_name":"Test","email":"t@t.com","password":"Password1","role":"admin","branch_id":1}')
check "E2E-01d teller cannot create staff accounts" "limited to" "$DENY"

echo ""
echo "E2E-02  Client registration"
NEW=$(curl -s -X POST $BASE/clients -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"first_name":"Thabo","last_name":"Molefe","national_id":"9001015800086","phone":"0731234567","monthly_income":7500,"occupation":"Welder"}')
check "E2E-02a client registered" "registered as CL-" "$NEW"
CID=$(jqv "$NEW" data id)

DUP=$(curl -s -X POST $BASE/clients -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"first_name":"Copy","last_name":"Cat","national_id":"9001015800086","phone":"0730000000"}')
check "E2E-02b duplicate ID number is rejected" "already registered" "$DUP"

INVALID=$(curl -s -X POST $BASE/clients -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"first_name":"A","last_name":"B","national_id":"123","phone":"1"}')
check "E2E-02c short fields fail validation" "highlighted fields" "$INVALID"

PENDING=$(curl -s -X POST $BASE/loans -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d "{\"client_id\":$CID,\"product_id\":1,\"principal\":10000,\"term_months\":12}")
check "E2E-02d pending client cannot borrow" "Activate the client" "$PENDING"

ACT=$(curl -s -X PATCH $BASE/clients/$CID/status -H "Authorization: Bearer $MT" -H 'Content-Type: application/json' -d '{"status":"active"}')
check "E2E-02e manager activates the client" "set to active" "$ACT"

echo ""
echo "E2E-03  Loan pricing and application"
Q=$(curl -s -X POST $BASE/loans/preview -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"product_id":1,"principal":10000,"term_months":12}')
check "E2E-03a quote returns R2400 interest on flat product" "2400" "$Q"
check "E2E-03b quote returns 12 instalments" "\"installments\": *12\|\"installments\":12" "$Q"

OVER=$(curl -s -X POST $BASE/loans/preview -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"product_id":1,"principal":900000,"term_months":12}')
check "E2E-03c amount above product ceiling is refused" "lends between" "$OVER"

APP=$(curl -s -X POST $BASE/loans -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d "{\"client_id\":$CID,\"product_id\":1,\"principal\":10000,\"term_months\":12,\"purpose\":\"Welding equipment\",\"guarantors\":[{\"full_name\":\"Sarah Molefe\",\"phone\":\"0739998888\",\"relationship\":\"Sister\"}]}")
check "E2E-03d application captured" "sent for approval" "$APP"
LID=$(jqv "$APP" data id)

SECOND=$(curl -s -X POST $BASE/loans -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d "{\"client_id\":$CID,\"product_id\":1,\"principal\":5000,\"term_months\":6}")
check "E2E-03e second open application is blocked" "already has an open loan" "$SECOND"

echo ""
echo "E2E-04  Approval and separation of duties"
SELF=$(curl -s -X POST $BASE/loans/$LID/approve -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' -d '{}')
check "E2E-04a officer cannot approve (no permission)" "limited to" "$SELF"

APPR=$(curl -s -X POST $BASE/loans/$LID/approve -H "Authorization: Bearer $MT" -H 'Content-Type: application/json' -d '{}')
check "E2E-04b manager approves the loan" "approved" "$APPR"

TWICE=$(curl -s -X POST $BASE/loans/$LID/approve -H "Authorization: Bearer $MT" -H 'Content-Type: application/json' -d '{}')
check "E2E-04c a loan cannot be approved twice" "Only pending" "$TWICE"

echo ""
echo "E2E-05  Disbursement generates the schedule"
EARLY=$(curl -s -X POST $BASE/repayments -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' \
  -d "{\"loan_id\":$LID,\"amount\":500}")
check "E2E-05a payment before disbursement is refused" "only be posted to active" "$EARLY"

DISB=$(curl -s -X POST $BASE/loans/$LID/disburse -H "Authorization: Bearer $MT" -H 'Content-Type: application/json' \
  -d '{"disbursement_date":"2026-02-01"}')
check "E2E-05b funds disbursed" "schedule generated" "$DISB"

DET=$(curl -s $BASE/loans/$LID -H "Authorization: Bearer $OT")
check "E2E-05c total payable is R12400" "12400" "$DET"
SCHED=$(mysql -N -B mfms -e "SELECT COUNT(*) FROM repayment_schedule WHERE loan_id=$LID")
check "E2E-05d twelve instalment rows written" "12" "$SCHED"
SUMCHK=$(mysql -N -B mfms -e "SELECT ROUND(SUM(total_due),2) FROM repayment_schedule WHERE loan_id=$LID")
check "E2E-05e instalments sum exactly to total payable" "12400.00" "$SUMCHK"

echo ""
echo "E2E-06  Repayment allocation"
ST=$(curl -s $BASE/loans/$LID/statement -H "Authorization: Bearer $TT")
check "E2E-06a statement shows arrears with penalty accrued" "penalty_due_now" "$ST"

PAY=$(curl -s -X POST $BASE/repayments -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' \
  -d "{\"loan_id\":$LID,\"amount\":1033.33,\"payment_date\":\"2026-03-01\",\"method\":\"cash\"}")
check "E2E-06b teller posts a payment and gets a receipt" "Receipt RC-" "$PAY"
check "E2E-06c payment split into principal and interest" "principal_component" "$PAY"

BAL=$(mysql -N -B mfms -e "SELECT ROUND(outstanding_balance,2) FROM loans WHERE id=$LID")
check "E2E-06d balance reduced to 11366.67" "11366.67" "$BAL"

FIRST=$(mysql -N -B mfms -e "SELECT status FROM repayment_schedule WHERE loan_id=$LID AND installment_no=1")
check "E2E-06e first instalment marked paid" "paid" "$FIRST"

ZERO=$(curl -s -X POST $BASE/repayments -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' \
  -d "{\"loan_id\":$LID,\"amount\":0}")
check "E2E-06f zero-value payment is rejected" "highlighted fields\|greater than zero" "$ZERO"

echo ""
echo "E2E-07  Settlement closes the loan"
SETTLE=$(curl -s -X POST $BASE/repayments -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' \
  -d "{\"loan_id\":$LID,\"amount\":20000,\"payment_date\":\"2026-03-02\",\"method\":\"bank\",\"reference\":\"Early settlement\"}")
check "E2E-07a overpayment settles the loan" "\"loan_status\": *\"closed\"\|\"loan_status\":\"closed\"" "$SETTLE"
check "E2E-07b surplus is returned, not banked" "overpayment_returned" "$SETTLE"

CLOSED=$(mysql -N -B mfms -e "SELECT status, ROUND(outstanding_balance,2) FROM loans WHERE id=$LID")
check "E2E-07c loan closed with a zero balance" "closed	0.00" "$CLOSED"

echo ""
echo "E2E-08  Savings"
SAV=$(curl -s -X POST $BASE/savings -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d "{\"client_id\":$CID,\"opening_deposit\":500}")
check "E2E-08a account opened" "opened" "$SAV"
AID=$(jqv "$SAV" data id)

DEP=$(curl -s -X POST $BASE/savings/transactions -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' \
  -d "{\"account_id\":$AID,\"type\":\"deposit\",\"amount\":250}")
check "E2E-08b deposit posted, balance R750" "750" "$DEP"

OVERDRAW=$(curl -s -X POST $BASE/savings/transactions -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' \
  -d "{\"account_id\":$AID,\"type\":\"withdrawal\",\"amount\":5000}")
check "E2E-08c overdrawing is prevented" "overdraw" "$OVERDRAW"

echo ""
echo "E2E-09  Observers and reporting"
sleep 1
NOTES=$(mysql -N -B mfms -e "SELECT COUNT(*) FROM notifications WHERE loan_id=$LID")
check "E2E-09a event observer queued client messages" "[1-9]" "$NOTES"
AUDIT=$(mysql -N -B mfms -e "SELECT COUNT(*) FROM audit_logs")
check "E2E-09b audit observer wrote the trail" "[1-9]" "$AUDIT"

DASH=$(curl -s $BASE/reports/dashboard -H "Authorization: Bearer $AT")
check "E2E-09c dashboard returns portfolio and PAR" "par" "$DASH"
ARR=$(curl -s $BASE/reports/arrears -H "Authorization: Bearer $MT")
check "E2E-09d arrears report responds" "success" "$ARR"

echo ""
echo "E2E-10  Settlement quote matches what actually settles (regression for D-01)"
# The seeded application LN-000001 is disbursed with a back-dated start so that
# penalties accrue, then settled with exactly the quoted payoff figure.
curl -s -X POST $BASE/loans/1/approve -H "Authorization: Bearer $MT" -H 'Content-Type: application/json' -d '{}' > /dev/null
curl -s -X POST $BASE/loans/1/disburse -H "Authorization: Bearer $MT" -H 'Content-Type: application/json' \
  -d '{"disbursement_date":"2025-09-01"}' > /dev/null

QUOTE=$(curl -s $BASE/loans/1/statement -H "Authorization: Bearer $TT")
PAYOFF=$(jqv "$QUOTE" data payoff_amount)
PEN=$(jqv "$QUOTE" data penalty_due_now)
check "E2E-10a quote includes accrued penalty, not just the balance" "[1-9]" "$PEN"

SETTLE2=$(curl -s -X POST $BASE/repayments -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' \
  -d "{\"loan_id\":1,\"amount\":$PAYOFF,\"payment_date\":\"$(date +%Y-%m-%d)\",\"method\":\"cash\"}")
check "E2E-10b paying exactly the quoted figure closes the loan" "\"loan_status\": *\"closed\"\|\"loan_status\":\"closed\"" "$SETTLE2"
check "E2E-10c nothing is returned to the client" "\"overpayment_returned\": *0\|\"overpayment_returned\":0" "$SETTLE2"
FINAL=$(mysql -N -B mfms -e "SELECT status, ROUND(outstanding_balance,2) FROM loans WHERE id=1")
check "E2E-10d balance is exactly zero" "closed	0.00" "$FINAL"

echo ""
echo "======================================================"
echo "  $PASS passed, $FAIL failed"
echo "======================================================"
[ "$FAIL" -eq 0 ] || exit 1
