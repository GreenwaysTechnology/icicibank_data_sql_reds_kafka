# Lab 6 · API Reference and Troubleshooting

## Endpoints

Base URL: `http://localhost:8090/api/orders`. Every request is also in `orders-api\requests.http`, ready to run from VS Code (*REST Client* extension) or IntelliJ.

### POST /api/orders - send an order

| Body field | Type | Rule | Becomes |
|---|---|---|---|
| `customer` | string | not blank | the message **key** |
| `order` | integer | > 0 | value field `order` |
| `item` | string | not blank | value field `item` |
| `amount` | integer | > 0 | value field `amount` |

| Status | When | Body |
|---|---|---|
| `201 Created` | Kafka acknowledged the message (`acks=all`) | `topic`, `partition`, `offset`, `timestamp`, `key`, `value` |
| `400 Bad Request` | Invalid field or malformed JSON | problem JSON. For invalid fields, `errors` lists them |
| `503 Service Unavailable` | No broker answered, or the write failed (e.g. too few in-sync replicas) | problem JSON with the Kafka error in `detail` |

### GET /api/orders/received - what the listener received

No parameters. Returns up to `app.keep-last` (50) messages, newest first, received since the app started. Each message has `topic`, `partition`, `offset`, `timestamp`, `key` and `value`. `value` is JSON when the message was JSON, and a string otherwise.

### GET /api/orders - read the topic

| Parameter | Default | Meaning |
|---|---|---|
| `partition` | all | Read only this partition. Unknown partition: `400` |
| `offset` | `0` | Start at this offset in each partition read. Clamped to the partition's first and end offset |
| `limit` | `20` | At most this many messages (1-500) |
| `customer` | - | Only messages with this key |

The result is sorted by partition, then offset. The reader stops at the end of the log, or after 5 seconds. It uses no consumer group and commits nothing.

### GET /api/orders/topic - describe the topic

For each partition: `leader`, `replicas`, `isr` (broker ids), `startOffset` (first offset still stored) and `endOffset` (next offset to be written).

## Settings

All in `src\main\resources\application.yml`. Override any of them at startup with `--name=value`, or with an environment variable such as `APP_TOPIC`. No rebuild is needed.

| Property | Default | Meaning |
|---|---|---|
| `server.port` | `8090` | HTTP port |
| `spring.kafka.bootstrap-servers` | `localhost:19092,localhost:29092,localhost:39092` | Where to find the cluster |
| `app.topic` | `orders` | The topic the app sends to, listens to and reads |
| `app.listener-group-id` | `orders-api` | The listener's consumer group |
| `app.keep-last` | `50` | Size of the `/received` buffer |
| `spring.kafka.producer.acks` | `all` | `0`, `1` or `all` - try `1` with a broker down |
| `logging.level.org.apache.kafka` | `WARN` | `INFO` shows every client setting at startup |

```powershell
java -jar target\orders-api-1.0.0.jar --server.port=8095 --app.listener-group-id=orders-test
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `curl -X POST ...` fails with *A parameter cannot be found that matches parameter name 'X'* | `curl` is PowerShell's alias for `Invoke-WebRequest` | Type `curl.exe` |
| `400` with `"detail":"Failed to read request"` from `curl.exe -d '{"a":"b"}'` | Windows PowerShell 5.1 strips the inner `"` | Escape them as `\"`, or use `--data "@file.json"` or `Invoke-RestMethod` (Lab 3) |
| Startup fails: *Port 8090 was already in use* | Another program, or another copy of the app | `--server.port=8091`, or stop the other one: `Get-NetTCPConnection -LocalPort 8090` shows its process id |
| Log repeats *Connection to node -1 (localhost/127.0.0.1:19092) could not be established* | The cluster is not running | `docker compose up -d` in `kafka_cli_lab`, wait for `(healthy)` |
| Log shows *Connection to node 2 (kafka2/...) could not be established*, or *UnknownHostException: kafka2* | The app reached a broker on the **internal** listener name | The app must use the EXTERNAL ports `19092/29092/39092` from Windows, or `kafka1:9092 ...` from inside the Docker network - never a mix |
| `POST` returns `503` after about 25 s | No in-sync leader can take the write (brokers down, ISR below `min.insync.replicas`) | `docker compose ps`, then start the stopped brokers (Lab 5) |
| `/received` is empty after a restart | The buffer lives in memory, and the group resumes after its committed offsets | Expected - use `GET /api/orders` to read older messages |
| The listener gets no partitions: log shows `partitions assigned: []` | More app instances than partitions | Expected - it is a standby. Stop an instance, or add partitions |
| `mvnw.cmd` fails: *Cannot download ... maven* | No internet, or a proxy, on the first build | Set the proxy in `%USERPROFILE%\.m2\settings.xml`, or install Maven and run `mvn -DskipTests package` |
| Build fails with *release version 21 not supported* | `java` on the PATH is older than 21 | `java -version` - install JDK 21 and set `JAVA_HOME` |

## Where to go next

- **Schema Registry** (Kafka 101, Module 8): replace the hand-made JSON with Avro or JSON Schema, so a producer cannot write something like grace's free-text message.
- **Spring for Apache Kafka reference**: `@RetryableTopic` and dead-letter topics for messages that fail, transactions, and `ReplyingKafkaTemplate` for request/reply.
- **Testing**: Spring Kafka's `@EmbeddedKafka` or Testcontainers' Kafka module start a broker inside a JUnit test.
