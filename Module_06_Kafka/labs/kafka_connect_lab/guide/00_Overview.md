# Lab 0 · Overview and Setup

**Goal:** see what you will build, start a Kafka Connect worker and a PostgreSQL database next to the CLI lab's cluster, and check that Connect answers.

## What you will build

Kafka Connect moves data between Kafka and other systems using **connectors you configure, not code you write**. In this lab you run Connect from the same `apache/kafka:4.3.1` image as the brokers and build three pipelines, using only free connectors:

```text
  ┌──────────────── lab\data\in\orders.jsonl ─────────────────┐
  │                                                           ▼
  │   FileStreamSource ──▶ topic shop-orders ──▶ FileStreamSink ──▶ lab\data\out\shop-orders.txt
  │                                │
  │                                └──▶ FileStreamSink + SMTs ──▶ lab\data\out\shop-orders-clean.txt
  │                                     (mask card, drop email, rename, tag, filter)   │ bad records
  │                                                                                    ▼
  │                                                                         topic shop-orders-dlq
  │
  │   PostgreSQL shop.users ──▶ JdbcSource + InsertField ──▶ topic pg-users ──▶ JdbcSink ──▶ analytics.users_replica
  │                             source_system = users_db
  │
  └── every connector runs in the Connect cluster "connect-lab": worker connect1 (+ connect2 in Lab 6)
```

| Connector | Ships with | License | Used in |
|---|---|---|---|
| `FileStreamSourceConnector` | Apache Kafka (`libs/connect-file-4.3.1.jar`) | Apache 2.0 | Labs 2, 4, 6 |
| `FileStreamSinkConnector` | Apache Kafka | Apache 2.0 | Labs 3, 4, 6 |
| 26 SMTs and 3 predicates | Apache Kafka (`connect-transforms`) | Apache 2.0 | Labs 4, 5, 6 |
| `JdbcSourceConnector`, `JdbcSinkConnector` | Confluent Hub, `kafka-connect-jdbc` 10.9.9 | Confluent Community License - free to use | Labs 5, 6 |

!!! note "The FileStream connectors are for learning"
    The Kafka project calls the FileStream connectors examples. They read and write one local file, they cannot run more than one task usefully, and they do not survive a file being rotated. Use them to learn how Connect works, not to ship logs to production.

## What you need

| What | Check |
|---|---|
| The **Kafka CLI Lab** cluster, running | In `kafka_cli_lab`: `docker compose ps` shows `kafka1`, `kafka2`, `kafka3` `(healthy)` |
| Docker Desktop with about 1.5 GB of free memory | Connect needs 512 MB per worker, PostgreSQL about 100 MB |
| Internet access, once | Lab 5 downloads the JDBC connector from Confluent Hub (28 MB unpacked) |
| `curl.exe` | Ships with Windows 10 and 11 |

The lab joins the CLI lab's Docker network, `kafka_cli_lab_default`. The Connect workers reach the brokers as `kafka1:9092` and so on, and the brokers see them as ordinary clients.

## The files

```text
kafka_connect_lab/
├── docker-compose.yml               connect1, connect2 (profile "scale"), postgres
├── get-jdbc-connector.ps1           downloads the JDBC connector into plugins\ (Lab 5)
├── Kafka_Connect_Lab_Guide.pdf      this book
├── lab/                             mounted at /lab in the Connect containers
│   ├── config/connect1.properties   worker settings (connect2.properties: the same, other host name)
│   ├── connectors/*.json            one file per connector configuration
│   ├── data/in/orders.jsonl         the file the source connector reads
│   ├── data/out/                    where the sink connectors write
│   ├── sql/01_shop.sql              creates and fills shop.users, creates database analytics
│   └── add-order.sh                 appends an order to orders.jsonl (from inside the container)
├── plugins/                         mounted at /plugins - extra connectors go here
├── guide/, build_pdf.py             the chapters of this book and the script that builds it
└── _capture/out/                    the raw outputs captured for this book
```

## Exercise 0.1 · Start Connect and PostgreSQL

**Task:** with the CLI lab's cluster running, start this lab's containers and wait until `connect1` is healthy.

!!! solution "Solution"
    ```powershell
    cd D:\trainings\Apache_Kafka_Training\labs\kafka_connect_lab
    docker compose up -d
    docker compose ps
    ```

    ```output
    NAME       IMAGE                COMMAND                  SERVICE    STATUS                    PORTS
    connect1   apache/kafka:4.3.1   "/opt/kafka/bin/conn…"   connect1   Up 19 seconds (healthy)   0.0.0.0:8083->8083/tcp
    postgres   postgres:16-alpine   "docker-entrypoint.s…"   postgres   Up 20 seconds             0.0.0.0:15432->5432/tcp
    ```

    (Columns trimmed.) The `COMMAND` shows the trick: the broker image, started with `connect-distributed.sh` instead of the broker. A Connect worker is a Kafka **client** that ships in the Kafka distribution, the same way the CLI tools do.

    PostgreSQL publishes **15432** on Windows, because 5432 is often taken by a local installation. The lab itself only uses `docker exec`.

## Exercise 0.2 · Hello, Connect

**Task:** call the root of the Connect REST API. Which Kafka cluster is the worker connected to?

!!! solution "Solution"
    ```powershell
    curl.exe -s localhost:8083/
    ```

    ```output
    {"version":"4.3.1","commit":"26b251a451ce941d","kafka_cluster_id":"mXRdmJ0FRR-s1q-6q0Gqew"}
    ```

    `kafka_cluster_id` is the `CLUSTER_ID` from the CLI lab's `docker-compose.yml`, so the worker is talking to the right cluster. **Everything in Connect is done through this REST API**: creating connectors, checking their status, pausing them. There is no Connect CLI tool.

!!! tip "Shells used in this book"
    **POWERSHELL** blocks run on Windows, in the `kafka_connect_lab` folder. **KAFKA1 SHELL** blocks run in the broker container (`docker exec -it kafka1 bash`). **CONNECT1 SHELL** blocks run in the Connect container (`docker exec -it connect1 bash`). **PSQL** blocks are SQL for `docker exec -it postgres psql -U lab -d shop`.
