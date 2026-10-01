# -*- coding: utf-8 -*-
"""
sync_vs_async.py  -  Lab 6, Kafka Fundamentals.

Sends the same N events twice, with acks=all both times:

    SYNC   produce one event, then BLOCK until the broker acknowledges it,
           then produce the next one  (what send().get() does in Java)
    ASYNC  produce every event without waiting; the broker's acknowledgement
           arrives later in a callback; flush() once at the end

    python sync_vs_async.py            # 2000 events each way
    python sync_vs_async.py 5000

The script creates its own scratch topic, lab.perf, if it is missing.
"""
import sys
import time

from confluent_kafka import KafkaException, Producer
from confluent_kafka.admin import AdminClient, NewTopic

BOOTSTRAP = "localhost:9092"
TOPIC = "lab.perf"


def ensure_topic():
    admin = AdminClient({"bootstrap.servers": BOOTSTRAP})
    if TOPIC in admin.list_topics(timeout=10).topics:
        return
    try:
        admin.create_topics([NewTopic(TOPIC, num_partitions=3, replication_factor=1)])[TOPIC].result()
    except KafkaException:
        pass                                  # created by someone else meanwhile


def producer():
    p = Producer({"bootstrap.servers": BOOTSTRAP, "acks": "all",
                  "enable.idempotence": True, "partitioner": "murmur2_random"})
    p.produce(TOPIC, key="warm-up", value="x")    # open the connection first,
    p.flush(10)                                  # so neither run pays for it
    return p


def run_sync(n):
    p, acked = producer(), [0]

    def cb(err, msg):
        if err is None:
            acked[0] += 1

    t0 = time.perf_counter()
    for i in range(n):
        p.produce(TOPIC, key=str(9001 + i % 6), value="event %d" % i, on_delivery=cb)
        p.flush()                             # BLOCK until this one is acknowledged
    return time.perf_counter() - t0, acked[0]


def run_async(n):
    p, acked = producer(), [0]

    def cb(err, msg):                         # runs later, when the ack arrives
        if err is None:
            acked[0] += 1

    t0 = time.perf_counter()
    for i in range(n):
        p.produce(TOPIC, key=str(9001 + i % 6), value="event %d" % i, on_delivery=cb)
        p.poll(0)                             # hand over any acks that are ready - no waiting
    p.flush()                                 # ONE wait, at the end, for whatever is left
    return time.perf_counter() - t0, acked[0]


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
    ensure_topic()
    print("%d events each way, acks=all, topic %s\n" % (n, TOPIC))

    s, s_ok = run_sync(n)
    print("SYNC   wait for every ack   : %5d events in %6.3f s  -> %7s events/s  (%.2f ms per event)"
          % (n, s, "{:,.0f}".format(n / s), s * 1000 / n))
    a, a_ok = run_async(n)
    print("ASYNC  callback, flush once : %5d events in %6.3f s  -> %7s events/s  (%.3f ms per event)"
          % (n, a, "{:,.0f}".format(n / a), a * 1000 / n))

    print("\nacknowledged by the broker : sync %d / %d   async %d / %d" % (s_ok, n, a_ok, n))
    print("async was %.0fx faster - and exactly as durable" % (s / a))


if __name__ == "__main__":
    main()
