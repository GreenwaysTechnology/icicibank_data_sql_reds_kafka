# -*- coding: utf-8 -*-
"""
Solution - Lab 6 challenge.

The transfer service, changed so that it does not return until the BROKER
has acknowledged the event (a synchronous send).  Only step 2 differs from
../transfer_service.py - the flush() after produce().

    python solutions\\transfer_service_sync.py 12

Result: each transfer costs ~1-2 ms more, and the service KNOWS the event
is stored before it tells the customer "done".  It is synchronous with the
broker only - it still waits for no consumer, so an SMS outage still cannot
stop a transfer.
"""
import json
import os
import random
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from transfer_service import POST_MS, TOPIC, build_producer, make_event   # noqa: E402


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    rnd = random.Random()
    producer = build_producer()
    result = {}

    def on_delivery(err, msg):
        result["err"], result["where"] = err, (msg.partition(), msg.offset())

    print("Horizon Bank transfer service - waits for the broker's ack on every event\n")
    for i in range(n):
        t0 = time.perf_counter()
        event = make_event(i, rnd)
        time.sleep(POST_MS / 1000.0)                      # 1. our own work

        producer.produce(TOPIC, key=str(event["account_id"]),
                         value=json.dumps(event), on_delivery=on_delivery)
        producer.flush(10)                                # 2. BLOCK until acknowledged
        if result.get("err"):
            print("%s  NOT PUBLISHED: %s" % (event["txn_id"], result["err"]))
            continue

        ms = (time.perf_counter() - t0) * 1000
        print("%s  acct %d  committed in %.1f ms  (stored at p%d@%d)"
              % (event["txn_id"], event["account_id"], ms,
                 result["where"][0], result["where"][1]))


if __name__ == "__main__":
    main()
