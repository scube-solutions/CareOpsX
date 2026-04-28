#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5000}"
TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t 'careopsx-tests')"

pass_count=0
fail() { echo "? $1"; exit 1; }
pass() { echo "? $1"; pass_count=$((pass_count+1)); }

json_get() {
  local expr="$1"
  node -e "const fs=require('fs');const input=fs.readFileSync(0,'utf8');const data=input?JSON.parse(input):{};const v=(function(){return ${expr}})();if(v===undefined||v===null){process.exit(3)};if(typeof v==='object'){process.stdout.write(JSON.stringify(v));}else{process.stdout.write(String(v));}"
}

http_json() {
  local method="$1"; shift
  local path="$1"; shift
  local token="${1:-}"; shift || true
  local data="${1:-}"

  local body_file="$TMP_DIR/body.json"
  local code

  if [[ -n "$token" ]]; then
    if [[ -n "$data" ]]; then
      code=$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d "$data")
    else
      code=$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Authorization: Bearer $token")
    fi
  else
    if [[ -n "$data" ]]; then
      code=$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Content-Type: application/json" -d "$data")
    else
      code=$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$BASE_URL$path")
    fi
  fi

  echo "$code"
  cat "$body_file"
}

assert_http() {
  local expected="$1"; shift
  local response="$1"
  local code="$(echo "$response" | head -n1)"
  if [[ "$code" != "$expected" ]]; then
    echo "---- Response Body ----"
    echo "$response" | tail -n +2
    echo "-----------------------"
    fail "Expected HTTP $expected but got $code"
  fi
}

echo "\n=== 1) Server Reachability ==="
resp="$(http_json GET /)"
assert_http 200 "$resp"
status="$(echo "$resp" | tail -n +2 | json_get 'data.status')"
[[ "$status" == "CareOpsX API is running" ]] || fail "Unexpected health response"
pass "Server is reachable"

RAND="$(date +%s)"
ADMIN_EMAIL="admin.$RAND@careopsx.test"
DOCTOR_EMAIL="doctor.$RAND@careopsx.test"
PATIENT_USER_EMAIL="patientuser.$RAND@careopsx.test"
STAFF_EMAIL="staff.$RAND@careopsx.test"
PASSWORD="Pass@1234"

register_user() {
  local first="$1"; local last="$2"; local email="$3"; local role="$4"; local phone="$5"
  local payload
  payload="{\"first_name\":\"$first\",\"last_name\":\"$last\",\"email\":\"$email\",\"phone\":\"$phone\",\"password\":\"$PASSWORD\",\"role_id\":$role}"
  http_json POST /auth/register "" "$payload"
}

login_user() {
  local email="$1"
  local payload
  payload="{\"email\":\"$email\",\"password\":\"$PASSWORD\"}"
  http_json POST /auth/login "" "$payload"
}

echo "\n=== 2-5) Register + Login Role Coverage ==="
resp="$(register_user Admin One "$ADMIN_EMAIL" 1 "9000000011")"
assert_http 201 "$resp"
ADMIN_TOKEN="$(echo "$resp" | tail -n +2 | json_get 'data.token')"
pass "Admin register"

resp="$(register_user Doctor One "$DOCTOR_EMAIL" 2 "9000000022")"
assert_http 201 "$resp"
DOCTOR_USER_ID="$(echo "$resp" | tail -n +2 | json_get 'data.user.id')"
DOCTOR_TOKEN="$(echo "$resp" | tail -n +2 | json_get 'data.token')"
pass "Doctor register"

resp="$(register_user Patient User "$PATIENT_USER_EMAIL" 3 "9000000033")"
assert_http 201 "$resp"
PATIENT_TOKEN="$(echo "$resp" | tail -n +2 | json_get 'data.token')"
pass "Patient register"

resp="$(register_user Staff One "$STAFF_EMAIL" 4 "9000000044")"
assert_http 201 "$resp"
STAFF_TOKEN="$(echo "$resp" | tail -n +2 | json_get 'data.token')"
pass "Staff register"

wrong_login_payload="{\"email\":\"$ADMIN_EMAIL\",\"password\":\"WrongPass\"}"
resp="$(http_json POST /auth/login "" "$wrong_login_payload")"
assert_http 401 "$resp"
pass "Wrong password rejected"

echo "\n=== 6-7) Doctor Create, Filter, Availability ==="
payload="{\"user_id\":\"$DOCTOR_USER_ID\",\"specialization\":\"Cardiology\",\"consultation_fee\":1200,\"experience\":8}"
resp="$(http_json POST /doctors "$ADMIN_TOKEN" "$payload")"
assert_http 201 "$resp"
DOCTOR_ID="$(echo "$resp" | tail -n +2 | json_get 'data.doctor.id')"
pass "Doctor profile created"

resp="$(http_json GET '/doctors?specialty=Cardio')"
assert_http 200 "$resp"
COUNT="$(echo "$resp" | tail -n +2 | json_get '(data.doctors||[]).length')"
[[ "$COUNT" -ge 1 ]] || fail "Doctor specialty filter failed"
pass "Doctor specialty filter works"

availability_payload='{"working_days":["Monday","Tuesday","Wednesday","Thursday","Friday"],"start_time":"09:00","end_time":"12:00","slot_duration":30}'
resp="$(http_json POST "/doctors/$DOCTOR_ID/availability" "$ADMIN_TOKEN" "$availability_payload")"
assert_http 200 "$resp"
pass "Doctor availability configured"

echo "\n=== 8) Slot Generation ==="
TARGET_DATE="$(node -e "const now=new Date();for(let i=1;i<15;i++){const d=new Date(now);d.setDate(now.getDate()+i);const wd=d.getDay();if(wd>=1&&wd<=5){console.log(d.toISOString().slice(0,10));break;}}")"
resp="$(http_json GET "/appointments/slots?doctor_id=$DOCTOR_ID&date=$TARGET_DATE")"
assert_http 200 "$resp"
SLOT_COUNT="$(echo "$resp" | tail -n +2 | json_get '(data.slots||[]).length')"
[[ "$SLOT_COUNT" -ge 1 ]] || fail "Slot generation failed"
pass "Slot generation works"

echo "\n=== 9) Patient Create + Duplicate + Unauthorized ==="
PATIENT_PHONE="90000111$((RAND%100))"
payload="{\"name\":\"Patient Alpha\",\"phone\":\"$PATIENT_PHONE\",\"email\":\"patient.alpha.$RAND@careopsx.test\",\"gender\":\"male\",\"age\":29}"
resp="$(http_json POST /patients "$ADMIN_TOKEN" "$payload")"
assert_http 201 "$resp"
PATIENT_ID="$(echo "$resp" | tail -n +2 | json_get 'data.patient.id')"
pass "Patient created"

resp="$(http_json POST /patients "$ADMIN_TOKEN" "$payload")"
assert_http 409 "$resp"
pass "Duplicate patient phone blocked"

resp="$(http_json POST /patients "" "$payload")"
assert_http 401 "$resp"
pass "Unauthorized patient create blocked"

echo "\n=== 10) Book Appointment + Booking ID + Double-Booking ==="
BOOKING_TIME="$(echo "$resp" >/dev/null; echo "09:00")"
payload="{\"patient_id\":\"$PATIENT_ID\",\"doctor_id\":\"$DOCTOR_ID\",\"appointment_date\":\"$TARGET_DATE\",\"appointment_time\":\"$BOOKING_TIME\",\"reason\":\"Routine check\"}"
resp="$(http_json POST /appointments "$PATIENT_TOKEN" "$payload")"
assert_http 201 "$resp"
BOOKING_ID="$(echo "$resp" | tail -n +2 | json_get 'data.booking_id')"
[[ "$BOOKING_ID" =~ ^CX-[0-9]{4}-[0-9]{4}$ ]] || fail "Booking ID format mismatch: $BOOKING_ID"
APPOINTMENT_ID="$(echo "$resp" | tail -n +2 | json_get 'data.data.id')"
pass "Booking created with valid ID format"

resp="$(http_json POST /appointments "$PATIENT_TOKEN" "$payload")"
assert_http 409 "$resp"
pass "Double-booking rejected"

echo "\n=== 11) Appointment Filters + Lifecycle + Invalid Transition ==="
resp="$(http_json GET "/appointments?doctor_id=$DOCTOR_ID&date=$TARGET_DATE" "$ADMIN_TOKEN")"
assert_http 200 "$resp"
CNT="$(echo "$resp" | tail -n +2 | json_get '(data.data||[]).length')"
[[ "$CNT" -ge 1 ]] || fail "Appointment filters failed"
pass "Appointment filter works"

for s in confirmed completed; do
  payload="{\"status\":\"$s\"}"
  resp="$(http_json PATCH "/appointments/$APPOINTMENT_ID/status" "$DOCTOR_TOKEN" "$payload")"
  assert_http 200 "$resp"
done
pass "Status lifecycle (booked -> confirmed -> completed) works"

payload='{"status":"booked"}'
resp="$(http_json PATCH "/appointments/$APPOINTMENT_ID/status" "$DOCTOR_TOKEN" "$payload")"
assert_http 400 "$resp"
pass "Invalid transition blocked"

echo "\n=== 12-13) Billing + Math + Payment Duplicate ==="
payload="{\"patient_id\":\"$PATIENT_ID\",\"doctor_id\":\"$DOCTOR_ID\",\"consultation_fee\":1200,\"medicine_amount\":300,\"test_amount\":0,\"discount\":100,\"gst_percent\":18,\"notes\":\"billing test\"}"
resp="$(http_json POST /billing/invoices "$ADMIN_TOKEN" "$payload")"
assert_http 201 "$resp"
INVOICE_ID="$(echo "$resp" | tail -n +2 | json_get 'data.invoice.id')"
TOTAL="$(echo "$resp" | tail -n +2 | json_get 'data.invoice.total_amount')"
[[ "$TOTAL" == "1652" || "$TOTAL" == "1652.00" ]] || fail "Expected invoice total 1652 but got $TOTAL"
pass "Invoice created with expected GST math"

payload='{"invoice_id":"'"$INVOICE_ID"'","payment_mode":"cash"}'
resp="$(http_json POST /billing/payments "$ADMIN_TOKEN" "$payload")"
assert_http 200 "$resp"
pass "Payment recorded"

resp="$(http_json POST /billing/payments "$ADMIN_TOKEN" "$payload")"
assert_http 400 "$resp"
pass "Duplicate payment blocked"

echo "\n=== 14) Role Guards ==="
resp="$(http_json GET /billing/invoices "$PATIENT_TOKEN")"
assert_http 403 "$resp"
pass "Patient blocked from admin billing endpoint"

echo "\n=== 15) Reschedule ==="
NEXT_DATE="$(node -e "const now=new Date();for(let i=2;i<20;i++){const d=new Date(now);d.setDate(now.getDate()+i);const wd=d.getDay();if(wd>=1&&wd<=5){console.log(d.toISOString().slice(0,10));break;}}")"
payload="{\"doctor_id\":\"$DOCTOR_ID\",\"appointment_date\":\"$NEXT_DATE\",\"appointment_time\":\"10:00\"}"
resp="$(http_json PUT "/appointments/$APPOINTMENT_ID" "$ADMIN_TOKEN" "$payload")"
assert_http 200 "$resp"
pass "Reschedule works"

echo "\n?? All tests passed! Total assertions: $pass_count"
