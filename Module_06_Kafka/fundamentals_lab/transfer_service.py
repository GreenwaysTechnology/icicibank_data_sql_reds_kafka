# -*- coding: utf-8 -*-
"""
transfer_service.py  -  Labs 4, 5 and 6, Kafka Fundamentals.

The Horizon Bank fund-transfer service, event-driven.  For every transfer it
does its OWN work (posting the transfer - simulated, 30 ms) and then PUBLISHES
one TransferCompleted event to Kafka.  It does not call fraud, SMS, ledger or
the warehouse, and it does not know they exist.

    pip install confluent-kafka
    python transfer_service.py          # 12 transfers
    python transfer_service.py 20       # 20 transfers

All data is synthetic training data.
"""
import json
import random
import sys
import time
import uuid
from datetime import datetime, timezone

from confluent_kafka import Producer

BOOTSTRAP = "localhost:9092"
TOPIC = "bank.txn.completed"

POST_MS = 30                                   # the transfer's own work
ACCOUNTS = [9001, 9002, 9003, 9004, 9005, 9006]
CHANNELS = ["UPI", "IMPS", "NEFT", "ATM", "POS"]


def build_producer():
    return Producer({
        "bootstrap.servers": BOOTSTRAP,
        "acks": "all",                    # wait until the broker has stored it
        "enable.idempotence": True,       # a retry can never create a duplicate
        "partitioner": "murmur2_random",  # same key -> same partition as Java clients
    })


def make_event(i, rnd):
    account = ACCOUNTS[i % len(ACCOUNTS)]
    amount = rnd.choice([rnd.randint(1, 250) * 100,             # everyday payments
                         rnd.randint(1, 250) * 100,
                         rnd.randint(500, 900) * 100])           # the odd big one
    return {
        "event_id": str(uuid.uuid4()),        # lets a consumer spot a redelivery
        "event_type": "TransferCompleted",    # a FACT, in the past tense
        "occurred_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "txn_id": "TXN-" + uuid.uuid4().hex[:6].upper(),
        "account_id": account,
        "txn_type": "DEBIT" if i % 3 else "CREDIT",
        "amount": "%.2f" % amount,            # a string: JSON numbers are floats
        "channel": rnd.choice(CHANNELS),
    }


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    rnd = random.Random()
    producer = build_producer()

    delivered = {}                            # account -> [(partition, offset)]
    failed = []

    def on_delivery(err, msg):                # called LATER, from producer.poll/flush
        if err is not None:
            failed.append(err)
        else:
            delivered.setdefault(int(msg.key()), []).append((msg.partition(), msg.offset()))

    print("Horizon Bank transfer service - publishes events, calls nobody\n")
    for i in range(n):
        t0 = time.perf_counter()
        event = make_event(i, rnd)

        time.sleep(POST_MS / 1000.0)          # 1. do our own work: post the transfer

        producer.produce(TOPIC,               # 2. announce what happened - and move on
                         key=str(event["account_id"]),
                         value=json.dumps(event),
                         on_delivery=on_delivery)
        producer.poll(0)                      # serve any delivery reports that are ready

        ms = (time.perf_counter() - t0) * 1000
        print("%s  acct %d  %-6s %10s  %-4s  committed in %d ms"
              % (event["txn_id"], event["account_id"], event["txn_type"],
                 "{:,.2f}".format(float(event["amount"])), event["channel"], ms))

    producer.flush(10)                        # before exiting: wait for every ack
    print("\npublished %d events to %s - broker acknowledged %d, failed %d"
          % (n, TOPIC, sum(len(v) for v in delivered.values()), len(failed)))
    for account in sorted(delivered):
        parts = sorted({p for p, _ in delivered[account]})
        offs = ", ".join(str(o) for _, o in delivered[account])
        print("  key %d -> partition %s   offsets %s"
              % (account, "/".join(map(str, parts)), offs))


if __name__ == "__main__":
    main()
