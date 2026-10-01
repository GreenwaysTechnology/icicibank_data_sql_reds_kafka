r"""Run on Windows (not in a container) to prove the EXTERNAL listeners work.

    pip install confluent-kafka
    python lab\host_client_check.py
"""
from confluent_kafka import Producer, Consumer
from confluent_kafka.admin import AdminClient

BOOTSTRAP = "localhost:19092,localhost:29092,localhost:39092"

admin = AdminClient({"bootstrap.servers": BOOTSTRAP})
md = admin.list_topics(timeout=10)
print("brokers :", sorted(f"{b.id}={b.host}:{b.port}" for b in md.brokers.values()))
print("topics  :", sorted(t for t in md.topics if not t.startswith("__")))

p = Producer({"bootstrap.servers": BOOTSTRAP, "acks": "all"})
p.produce("orders", key="judy", value='{"order":2016,"item":"usb hub","amount":22}',
          on_delivery=lambda err, m: print("written :", err or f"{m.topic()}-{m.partition()} @ offset {m.offset()}"))
p.flush(10)

c = Consumer({"bootstrap.servers": BOOTSTRAP, "group.id": "host-check",
              "auto.offset.reset": "earliest"})
c.subscribe(["orders"])
n = 0
while n < 3:
    m = c.poll(5)
    if m is None:
        break
    if not m.error():
        n += 1
        print("read    :", m.partition(), m.offset(), m.key().decode(), m.value().decode()[:40])
c.close()
