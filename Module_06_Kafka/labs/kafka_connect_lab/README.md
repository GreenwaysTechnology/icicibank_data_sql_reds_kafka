# Kafka Connect Lab

Hands-on labs for **Kafka 101, Module 9 - Kafka Connect**, using **free connectors only**:

- the **FileStream** source and sink, which ship with Apache Kafka (Apache 2.0)
- Kafka's 26 built-in **SMTs** and 3 predicates (Apache 2.0)
- Confluent's **JDBC** source and sink with PostgreSQL (Confluent Community License, free to use)

Connect runs from the same `apache/kafka:4.3.1` image as the brokers and joins the [Kafka CLI Lab](../kafka_cli_lab) cluster's Docker network.

**The book:** [`Kafka_Connect_Lab_Guide.pdf`](Kafka_Connect_Lab_Guide.pdf) (29 pages). Every output in it was captured from this setup; `_capture/out/` holds the raw captures.

| Lab | Topic |
|-----|-------|
| 0 | Overview and setup: the pipelines, the connectors and their licenses, start Connect + PostgreSQL |
| 1 | The Connect worker: its config, plugins, the internal topics `connect-configs/offsets/status`, the worker group |
| 2 | File source: create a connector with one `PUT`, topic creation, new lines, source offsets, converters |
| 3 | File sink: a topic into a file, the sink's consumer group, the whole pipeline live |
| 4 | Single Message Transforms: `MaskField`, `ReplaceField`, `InsertField`; `Filter` with a `HasHeaderKey` predicate |
| 5 | Database to database with JDBC: install a plugin, the lesson's `source_system = users_db` SMT, inserts and updates, auto-created tables |
| 6 | Running Connect: a poison message and a dead letter queue, pause/resume, a second worker, losing a worker, replaying a source |
| 7 | Cheat sheet: REST API, connector settings, SMTs, troubleshooting, clean-up |

## Run the lab

```powershell
cd ..\kafka_cli_lab
docker compose up -d                      # the three brokers - wait for (healthy)

cd ..\kafka_connect_lab
docker compose up -d                      # connect1 (REST on :8083) + postgres
curl.exe -s localhost:8083/               # {"version":"4.3.1",...}

# create a connector
curl.exe -s -X PUT localhost:8083/connectors/orders-file-source/config -H "Content-Type: application/json" --data "@lab/connectors/orders-file-source.json"

# Lab 5: the JDBC connector
powershell -ExecutionPolicy Bypass -File .\get-jdbc-connector.ps1
docker compose restart connect1

# Lab 6: a second worker (REST on :8084)
docker compose --profile scale up -d

docker compose --profile scale down -v    # stop everything and delete the database
```

## Files

| Path | What it is |
|------|------------|
| `docker-compose.yml` | `connect1`, `connect2` (profile `scale`), `postgres` (port 15432) - on the network `kafka_cli_lab_default` |
| `lab/config/connect1.properties`, `connect2.properties` | Worker settings: `group.id=connect-lab`, internal topics, converters, `plugin.path` |
| `lab/connectors/*.json` | One config per connector, used with `PUT /connectors/<name>/config` |
| `lab/data/in/orders.jsonl` | The file the source connector follows; `lab/data/out/` gets the sink files |
| `lab/add-order.sh` | Appends an order from inside the container (Windows cannot write to the file while the connector holds it) |
| `lab/sql/01_shop.sql` | Creates `shop.users` (with an `updated_at` trigger) and the database `analytics` |
| `get-jdbc-connector.ps1` | Downloads `confluentinc-kafka-connect-jdbc-10.9.9` from Confluent Hub into `plugins/` |
| `guide/*.md` | The chapters of the book - edit these, not the PDF. `<!-- include: path -->` pulls config files in |
| `build_pdf.py` | Builds the PDF: Markdown -> HTML -> headless Chrome/Edge (`pip install markdown`) |

## Rebuild the PDF

```powershell
python build_pdf.py
```
