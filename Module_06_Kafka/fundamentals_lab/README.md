# Kafka Fundamentals - lab kit

Companion to `../archive/Kafka_Fundamentals_with_Labs.pptx` (the labs version of deck 1, kept for the hands-on sessions). Six labs, run in order; each builds on the one before.

## You need

| What | Check |
|------|-------|
| Docker Desktop, running | `docker version` shows a Server section |
| Python 3.11 or later | `python --version` |
| The Kafka client (from Lab 4) | `pip install confluent-kafka` |

Ports used: **9092** (Kafka), **8090** (Kafka UI), **8700** (Lab 1's fake systems).

## Quick start

```powershell
cd fundamentals_lab
docker compose up -d        # wait for "kafka ... (healthy)" in: docker compose ps
start http://localhost:8090 # Kafka UI, cluster "horizon-local"
```

## Files

| File | Lab | What it is |
|------|-----|------------|
| `docker-compose.yml` | 2-6 | One `apache/kafka:4.3.1` node in KRaft mode (no ZooKeeper) plus `kafbat/kafka-ui`. Container names `kafka` and `kafka-ui`. The Kafka CLI tools are on the container's PATH, so `docker exec kafka kafka-topics.sh ...` works. |
| `lab1_request_response.py` | 1 | The transfer service calling fraud, ledger, SMS and warehouse synchronously. Standard library only. Flags: `--sms-down`, `--parallel`, `--transfers N`. |
| `transfer_service.py` | 4-6 | Publishes one `TransferCompleted` event per transfer to `bank.txn.completed`, keyed by account. `python transfer_service.py 20` |
| `consumer.py` | 4-6 | One member of a consumer group. The group name decides what it does (`fraud-engine`, `sms-notifier`, `ledger-feed`, `warehouse-sink`, `loyalty`). `--name A` labels a member, `--idle 5` exits after 5 quiet seconds. |
| `sync_vs_async.py` | 6 | Sends 2,000 events waiting for each ack, then 2,000 asynchronously. Creates its own topic, `lab.perf`. |
| `solutions/` | all | `README.md` has every lab's answers; `transfer_service_sync.py` is the Lab 6 challenge solution. |

## Topics the labs create

| Topic | Created in | Partitions |
|-------|-----------|-----------|
| `lab.hello` | Lab 3, by hand | 3 |
| `bank.txn.completed` | Lab 4, by hand | 3 |
| `lab.perf` | Lab 6, by `sync_vs_async.py` | 3 |

Auto-creation of topics is switched off on purpose (`KAFKA_AUTO_CREATE_TOPICS_ENABLE=false`), so a typo in a topic name fails loudly instead of creating a new topic.

## Reset

```powershell
docker compose down        # stop; topics, messages and offsets are kept
docker compose down -v     # stop and delete everything - Lab 3 onwards starts clean
```

Lab 6 Part B's lag numbers assume Labs 4 and 5 were run exactly as written (12 + 12 + 6 transfers). If you ran extra transfers, your lag is higher. The lesson is the same.

## Verified

Every command on the lab slides was run on Windows 11 in PowerShell on 2026-09-26 against this folder, and every output on the slides was captured from those runs: Docker Engine 29.8, `apache/kafka:4.3.1`, `kafbat/kafka-ui:latest`, Python 3.14, confluent-kafka 2.15.1.

Two harmless messages you will see:

- `WARNING: Due to limitations in metric names, topics with a period ('.') or underscore ('_') could collide` when creating a topic with a dot in its name.
- `The consumer rebalance protocol (KIP-848) is production-ready!` from the console consumer.

## One design note

`transfer_service.py` sets `"partitioner": "murmur2_random"`. librdkafka, the engine under the Python client, hashes keys with CRC32 by default, while Java clients use murmur2. Without this setting, account 9001 would land in a different partition from Python than from the Java console producer in Lab 3.

All data is synthetic training data.
