# Apache Kafka Training

A standalone course pack, built on its own. It does not change any other training folder.

## Decks

| # | File | Slides | Covers |
|---|------|--------|--------|
| 1 | `01_Kafka_Fundamentals.pptx` | 73 | **01 Distributed systems:** what a distributed system is, application layers, a 60-year timeline, mainframes, networks (ARPANET, Ethernet, TCP/IP), client-server, tiers, RPC/CORBA/DCOM/RMI, three tier and the web, SOA and the ESB, cloud and microservices, the eight fallacies · **02 Moving data:** data is everything, every byte has a story, data at rest vs in motion, the pre-Kafka metrics story (direct connection → clustered → more services → N x M → one pub/sub → many pub/subs → duplication) · **03 Messaging:** talk without waiting, queue vs pub/sub, pub/sub vocabulary, messaging timeline (TIB → MQSeries → MSMQ → JMS → AMQP → ActiveMQ/SQS → RabbitMQ → Kafka → Pulsar), JMS, AMQP rules, log aggregators, LinkedIn's 2010 problem, why existing tools did not fit · **04 Birth of Kafka:** one system instead of many, Kafka through the years, logs, log vs normal files, the log as a data structure (Jay Kreps), Kafka vs Log4j, commit logs, queue vs log · **05 Events and event streaming:** what an event is, notification + state, state as tables, things first vs events first, streams and tables, event-driven architecture, location tracking, what event streaming is, use cases · **06 Kafka at a glance:** implementation (JVM), servers and clients, records, topics, partitions and replication, producers and consumers, the ecosystem, three core jobs, the definition, Kafka in the real world · no labs |

Deck 1 keeps the trainer's own outline and examples (metrics servers, the iPhone 15 click, the payment to Ramesh, East Coast Road). It adds a short history of distributed systems and of messaging, and explains Kafka in the order the Apache Kafka documentation and Confluent's Kafka 101 course do: events first, then the log, then the platform. Sources and background reading are in each slide's speaker notes.

## Kafka 101 series - `Kafka101/`

One deck per lesson of Confluent's Apache Kafka 101 course, in the course's order. Each deck follows its lesson's flow and teaching points in our own words (no copied text), with the source lesson credited on the title and closing slides.

| # | File | Slides | Source lesson | Covers |
|---|------|--------|---------------|--------|
| 1 | `Kafka101/01_Introduction.pptx` | 13 | [Introduction](https://developer.confluent.io/courses/apache-kafka/events/) | One slide per segment of the lesson transcript, in order: Kafka as the foundation of data systems · data as tables of things · think of events first · events run through data systems · real time, not batch · Kafka can remember · things vs events is not absolute (schemas) · what the course covers · scale · the emerging data streaming platform · ten more modules · summary |
| 2 | `Kafka101/02_Topics.pptx` | 15 | [Topics](https://developer.confluent.io/courses/apache-kafka/topics/) | One slide per segment of the lesson transcript, in order: thermostat readings in a table · updating a row loses the history · Kafka uses logs, called topics · messages are immutable · the readings as a topic · thousands of topics · a message is just bytes (schemas live outside) · transform by writing a new topic · a topic is a log, not a queue · message structure: value, key, timestamp, headers, topic and offset · summary |
| 3 | `Kafka101/03_Partitions.pptx` | 12 | [Partitions](https://developer.confluent.io/courses/apache-kafka/partitions/) | One slide per segment of the lesson transcript, in order: Kafka as a distributed system · a topic on one node would be a limit · partitioning splits a topic into logs · ordering is per partition · hundreds, thousands, ~2 million partitions · no key: round robin (with a note on today's sticky partitioner) · so one sensor's readings go out of order · with a key: hash mod partitions · same key, same partition, same order · why partitions matter · summary |
| 4 | `Kafka101/04_Brokers.pptx` | 11 | [Brokers](https://developer.confluent.io/courses/apache-kafka/brokers/) | One slide per segment of the lesson transcript, in order: brokers are the machines doing the work · a broker is a Kafka server (JVM) process, from the tarball or Docker · brokers run almost anywhere, historically on local SSDs (with a note on tiered storage) · managed services hide the brokers · brokers form a cluster, partitions spread across them · many topics, different partition counts · brokers handle reads and writes and do the I/O · ZooKeeper kept the metadata, removed in 4.0 · KRaft: Kafka keeps its own metadata with Raft (with a note on controllers) · summary |
| 5 | `Kafka101/05_Replication.pptx` | 11 | [Replication](https://developer.confluent.io/courses/apache-kafka/replication/) | One slide per segment of the lesson transcript, in order: one copy is not enough - disks and servers fail · the replication factor (with the kafka-topics.sh command) · one leader, n - 1 followers · followers keep up with the leader (ISR) · a broker fails: two copies survive, a new leader is elected · getting back to three copies (bring the broker back or reassign) · writes go to the leader, reads too by default · reading from the nearest replica (follower fetching, Kafka 2.4+) · why replication matters · summary |
| 6 | `Kafka101/06_Producers.pptx` | 12 | [Producers](https://developer.confluent.io/courses/apache-kafka/producers/) | One slide per segment of the lesson transcript, in order: producers get data in (everything that is not a broker produces, consumes, or both) · clients for many languages · KafkaProducer does the heavy lifting · configuration: bootstrap.servers and acks=all · the code: KafkaProducer and ProducerRecord (our own Java) · what goes into a ProducerRecord · a small API over a lot of hard work · serializers · the producer picks the partition (with a note on Java vs librdkafka hashing) · hands on: a Python producer against the lab kit · summary |
| 7 | `Kafka101/07_Consumers.pptx` | 15 | [Consumers](https://developer.confluent.io/courses/apache-kafka/consumers/) | One slide per segment of the lesson transcript, in order: consumers get data out · KafkaConsumer and its configuration (bootstrap.servers, group.id) · subscribe to a list of topics, or a pattern · loop forever - a stream has no last message · what poll() really does · keys and values have types · the code: poll, then iterate (our own Java) · consuming does not delete · committing offsets (__consumer_offsets) · commits are batched (auto-commit, at-least-once) · a consumer handles one message at a time · consumer groups and rebalancing (the transcript stops here, so these two follow the lesson page's written summary) · summary |

Next in the series (when requested), in the course's order: Confluent Schema Registry, Kafka Connect, Stream Processing, Introduction to Confluent's Offerings. The course also has hands-on exercises after Producers, Consumers, Schema Registry, Kafka Connect and Stream Processing (Flink SQL); they are not part of this series, so from Consumers on our module numbers are lower than the course's lesson numbers (Consumers is our Module 7, the course's lesson 8).

## Lab book - `labs/kafka_cli_lab/`

**`labs/kafka_cli_lab/Kafka_CLI_Lab_Guide.pdf`** - a 72-page hands-on lab book with step-by-step solutions for the Kafka command-line tools, on a three-broker Apache Kafka 4.3.1 cluster (KRaft) in Docker Desktop on Windows. Every output in it was captured from that cluster.

Labs: 0 setup (Docker Desktop; native Windows for reference) · 1 start the cluster · 2 topic management (create, list, describe, configs, partitions, delete, explore) · 3 partitions and replication (failover, ISR, `min.insync.replicas`, leader election, reassignment) · 4 segments, retention and compaction · 5 producers (keys, headers, config files, acks and compression measured) · 6 consumers, consumer properties and offsets · 7 consumer groups (rebalancing, lag, offset resets, `__consumer_offsets`, KIP-848) · 8 inside the log files (`kafka-dump-log`) · 9 index files · 10 cheat sheet and troubleshooting.

The cluster is `labs/kafka_cli_lab/docker-compose.yml`; the chapters are Markdown in `labs/kafka_cli_lab/guide/`, built with `python build_pdf.py`. See `labs/kafka_cli_lab/README.md`.

## Archive - kept for the hands-on sessions

| File | What it is |
|------|------------|
| `archive/Kafka_Fundamentals_with_Labs.pptx` | The earlier, more advanced version of deck 1 (56 slides). It has six step-by-step labs with measured output and solutions: request-response coupling, starting Kafka, console producer/consumer, fan-out to consumer groups, rebalancing, and sync vs async with an outage replay. Its lab kit is `fundamentals_lab/`. |

## Lab kit - `fundamentals_lab/`

A Docker Compose file (`apache/kafka:4.3.1`, KRaft, plus Kafka UI) and four small Python scripts using `confluent-kafka`. `solutions/` has the written answers. It goes with the archived labs deck, and is ready for when the labs are scheduled. See `fundamentals_lab/README.md`.

## Rebuilding the decks

The decks are generated. Edit the scripts, not the .pptx files. All the decks share the theme in `deckkit.py`, so a change there restyles every deck on the next build.

```powershell
cd _build
python deck1_fundamentals.py              # writes ../01_Kafka_Fundamentals.pptx
python deck_fundamentals_with_labs.py     # writes ../archive/Kafka_Fundamentals_with_Labs.pptx
python k101_01_introduction.py            # writes ../Kafka101/01_Introduction.pptx
python k101_02_topics.py                  # writes ../Kafka101/02_Topics.pptx
python k101_03_partitions.py              # writes ../Kafka101/03_Partitions.pptx
python k101_04_brokers.py                 # writes ../Kafka101/04_Brokers.pptx
python k101_05_replication.py             # writes ../Kafka101/05_Replication.pptx
python k101_06_producers.py               # writes ../Kafka101/06_Producers.pptx
python k101_07_consumers.py               # writes ../Kafka101/07_Consumers.pptx
python validate.py ../01_Kafka_Fundamentals.pptx
```

| File | What it is |
|------|------------|
| `_build/deckkit.py` | Slide toolkit and the pack's theme, "Graphite & Tangerine": Bahnschrift headings, Segoe UI body, Consolas code (all built into Windows); a log-segment stripe on every content slide, numbered footers, split section dividers, a title slide with a row of log cells; click-by-click animations. Independent of every other pack's toolkit. |
| `_build/deck1_fundamentals.py` | Deck 1: every slide, its animation steps, and its speaker notes |
| `_build/deck_fundamentals_with_labs.py` | The archived labs version |
| `_build/diagkit.py` | Diagram helpers (boxes, arrows, log cells, cards) shared by the Kafka 101 decks |
| `_build/k101_01_introduction.py` | Kafka 101, module 1 |
| `_build/k101_02_topics.py` | Kafka 101, module 2 |
| `_build/k101_03_partitions.py` | Kafka 101, module 3 |
| `_build/k101_04_brokers.py` | Kafka 101, module 4 |
| `_build/k101_05_replication.py` | Kafka 101, module 5 |
| `_build/k101_06_producers.py` | Kafka 101, module 6 |
| `_build/k101_07_consumers.py` | Kafka 101, module 7 |
| `_build/validate.py` | Static check for out-of-bounds shapes and text overflow |

Requires `python-pptx` and `lxml`.
