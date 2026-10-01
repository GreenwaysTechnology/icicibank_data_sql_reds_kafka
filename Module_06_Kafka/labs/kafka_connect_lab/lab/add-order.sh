#!/bin/bash
# ---------------------------------------------------------------------------
#  add-order.sh - appends one order to the file the source connector watches
#
#      docker exec connect1 bash /lab/add-order.sh 3009 carol "desk lamp" 35
#
#  It runs inside the container on purpose: while the connector has the file
#  open, Docker Desktop does not let Windows programs write to it.
# ---------------------------------------------------------------------------
set -e
if [ $# -ne 4 ]; then
    echo "usage: add-order.sh ORDER CUSTOMER ITEM AMOUNT" >&2
    exit 1
fi
printf '{"order":%s,"customer":"%s","item":"%s","amount":%s,"email":"%s@example.com","card":"4111111111111111"}\n' \
    "$1" "$2" "$3" "$4" "$2" >> /lab/data/in/orders.jsonl
tail -1 /lab/data/in/orders.jsonl
