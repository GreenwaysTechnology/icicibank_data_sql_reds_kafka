# Lab 1 · The Connect Worker

**Goal:** read the worker's configuration, see which plugins it can load, and find the internal topics and group in which a Connect cluster keeps its state.

## The worker's configuration

<!-- include: lab/config/connect1.properties -->

Four groups of settings matter:

- **`bootstrap.servers`** - Connect is a Kafka client like any other.
- **`group.id`** - every worker started with `connect-lab` joins the **same Connect cluster**. The workers share the connectors among themselves, much as consumers in a group share partitions. Lab 6 starts a second worker.
- **The three storage topics** - a Connect cluster keeps no state on disk. Connector configs, source offsets and connector status all live **in Kafka**.
- **Converters** - how a connector's data becomes the bytes of a Kafka message, and back. These are defaults: each connector can override them, and most connectors in this lab do.

Two settings only shorten waits for the lab: `offset.flush.interval.ms` (Lab 2) and `scheduled.rebalance.max.delay.ms` (Lab 6).

## Exercise 1.1 · What can this worker run?

**Task:** list the connector plugins the worker found on its `plugin.path`.

!!! solution "Solution"
    ```powershell
    curl.exe -s localhost:8083/connector-plugins
    ```

    ```output
    [
      {"class": "org.apache.kafka.connect.file.FileStreamSinkConnector", "type": "sink", "version": "4.3.1"},
      {"class": "org.apache.kafka.connect.file.FileStreamSourceConnector", "type": "source", "version": "4.3.1"},
      {"class": "org.apache.kafka.connect.mirror.MirrorCheckpointConnector", "type": "source", "version": "4.3.1"},
      {"class": "org.apache.kafka.connect.mirror.MirrorHeartbeatConnector", "type": "source", "version": "4.3.1"},
      {"class": "org.apache.kafka.connect.mirror.MirrorSourceConnector", "type": "source", "version": "4.3.1"}
    ]
    ```

    (One plugin per line, for reading.) Five connectors ship with Apache Kafka. The two **FileStream** connectors are the ones used in this lab. The three **Mirror** connectors are MirrorMaker 2, which copies topics between clusters. A worker can only run a connector whose class it can load. In Lab 5 you add the JDBC connector to this list.

## Exercise 1.2 · Transforms, predicates and converters

**Task:** the same endpoint lists every plugin type when you add `?connectorsOnly=false`. How many transformations ship with Kafka?

!!! solution "Solution"
    ```powershell
    curl.exe -s "localhost:8083/connector-plugins?connectorsOnly=false"
    ```

    Counted by type, with the transformations and predicates listed:

    ```output
    transformation: 26   header_converter: 10   converter: 9   source: 4   predicate: 3   sink: 1

    Cast$Key  Cast$Value  DropHeaders  ExtractField$Key  ExtractField$Value  Filter
    Flatten$Key  Flatten$Value  HeaderFrom$Key  HeaderFrom$Value  HoistField$Key  HoistField$Value
    InsertField$Key  InsertField$Value  InsertHeader  MaskField$Key  MaskField$Value  RegexRouter
    ReplaceField$Key  ReplaceField$Value  SetSchemaMetadata$Key  SetSchemaMetadata$Value
    TimestampConverter$Key  TimestampConverter$Value  TimestampRouter  ValueToKey

    predicates: HasHeaderKey  RecordIsTombstone  TopicNameMatches
    ```

    (Package names `org.apache.kafka.connect.transforms[.predicates]` dropped.) These are the **Single Message Transforms** from the lesson. Most come in a `$Key` and a `$Value` flavour, depending on which part of the record they change. You will use `MaskField`, `ReplaceField`, `InsertField`, `Filter`, `HasHeaderKey`, `ValueToKey` and `ExtractField`.

## Exercise 1.3 · Where Connect keeps its state

**Task:** find the worker's internal topics, and describe them. What kind of topics are they?

!!! solution "Solution"
    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --list | grep connect
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic connect-offsets | head -1
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic connect-configs | head -1
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic connect-status | head -1
    ```

    ```output
    connect-configs
    connect-offsets
    connect-status
    Topic: connect-offsets	TopicId: WPKG-enmQM2ISPVkvQMqyw	PartitionCount: 25	ReplicationFactor: 3	Configs: min.insync.replicas=2,cleanup.policy=compact
    Topic: connect-configs	TopicId: y_v_b1SOTwqNAqG_x1XVvg	PartitionCount: 1	ReplicationFactor: 3	Configs: min.insync.replicas=2,cleanup.policy=compact
    Topic: connect-status	TopicId: PvKJnb7wSBSuZOR2C6gy1w	PartitionCount: 5	ReplicationFactor: 3	Configs: min.insync.replicas=2,cleanup.policy=compact
    ```

    The worker created all three on its first start. They are **compacted** topics (CLI Lab 4): only the latest value per key matters, which is exactly what you want for "the config of connector X" or "the offset of file Y". `connect-configs` has a **single partition** on purpose, so that every worker reads the config changes in the same order.

    This is why you can stop every worker, start them again, and find all your connectors running as before.

## Exercise 1.4 · The worker group

**Task:** list every group in the cluster with `kafka-groups.sh`. Is `connect-lab` a consumer group?

!!! solution "Solution"
    ```kafka
    kafka-groups.sh --bootstrap-server kafka1:9092 --list
    ```

    ```output
    GROUP                TYPE                 PROTOCOL
    connect-lab          Classic              connect
    orders-api           Classic              consumer
    ```

    `connect-lab` uses the group coordinator from the Consumers lesson, but with protocol **`connect`** instead of `consumer`. The workers use it to share connectors and tasks, not partitions. `kafka-consumer-groups.sh` ignores such groups, which is why `kafka-groups.sh` exists. (`orders-api` is from the Spring Boot lab. Your list may have other groups.)
