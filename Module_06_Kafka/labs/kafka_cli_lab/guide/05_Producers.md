# Lab 5 · Producers: Publishing Events

**Goal:** write data with `kafka-console-producer.sh` in every useful way - plain lines, keys, headers, files, config files - and measure how `acks` and compression change throughput and disk usage with `kafka-producer-perf-test.sh`.

!!! note "Option names changed in Kafka 4.x"
    Older books and blog posts use options that are now deprecated. This book uses the current ones:

    | Kafka 4.x (use these) | Deprecated | Purpose |
    |---|---|---|
    | `--reader-property` | `--property` | How the console producer parses each input line (keys, headers ...) |
    | `--command-property` | `--producer-property` | A producer setting, such as `acks=all` |
    | `--command-config` | `--producer.config` | A file of producer settings |

## Exercise 5.1 · Your first messages

**Task:** start the console producer on `audit-log`, type three lines, stop it, and read them back.

!!! solution "Solution"
    ```kafka
    kafka-console-producer.sh --bootstrap-server kafka1:9092 --topic audit-log
    ```

    The producer shows a `>` prompt. Every line you type and send with **Enter** is one message. Stop with **Ctrl+C**:

    ```output
    >user alice logged in
    >user bob logged in
    >user alice logged out
    >^C
    ```

    Read them back in a second window (`docker exec -it kafka1 bash`):

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic audit-log --from-beginning --max-messages 3 \
      --formatter-property print.partition=true
    ```

    ```output
    Partition:1	user alice logged in
    Partition:1	user bob logged in
    Partition:1	user alice logged out
    Processed a total of 3 messages
    ```

    **All three went to the same partition**, although they have no key. Since Kafka 2.4 the producer's default partitioner is **sticky**: messages without a key fill one batch for one partition, and only move to another partition when the batch is sent. Over time the spread is even; over a few lines, they stick together.

!!! tip "Piping instead of typing"
    Anything that writes lines to standard input works - which is how this book captured its outputs:

    ```kafka
    printf 'user alice logged in\nuser bob logged in\n' | kafka-console-producer.sh --bootstrap-server kafka1:9092 --topic audit-log
    kafka-console-producer.sh --bootstrap-server kafka1:9092 --topic orders < /lab/data/orders.txt
    ```

## Exercise 5.2 · Keys, and a surprise

**Task:** create `key-skew` (3 partitions). Send two messages each for keys `cust-1`, `cust-2` and `cust-3`, then count messages per partition.

!!! solution "Solution"
    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic key-skew --partitions 3
    printf 'cust-1:a\ncust-2:b\ncust-3:c\ncust-1:d\ncust-2:e\ncust-3:f\n' | kafka-console-producer.sh \
      --bootstrap-server kafka1:9092 --topic key-skew \
      --reader-property parse.key=true --reader-property key.separator=:
    kafka-get-offsets.sh --bootstrap-server kafka1:9092 --topic key-skew
    ```

    ```output
    key-skew:0:0
    key-skew:1:6
    key-skew:2:0
    ```

    **All six messages are in partition 1.** Nothing is broken: `murmur2("cust-1")`, `murmur2("cust-2")` and `murmur2("cust-3")` all happen to give remainder 1 when divided by 3. With only three keys, collisions like this are common.

    This is **key skew**: one partition (and so one broker, and one consumer in a group) does all the work while the others sit idle. In real systems it comes from a few very busy keys (one huge customer) or from too few distinct keys. Keys should have many distinct values - customer IDs, device IDs, account numbers - not a handful of categories.

The reader properties of the console producer:

| `--reader-property` | Default | Meaning |
|---|---|---|
| `parse.key` | `false` | Split each line into key and value |
| `key.separator` | tab | Where to split |
| `parse.headers` | `false` | Read headers at the start of each line |
| `headers.delimiter` | tab | Separates the headers from the rest of the line |
| `headers.separator` | `,` | Separates one header from the next |
| `headers.key.separator` | `:` | Separates a header's name from its value |
| `null.marker` | (none) | Text to turn into a null key or value - used for tombstones in Lab 4 |
| `ignore.error` | `false` | Skip lines that do not contain the key separator instead of stopping |

## Exercise 5.3 · Headers

**Task:** send an order for key `grace` with two headers, `source=web` and `trace=abc123`, and read it back showing the headers.

!!! solution "Solution"
    With `parse.headers=true` each line is `headers<TAB>key<TAB>value`, and the headers are written `name:value,name:value`:

    ```kafka
    printf 'source:web,trace:abc123\tgrace\t{"order":2012,"item":"notebook","amount":12}\n' \
      | kafka-console-producer.sh --bootstrap-server kafka1:9092 --topic orders \
        --reader-property parse.key=true --reader-property parse.headers=true
    ```

    grace hashes to partition 0 of `orders`. Read the last two messages there:

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic orders --partition 0 --offset 4 --max-messages 2 \
      --formatter-property print.headers=true --formatter-property print.key=true --formatter-property print.offset=true
    ```

    ```output
    Offset:4	NO_HEADERS	grace	{"order":2011,"item":"pen","amount":3}
    Offset:5	source:web,trace:abc123	grace	{"order":2012,"item":"notebook","amount":12}
    Processed a total of 2 messages
    ```

    Headers carry metadata *about* the message - where it came from, a trace ID, a schema version - without touching the value. Kafka never looks inside them; they are for your applications.

!!! warning "A common mistake"
    Writing headers as `source=web` fails with `No header key separator found in pair 'source=web'`. The separator between a header's name and value is `:` unless you change `headers.key.separator`.

## Exercise 5.4 · Producer settings from a file

**Task:** send the 10 sample orders to `payments` using the settings in `/lab/config/producer.properties`. What does each setting do? Then check which compression was actually used.

!!! solution "Solution"
    ```kafka
    grep -v '^#' /lab/config/producer.properties | grep .
    ```

    ```output
    client.id=lab-producer
    acks=all
    enable.idempotence=true
    linger.ms=20
    batch.size=32768
    compression.type=lz4
    delivery.timeout.ms=120000
    ```

    | Setting | Meaning |
    |---------|---------|
    | `client.id` | A name for this producer in broker logs, metrics and quotas |
    | `acks` | `0` = do not wait; `1` = wait for the leader; `all` = wait for every in-sync replica (the default since Kafka 3.0) |
    | `enable.idempotence` | The broker drops duplicates caused by retries, using producer ID + sequence number (default `true`) |
    | `linger.ms` | Wait up to this long to fill a batch before sending (default 5 ms in Kafka 4.x) |
    | `batch.size` | Maximum bytes per batch, per partition (default 16384) |
    | `compression.type` | `none`, `gzip`, `snappy`, `lz4` or `zstd` - a whole batch is compressed together |
    | `delivery.timeout.ms` | Total time `send()` may take, including retries, before it reports failure |

    ```kafka
    kafka-console-producer.sh --bootstrap-server kafka1:9092 --topic payments \
      --command-config /lab/config/producer.properties \
      --reader-property parse.key=true --reader-property key.separator=: < /lab/data/orders.txt
    kafka-get-offsets.sh --bootstrap-server kafka1:9092 --topic payments
    ```

    ```output
    payments:0:1
    payments:1:1
    payments:2:3
    payments:3:3
    payments:4:2
    payments:5:0
    ```

    Ten messages across six partitions, spread by key. Now look at one batch on disk with `kafka-dump-log.sh` (explained fully in Lab 8):

    ```kafka
    kafka-dump-log.sh --files /var/lib/kafka/data/payments-2/00000000000000000000.log | grep -o 'count: [0-9]*\|compresscodec: [a-z0-9]*'
    ```

    ```output
    count: 3
    compresscodec: none
    ```

    **Not compressed** - although the file says `lz4`.

!!! warning "Console producer gotcha: `--compression-codec` wins"
    `kafka-console-producer.sh` has its own `--compression-codec` option, which defaults to `none` and **overrides** `compression.type` from `--command-config` and `--command-property`. Proof - one message each way into a fresh topic:

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic codec-check --replica-assignment 1
    echo 'x1' | kafka-console-producer.sh --bootstrap-server kafka1:9092 --topic codec-check --command-property compression.type=lz4
    echo 'x2' | kafka-console-producer.sh --bootstrap-server kafka1:9092 --topic codec-check --compression-codec lz4
    kafka-dump-log.sh --files /var/lib/kafka/data/codec-check-0/00000000000000000000.log | grep -o 'baseOffset: [0-9]*\|compresscodec: [a-z0-9]*'
    ```

    ```output
    baseOffset: 0
    compresscodec: none
    baseOffset: 1
    compresscodec: lz4
    ```

    With the console producer, use `--compression-codec`. Real applications, and `kafka-producer-perf-test.sh`, honour `compression.type`.

## Exercise 5.5 · What `acks` costs

**Task:** create `perf-test` (3 partitions, replication factor 3). Send 100,000 messages of 500 bytes with `acks=0`, `acks=1` and `acks=all`, and compare throughput and latency.

!!! solution "Solution"
    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic perf-test --partitions 3
    for a in 0 1 all; do
      kafka-producer-perf-test.sh --bootstrap-server kafka1:9092 --topic perf-test \
        --num-records 100000 --record-size 500 --throughput -1 \
        --command-property acks=$a linger.ms=10 batch.size=65536
    done
    ```

    ```output
    100000 records sent, 38431.975404 records/sec (18.33 MB/sec), 23.20 ms avg latency, 766.00 ms max latency, 13 ms 50th, 71 ms 95th, 84 ms 99th, 108 ms 99.9th.
    100000 records sent, 38022.813688 records/sec (18.13 MB/sec), 178.93 ms avg latency, 680.00 ms max latency, 169 ms 50th, 356 ms 95th, 391 ms 99th, 405 ms 99.9th.
    100000 records sent, 31328.320802 records/sec (14.94 MB/sec), 445.89 ms avg latency, 979.00 ms max latency, 396 ms 50th, 882 ms 95th, 954 ms 99th, 978 ms 99.9th.
    ```

    | acks | Records/s | Avg latency | 99th pct | Durability |
    |------|-----------|-------------|----------|-----------|
    | `0` | 38,432 | 23 ms | 84 ms | None - the producer does not even learn about failures |
    | `1` | 38,023 | 179 ms | 391 ms | Lost if the leader dies before followers copy the message |
    | `all` | 31,328 | 446 ms | 954 ms | Survives any failure that leaves one in-sync copy |

    `acks=all` waits for the slowest in-sync follower, so latency grows most. On a laptop the three "brokers" share one disk and CPU, which exaggerates the gap; on real hardware it is smaller. The rule stays: **`acks=all` for data you cannot lose** - it is the default for a reason. (Your numbers will differ from these.)

## Exercise 5.6 · What compression saves

**Task:** send the same 50,000 JSON orders (`/lab/data/payloads.txt`) to four single-partition topics with `none`, `gzip`, `lz4` and `zstd`. Compare the size on disk.

!!! solution "Solution"
    ```kafka
    for z in none gzip lz4 zstd; do
      kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic comp-$z --replica-assignment 1
    done
    for z in none gzip lz4 zstd; do
      kafka-producer-perf-test.sh --bootstrap-server kafka1:9092 --topic comp-$z \
        --num-records 50000 --payload-file /lab/data/payloads.txt --throughput -1 \
        --command-property acks=all linger.ms=20 batch.size=65536 compression.type=$z | tail -1
    done
    du -b /var/lib/kafka/data/comp-*/*.log
    ```

    ```output
    50000 records sent, 46253.469010 records/sec (4.89 MB/sec), 9.40 ms avg latency, ...
    50000 records sent, 33898.305085 records/sec (3.58 MB/sec), 11.66 ms avg latency, ...
    50000 records sent, 32743.942371 records/sec (3.46 MB/sec), 14.30 ms avg latency, ...
    50000 records sent, 42698.548249 records/sec (4.51 MB/sec), 9.54 ms avg latency, ...
    669235	/var/lib/kafka/data/comp-gzip-0/00000000000000000000.log
    1240001	/var/lib/kafka/data/comp-lz4-0/00000000000000000000.log
    6040650	/var/lib/kafka/data/comp-none-0/00000000000000000000.log
    760843	/var/lib/kafka/data/comp-zstd-0/00000000000000000000.log
    ```

    | Codec | On disk | vs none |
    |-------|---------|---------|
    | none | 6.04 MB | 100 % |
    | lz4 | 1.24 MB | 21 % |
    | zstd | 0.76 MB | 13 % |
    | gzip | 0.67 MB | 11 % |

    - `--payload-file` sends real JSON lines, which compress well. (The default random payload of `--record-size` hardly compresses at all.)
    - The producer compresses **whole batches**, so bigger batches (higher `linger.ms` / `batch.size`) compress better.
    - The broker stores the batch **as the producer compressed it** (topic `compression.type=producer`) and the consumer decompresses it. Compression saves network, disk and replication traffic at the cost of producer and consumer CPU.
    - `zstd` gives near-gzip size at much lower CPU; `lz4` is the fastest. Both are common choices.

## Exercise 5.7 · Keys across languages

**Task:** in Lab 1 (Exercise 1.4) the Python script wrote an order with key `judy`. Which partition did it go to, and which partition would a Java producer choose?

!!! solution "Solution"
    The Python output said `written : orders-0 @ offset 6`: partition **0**. Java producers - including `kafka-console-producer.sh` - hash keys with **murmur2**, which puts `judy` in partition **2**. (In Lab 7, judy's order from the console producer is indeed in partition 2.)

    The Python, Go, .NET and JavaScript clients are built on **librdkafka**, whose default partitioner is `consistent_random` (CRC32), not murmur2. If producers in different languages write keyed messages to the same topic, the same key can land in different partitions, breaking per-key order. Fix: set `partitioner=murmur2_random` in every librdkafka-based producer.

## Check yourself

1. You need `acks=all` and lz4 compression from the console producer. Which options do you pass?
2. Why can three keys all land in one partition, and why does it matter?
3. Your producer sends with `acks=all` and gets `NotEnoughReplicasException`. What is wrong, and where do you look?

!!! solution "Answers"
    1. `--command-property acks=all --compression-codec lz4` (the console producer's own `--compression-codec` overrides `compression.type`).
    2. The partition is `hash(key) mod partitions`; with few keys, collisions are likely. It matters because one partition - one broker and one consumer - gets all the load: key skew.
    3. The partition has fewer in-sync replicas than `min.insync.replicas`. Check `kafka-topics.sh --describe --under-min-isr-partitions` and look for a broker that is down or lagging (Lab 3).
