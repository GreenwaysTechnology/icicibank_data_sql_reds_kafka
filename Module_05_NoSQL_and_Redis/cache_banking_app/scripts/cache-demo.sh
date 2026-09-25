#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# cache-demo.sh - watch cache-aside and write-through happen from the command line.
# Run from the cache_banking_app folder after `docker compose up -d --build`.
#   bash scripts/cache-demo.sh
# ---------------------------------------------------------------------------
set -euo pipefail
API=http://localhost:4000/api
ACC=602501000101
R="docker exec bank-redis redis-cli"

step() { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }
src()  { curl -s "$1" | sed -E 's/.*"source":"([^"]*)".*"ttl":([^,]*),"tookMs":([^,]*).*/source=\1  ttl=\2s  took=\3ms/'; }

step "1. Start clean: delete every bank:* key"
curl -s -X DELETE $API/cache; echo

step "2. First enquiry  -> MISS, loaded from PostgreSQL, stored in Redis"
src $API/accounts/$ACC/transactions

step "3. Same enquiry again -> HIT, served from Redis"
src $API/accounts/$ACC/transactions

step "4. What Redis now holds"
$R --scan --pattern 'bank:*'
echo -n "TTL bank:txns:$ACC = "; $R TTL bank:txns:$ACC
echo -n "TYPE = "; $R TYPE bank:txns:$ACC
echo -n "first 120 bytes: "; $R GETRANGE bank:txns:$ACC 0 119; echo

step "5. Transfer Rs 100 to 602501000201 -> DB COMMIT, then cache refreshed"
curl -s -X POST $API/transfers -H 'Content-Type: application/json' \
  -d '{"fromAccount":"'$ACC'","toAccount":"602501000201","amount":100,"remarks":"cli demo"}'; echo

step "6. Enquire again -> still a HIT, and the newest row is the transfer"
curl -s $API/accounts/$ACC/transactions | grep -o '"source":"[^"]*"\|"description":"TRF[^"]*"' | head -2

step "7. Hit / miss counters"
curl -s $API/cache/stats; echo
