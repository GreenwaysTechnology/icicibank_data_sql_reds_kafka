# -*- coding: utf-8 -*-
"""
consumer.py  -  Labs 4, 5 and 6, Kafka Fundamentals.

One consumer in a consumer group.  What it does with each TransferCompleted
event depends on the group it belongs to - the same event means something
different to the fraud engine, the SMS notifier and the ledger feed.

    python consumer.py fraud-engine
    python consumer.py sms-notifier --name A      # two members of one group:
    python consumer.py sms-notifier --name B      #   they SHARE the partitions
    python consumer.py ledger-feed --idle 10      # stop after 10 s with no events

Ctrl+C stops it cleanly.
"""
import argparse
import json
import time

from confluent_kafka import Consumer

BOOTSTRAP = "localhost:9092"
TOPIC = "bank.txn.completed"


def inr(e):
    return "INR {:,.2f}".format(float(e["amount"]))


# what each group DOES with the same fact
HANDLERS = {
    "fraud-engine": lambda e: ("ALERT  %s on %d via %s - hold for review"
                               % (inr(e), e["account_id"], e["channel"])
                               if float(e["amount"]) >= 50000 else "clear"),
    "sms-notifier": lambda e: ("SMS -> acct %d: %s of %s via %s"
                               % (e["account_id"], e["txn_type"].lower(), inr(e), e["channel"])),
    "ledger-feed": lambda e: ("GL posted  %s %d  %s"
                              % ("DR" if e["txn_type"] == "DEBIT" else "CR",
                                 e["account_id"], inr(e))),
    "warehouse-sink": lambda e: "row loaded into fact_txn",
    "loyalty": lambda e: ("+%d points for %d"
                          % (float(e["amount"]) // 100, e["account_id"])),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("group", help="consumer group id, e.g. fraud-engine")
    ap.add_argument("--name", default="1", help="label for this member of the group")
    ap.add_argument("--idle", type=float, default=0,
                    help="exit after this many seconds with no new events (0 = never)")
    args = ap.parse_args()

    label = "%s/%s" % (args.group, args.name)
    handle = HANDLERS.get(args.group, lambda e: "received " + e["event_type"])

    consumer = Consumer({
        "bootstrap.servers": BOOTSTRAP,
        "group.id": args.group,             # the group, not the process, owns the position
        "client.id": label,
        "auto.offset.reset": "earliest",    # a brand-new group starts at the oldest event
        "enable.auto.commit": False,        # we commit AFTER the work is done
    })

    def on_assign(c, parts):
        print("[%s] assigned partitions %s" % (label, sorted(p.partition for p in parts)),
              flush=True)

    def on_revoke(c, parts):
        print("[%s] revoked  partitions %s" % (label, sorted(p.partition for p in parts)),
              flush=True)

    consumer.subscribe([TOPIC], on_assign=on_assign, on_revoke=on_revoke)

    done = 0
    last = time.time()
    try:
        while True:
            msg = consumer.poll(1.0)          # ask the broker: anything new for me?
            if msg is None:
                if args.idle and time.time() - last > args.idle:
                    break
                continue
            if msg.error():
                print("[%s] error: %s" % (label, msg.error()), flush=True)
                continue

            event = json.loads(msg.value())
            print("[%s] p%d@%-3d %s  %s"
                  % (label, msg.partition(), msg.offset(), event["txn_id"], handle(event)),
                  flush=True)
            consumer.commit(message=msg, asynchronous=False)   # "done up to here"
            done += 1
            last = time.time()
    except KeyboardInterrupt:
        pass
    finally:
        consumer.close()                      # leave the group cleanly -> fast rebalance
        print("[%s] processed %d events, left the group" % (label, done), flush=True)


if __name__ == "__main__":
    main()
