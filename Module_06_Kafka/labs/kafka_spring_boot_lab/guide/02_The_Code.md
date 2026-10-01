# Lab 2 · The Code, File by File

**Goal:** read the whole application, about 500 lines, and connect each piece to a Kafka idea from the course. Every listing below is the actual file from the project.

## The dependencies

Three Spring Boot starters do all the work. The `spring-boot-starter-parent` POM picks matching versions for everything, so the dependencies need no version numbers:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webmvc</artifactId>      <!-- REST: Spring MVC + Tomcat + Jackson -->
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-kafka</artifactId>       <!-- KafkaTemplate, @KafkaListener, KafkaAdmin -->
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>  <!-- @Valid, @NotBlank, @Positive -->
</dependency>
```

!!! note "Spring Boot 4 starter names"
    Spring Boot 4 split its auto-configuration into modules, and two starters were renamed. Kafka support now comes from **`spring-boot-starter-kafka`**. In Boot 3 you added `spring-kafka` directly, and on Boot 4 that alone gives you the library but **no auto-configuration**. Spring MVC comes from **`spring-boot-starter-webmvc`**, the new name for `spring-boot-starter-web`. Boot 4 also moves to Jackson 3, whose classes live in the `tools.jackson` package instead of `com.fasterxml.jackson`.

## The configuration: application.yml

<!-- include: orders-api/src/main/resources/application.yml -->

Spring Boot reads `spring.kafka.*` and builds three things from it: a `ProducerFactory` behind the `KafkaTemplate`, a `ConsumerFactory` behind the listener and the reader, and a `KafkaAdmin`. The settings are the ones from the CLI lab's property files:

| `lab/config/*.properties` | `application.yml` | Meaning |
|---|---|---|
| `acks=all` | `producer.acks: all` | The leader answers once every in-sync replica has the record |
| `enable.idempotence=true` | `producer.properties.enable.idempotence` | Retries cannot create duplicates |
| `linger.ms=20`, `batch.size=32768` | `properties.linger.ms`, `batch-size: 32KB` | Wait up to 20 ms to fill a batch of up to 32 KB |
| `compression.type=lz4` | `compression-type: lz4` | Compress each batch. The console producer ignored this; the app does not |
| `delivery.timeout.ms=120000` | `delivery.timeout.ms: 25000` | Give up sooner, so a REST caller is not kept waiting for 2 minutes |
| `group.id=orders-reporting` | `app.listener-group-id: orders-api` | Set on the `@KafkaListener`, so the reader can run without a group |
| `auto.offset.reset=earliest` | `consumer.auto-offset-reset: earliest` | A new group starts at the oldest message |
| `enable.auto.commit=true` | *(not set)* | Spring turns auto-commit off and commits itself - see `OrderListener` |

Spring Boot recognises common settings by name, such as `acks`, `batch-size` and `compression-type`. Any other Kafka setting goes under `properties:`, written exactly as Kafka spells it.

## Creating the topic: KafkaTopicConfig

<!-- include: orders-api/src/main/java/com/training/kafka/orders/KafkaTopicConfig.java -->

`TopicBuilder` is the code version of `kafka-topics.sh --create`. `KafkaAdmin` checks every `NewTopic` bean at startup. It creates missing topics and adds partitions if a bean asks for more than the topic has. It never deletes anything and never reduces partitions.

## The data: Order, OrderRequest and friends

<!-- include: orders-api/src/main/java/com/training/kafka/orders/Order.java -->

<!-- include: orders-api/src/main/java/com/training/kafka/orders/OrderRequest.java -->

Java **records** are ideal for messages: they are immutable, and Jackson turns them into JSON and back with no extra code. The REST client sends an `OrderRequest`. The app splits it in two: `customer` becomes the **key**, and the rest, an `Order`, becomes the **value**. The validation annotations reject a bad request before anything reaches Kafka.

`SendReceipt`, `OrderMessage` and `TopicInfo` are records too. They describe what the endpoints return.

## Sending: OrderProducer

<!-- include: orders-api/src/main/java/com/training/kafka/orders/OrderProducer.java -->

What happens on each line:

1. `json.writeValueAsString(order)` turns the record into `{"order":2001,"item":"keyboard","amount":45}`. Kafka itself only ever sees bytes. The `StringSerializer` from `application.yml` turns that string into UTF-8 bytes.
2. `kafka.send(topic, key, value)` returns at once with a `CompletableFuture`. The record now waits in the producer's buffer, for up to `linger.ms`, so it can travel in a batch with others.
3. `.get(30, SECONDS)` waits for the future to complete. That means the batch was sent, the leader wrote it, and with `acks=all` every in-sync replica has it too.
4. `RecordMetadata` is the broker's answer: the partition and offset where the record now lives. The endpoint returns it to the caller.

!!! tip "Blocking on get() - fine here, not everywhere"
    Waiting for each send keeps the REST API simple: the caller sees the partition and offset straight away. A high-volume producer would not wait. It would attach a callback, `send(...).whenComplete((result, error) -> ...)`, and let batching work. Blocking sends one batch per request, so `linger.ms` buys nothing.

## Receiving: OrderListener

<!-- include: orders-api/src/main/java/com/training/kafka/orders/OrderListener.java -->

This is the poll loop from the Consumers lesson, written by Spring. For each `@KafkaListener`, Spring starts a **listener container**: a thread that subscribes to the topic, calls `poll()` forever, and passes each record to your method. What you saw in the Consumers lesson:

- **Group:** `groupId = "orders-api"`. Start a second copy of the app and the two share the partitions (Lab 5).
- **Offsets:** Spring sets `enable.auto.commit=false` and commits the group's offsets itself, after your method has handled every record of a `poll()`. This is the container's default `AckMode.BATCH`. If the app crashes in the middle of a batch, the records of that batch are delivered again: **at-least-once**.
- **Threads:** `onMessage` runs on the container thread, not on a web request thread. The deque is thread-safe because the web threads read it while the listener writes to it.

The deque keeps only the latest 50 messages, in memory. Restart the app and it is empty, but the topic is not.

## Reading from any offset: OrderReader

<!-- include: orders-api/src/main/java/com/training/kafka/orders/OrderReader.java -->

The listener is a group member: it always moves forward and remembers its place. The reader is the opposite. It is `kafka-console-consumer.sh --partition --offset` in Java:

- `createConsumer(null, ...)` creates a consumer with **no group id**. Without a group it cannot `subscribe()`, so it calls **`assign()`** and picks the partitions itself.
- `beginningOffsets()` and `endOffsets()` give the first offset still on disk and the next one to be written.
- `seek()` jumps to the requested offset. It is clamped to that range, because a position past the end makes the consumer fall back to `auto.offset.reset`.
- The loop polls until it has `limit` messages, has reached the end of every partition, or has used up its 5 seconds.

It commits nothing and joins no group, so calling it never moves the listener's position.

## Describing the topic: TopicInspector

<!-- include: orders-api/src/main/java/com/training/kafka/orders/TopicInspector.java -->

The **Admin API** is what `kafka-topics.sh` and `kafka-consumer-groups.sh` use internally. `describeTopics()` returns the leader, replicas and ISR of each partition, and `listOffsets()` returns the first and next offset. `KafkaAdmin.getConfigurationProperties()` reuses the connection settings from `application.yml`, so the bootstrap servers are not repeated.

## The REST layer: OrderController and ApiExceptionHandler

<!-- include: orders-api/src/main/java/com/training/kafka/orders/OrderController.java -->

The controller only translates between HTTP and the four services: no Kafka code lives here. `@Valid` triggers the checks on `OrderRequest`, and `Math.clamp` keeps `limit` between 1 and 500.

`ApiExceptionHandler` turns failures into **problem JSON** (RFC 9457): a 400 for a bad request, with the invalid fields listed, and a 503 when Kafka cannot be reached. You will see both in Lab 3.
