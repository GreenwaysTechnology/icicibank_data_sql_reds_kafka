# Kafka CLI Lab

A hands-on lab book with step-by-step solutions for the Kafka command-line tools, run on a three-broker **Apache Kafka 4.3.1** cluster in Docker Desktop on Windows.

**The book:** [`Kafka_CLI_Lab_Guide.pdf`](Kafka_CLI_Lab_Guide.pdf) (73 pages)

| Lab | Topic |
|-----|-------|
| 0 | Setup: Docker Desktop on Windows (used), native Windows (reference only), the lab files |
| 1 | Start the cluster: KRaft quorum, brokers, a broker's data directory, connecting from Windows |
| 2 | Topic management: create, list, describe, filters, configs, add partitions, delete, explore |
| 3 | Partitions and replication: key -> partition, replica placement, broker failure, ISR / ELR, `min.insync.replicas`, preferred leader election, reassignment |
| 4 | Segments, retention, compaction: rolling, `retention.bytes`, `kafka-delete-records`, log compaction and tombstones |
| 5 | Producers: console producer, keys and key skew, headers, config files, acks and compression measured |
| 6 | Consumers and offsets: console consumer, formatting, reading from any offset, consumer properties, offset types |
| 7 | Consumer groups: assignment, rebalancing, lag, resetting offsets, `__consumer_offsets`, the KIP-848 protocol |
| 8 | Inside the log files: `kafka-dump-log` - batches, records, compression, compaction, internal topics, metadata log |
| 9 | Index files: `.index` / `.timeindex` format, a lookup followed by hand, density, verification |
| 10 | Cheat sheet and troubleshooting |

Every output in the book was captured from this cluster; `_capture/out/` holds the raw captures.

## Run the lab

```powershell
docker compose up -d          # start the three brokers (image apache/kafka:4.3.1)
docker exec -it kafka1 bash   # a shell with every Kafka tool on the PATH
docker compose down -v        # stop and delete all data - start the labs again from scratch
```

## Files

| Path | What it is |
|------|------------|
| `docker-compose.yml` | Three KRaft nodes (broker + controller each), Kafka UI under the `ui` profile |
| `lab/` | Mounted at `/lab` in every broker: `config/producer.properties`, `config/consumer.properties`, `config/increase-rf.json`, `data/orders.txt`, `data/payloads.txt`, `host_client_check.py` |
| `guide/*.md` | The chapters of the book - edit these, not the PDF |
| `build_pdf.py` | Builds the PDF: Markdown -> HTML -> headless Chrome/Edge (`pip install markdown`) |
| `_capture/` | `lib.sh` (the helper used to record outputs), `out/` (raw outputs), the built HTML |

## Rebuild the PDF

```powershell
python build_pdf.py
```
