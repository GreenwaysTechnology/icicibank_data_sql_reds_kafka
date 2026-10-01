# Lab 0 · Overview and Setup

**Goal:** see what the app does, check that you have everything it needs, and find your way around the project.

## What you will build

`orders-api` is a small Spring Boot 4 application that connects to the three-broker cluster from the **Kafka CLI Lab**. It uses the same `orders` topic you created in Lab 2 and filled in Lab 5. The key of each message is the customer, and the value is the order as JSON:

```output
alice:{"order":2001,"item":"keyboard","amount":45}
```

The app does with Java code what you did with the command-line tools. It sends orders through a REST endpoint and receives them with a consumer group. It can read the topic from any offset and describe the topic's partitions.

```text
              PowerShell · curl.exe · browser · VS Code REST Client
                                      │  HTTP  localhost:8090
                                      ▼
┌─────────────────────────── orders-api  (Spring Boot 4.1) ───────────────────────────┐
│ OrderController                                                                     │
│  POST /api/orders     GET /api/orders     GET /api/orders/received   GET .../topic  │
│        │                    │                       │                     │         │
│  OrderProducer        OrderReader           OrderListener          TopicInspector   │
│  KafkaTemplate        assign() + seek()     @KafkaListener         Admin API        │
│  key = customer       no group, no commit   group "orders-api"     leaders, offsets │
└──────────────────────────────────────┬──────────────────────────────────────────────┘
                                       │  localhost:19092 · 29092 · 39092  (EXTERNAL)
                                       ▼
          kafka1 ── kafka2 ── kafka3         topic orders: 3 partitions × 3 replicas
```

| Method | Path | What it does | Kafka API underneath |
|---|---|---|---|
| `POST` | `/api/orders` | Sends one order. Returns the partition and offset it was stored at | `KafkaTemplate.send()` - a producer |
| `GET` | `/api/orders/received` | The last 50 messages the listener received, newest first | `@KafkaListener` - consumer group `orders-api` |
| `GET` | `/api/orders` | Reads the topic from any offset, optionally one partition or one customer | a consumer with `assign()` and `seek()` |
| `GET` | `/api/orders/topic` | Leader, replicas, ISR, first and next offset of every partition | `Admin.describeTopics()`, `listOffsets()` |

## What you need

| What | Why | Check |
|---|---|---|
| The CLI lab cluster, running | The app connects to it | `docker compose ps` in `kafka_cli_lab` shows three brokers `(healthy)` |
| JDK 21 or newer | Spring Boot 4 needs Java 17+. The project targets 21 | `java -version` |
| Internet access for the first build | The Maven wrapper downloads Maven 3.9.16 and the libraries | - |
| `curl.exe` | Ships with Windows 10 and 11 | `curl.exe --version` |

You do **not** need to install Maven: `mvnw.cmd` downloads the right version the first time it runs. An IDE is optional. IntelliJ IDEA, or VS Code with the *Extension Pack for Java*, opens the `orders-api` folder as a Maven project.

!!! tip "Two shells in this book"
    Blocks labelled **POWERSHELL** run on Windows. Run them in the `orders-api` folder unless the text says otherwise. Blocks labelled **KAFKA1 SHELL** run inside the broker container: open one with `docker exec -it kafka1 bash`, as in the CLI lab.

!!! note "Versions used in this book"
    Spring Boot 4.1.1, Spring for Apache Kafka 4.1.1, Kafka clients 4.2.1, Java 21 and Maven 3.9.16. The brokers are Apache Kafka 4.3.1 from the CLI lab. A 4.2 client talks to a 4.3 broker without any problem: clients and brokers negotiate the API versions they share.

## The files

```text
kafka_spring_boot_lab/
├── README.md
├── Kafka_Spring_Boot_Lab_Guide.pdf       this book
├── send-orders.ps1                       posts every line of orders.txt to the API
├── guide/                                the chapters of this book (Markdown)
├── build_pdf.py                          builds the PDF
└── orders-api/                           the Spring Boot project
    ├── pom.xml
    ├── mvnw, mvnw.cmd, .mvn/             Maven wrapper - no Maven install needed
    ├── requests.http                     ready-made requests for VS Code / IntelliJ
    ├── samples/order.json                a request body for curl.exe
    └── src/main/
        ├── resources/application.yml     connection and client settings
        └── java/com/training/kafka/orders/
            ├── OrdersApiApplication.java      main()
            ├── KafkaTopicConfig.java          creates "orders" if it is missing
            ├── Order.java                     the message value
            ├── OrderRequest.java              the POST body, validated
            ├── SendReceipt.java               the POST response
            ├── OrderMessage.java              a message read back
            ├── TopicInfo.java                 the /topic response
            ├── OrderProducer.java             sends     - KafkaTemplate
            ├── OrderListener.java             receives  - @KafkaListener
            ├── OrderReader.java               reads from any offset
            ├── TopicInspector.java            describes - Admin API
            ├── OrderController.java           the REST endpoints
            ├── ApiExceptionHandler.java       errors as problem JSON
            └── KafkaUnavailableException.java
```

## From the CLI lab to the app

| In the CLI lab you used | In this app |
|---|---|
| `kafka-topics.sh --create --topic orders --partitions 3 --replication-factor 3` | The `NewTopic` bean in `KafkaTopicConfig` |
| `kafka-console-producer.sh --reader-property parse.key=true` | `kafkaTemplate.send(topic, customer, json)` |
| `lab/config/producer.properties`: `acks=all`, idempotence, `linger.ms`, `lz4` | `spring.kafka.producer.*` in `application.yml` |
| `kafka-console-consumer.sh --group ...` | `@KafkaListener(groupId = "orders-api")` |
| `kafka-console-consumer.sh --partition 0 --offset 2 --max-messages 3` | `GET /api/orders?partition=0&offset=2&limit=3` |
| `kafka-consumer-groups.sh --describe --group ...` | Works on the app's group `orders-api` too - try it in Lab 4 |
| `kafka-topics.sh --describe --topic orders` | `GET /api/orders/topic` |
