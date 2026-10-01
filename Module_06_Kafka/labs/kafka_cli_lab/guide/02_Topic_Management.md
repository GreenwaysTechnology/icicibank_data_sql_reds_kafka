# Lab 2 · Topic Management from the Command Line

**Goal:** use `kafka-topics.sh` and `kafka-configs.sh` to create, inspect, configure, grow and delete topics - and learn the errors you will meet on the way.

All commands in this lab run inside `kafka1` (`docker exec -it kafka1 bash`).

!!! note "The two topic tools"
    - **`kafka-topics.sh`** - create, list, describe, add partitions, delete.
    - **`kafka-configs.sh`** - read and change settings of topics, brokers, users and clients, without restarting anything.

    Both talk to the cluster through `--bootstrap-server`. Older books show `--zookeeper`; that option no longer exists in Kafka 4.x.

## Exercise 2.1 · Create topics

**Task:** create three topics:

- `orders` - 3 partitions, replication factor 3
- `payments` - 6 partitions, replication factor 3, keep data for 1 day, allow messages up to 2 MB
- `audit-log` - using only the cluster defaults

!!! solution "Solution"
    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic orders \
      --partitions 3 --replication-factor 3
    ```

    ```output
    Created topic orders.
    ```

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic payments \
      --partitions 6 --replication-factor 3 \
      --config retention.ms=86400000 --config max.message.bytes=2097152
    ```

    ```output
    Created topic payments.
    ```

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic audit-log
    ```

    ```output
    Created topic audit-log.
    ```

    - `--config key=value` sets a **topic-level override** at creation time; repeat it for each setting. `86400000` ms is 24 hours; `2097152` bytes is 2 MB.
    - `audit-log` got the broker defaults from `docker-compose.yml`: `num.partitions=3` and `default.replication.factor=3`.

## Exercise 2.2 · The errors you will meet

**Task:** try each of these and read the error:

1. Create `orders` again.
2. Create `orders` again, but so that the command succeeds if it already exists.
3. Create a topic with replication factor 4.
4. Create `user.events`, then `user_events`.

!!! solution "Solution"
    **1 - Topic already exists:**

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic orders --partitions 3
    ```

    ```output
    Error while executing topic command : Topic 'orders' already exists.
    [2026-09-27 11:51:27,587] ERROR org.apache.kafka.common.errors.TopicExistsException: Topic 'orders' already exists.
    ```

    **2 - `--if-not-exists`** makes creation idempotent - ideal in scripts that may run twice:

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic orders --partitions 3 --if-not-exists
    echo "exit code: $?"
    ```

    ```output
    exit code: 0
    ```

    **3 - More copies than brokers:**

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic too-many-copies --replication-factor 4
    ```

    ```output
    Error while executing topic command : Unable to replicate the partition 4 time(s): The target
    replication factor of 4 cannot be reached because only 3 broker(s) are registered or some brokers
    have all their log directories cordoned.
    ```

    Each copy of a partition must be on a different broker, so the replication factor can never exceed the number of brokers.

    **4 - Names that collide:**

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic user.events
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic user_events
    ```

    ```output
    WARNING: Due to limitations in metric names, topics with a period ('.') or underscore ('_') could collide. To avoid issues it is best to use either, but not both.
    Created topic user.events.
    WARNING: Due to limitations in metric names, topics with a period ('.') or underscore ('_') could collide. To avoid issues it is best to use either, but not both.
    Error while executing topic command : Topic 'user_events' collides with existing topic: user.events
    ```

    Kafka's metrics replace `.` with `_`, so these two names would share one set of metrics. Pick one separator for all your topic names (this book uses `-`).

    **Topic naming rules:** letters, digits, `.`, `_` and `-`; at most 249 characters; not `.` or `..`.

## Exercise 2.3 · Choose where replicas go

**Task:** create a topic `pinned` with 3 partitions and 2 replicas each, placed like this: partition 0 on brokers 1 and 2, partition 1 on brokers 2 and 3, partition 2 on brokers 3 and 1.

!!! solution "Solution"
    `--replica-assignment` takes a comma-separated list, one entry per partition; each entry is a colon-separated list of broker IDs. The **first** broker in each entry is the preferred leader. Do not pass `--partitions` or `--replication-factor` with it - both follow from the list.

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic pinned \
      --replica-assignment 1:2,2:3,3:1
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic pinned
    ```

    ```output
    Created topic pinned.
    Topic: pinned  TopicId: MTyokh2qRhWcC_bIsZVkkg  PartitionCount: 3  ReplicationFactor: 2  Configs: min.insync.replicas=2
        Topic: pinned  Partition: 0  Leader: 1  Replicas: 1,2  Isr: 1,2  Elr:   LastKnownElr:
        Topic: pinned  Partition: 1  Leader: 2  Replicas: 2,3  Isr: 2,3  Elr:   LastKnownElr:
        Topic: pinned  Partition: 2  Leader: 3  Replicas: 3,1  Isr: 3,1  Elr:   LastKnownElr:
    ```

    Pinning is how you control placement exactly - for example, to put a single-partition topic on a known broker so you can look at its files (Labs 4, 8 and 9 do this).

## Exercise 2.4 · List and describe

**Task:** list all topics, then describe `orders` and `payments`. Explain every column of the describe output.

!!! solution "Solution"
    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --list
    ```

    ```output
    audit-log
    orders
    payments
    pinned
    user.events
    ```

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic orders
    ```

    ```output
    Topic: orders  TopicId: ywkgJzfISRGP0UN2q1Y88A  PartitionCount: 3  ReplicationFactor: 3  Configs: min.insync.replicas=2
        Topic: orders  Partition: 0  Leader: 3  Replicas: 3,1,2  Isr: 3,1,2  Elr:   LastKnownElr:
        Topic: orders  Partition: 1  Leader: 1  Replicas: 1,2,3  Isr: 1,2,3  Elr:   LastKnownElr:
        Topic: orders  Partition: 2  Leader: 2  Replicas: 2,3,1  Isr: 2,3,1  Elr:   LastKnownElr:
    ```

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic payments
    ```

    ```output
    Topic: payments  TopicId: r4Sp6_JBST-S1r3OVVuQNQ  PartitionCount: 6  ReplicationFactor: 3  Configs: min.insync.replicas=2,retention.ms=86400000,max.message.bytes=2097152
        Topic: payments  Partition: 0  Leader: 2  Replicas: 2,3,1  Isr: 2,3,1  Elr:   LastKnownElr:
        Topic: payments  Partition: 1  Leader: 3  Replicas: 3,1,2  Isr: 3,1,2  Elr:   LastKnownElr:
        Topic: payments  Partition: 2  Leader: 1  Replicas: 1,2,3  Isr: 1,2,3  Elr:   LastKnownElr:
        Topic: payments  Partition: 3  Leader: 3  Replicas: 3,1,2  Isr: 3,1,2  Elr:   LastKnownElr:
        Topic: payments  Partition: 4  Leader: 1  Replicas: 1,2,3  Isr: 1,2,3  Elr:   LastKnownElr:
        Topic: payments  Partition: 5  Leader: 2  Replicas: 2,3,1  Isr: 2,3,1  Elr:   LastKnownElr:
    ```

    | Column | Meaning |
    |--------|---------|
    | `TopicId` | A permanent unique ID. If you delete a topic and create one with the same name, it gets a new ID. |
    | `PartitionCount` / `ReplicationFactor` | Number of partitions / copies of each partition |
    | `Configs` | Settings that differ from Kafka's built-in defaults (see the note below) |
    | `Leader` | The broker that serves all reads and writes for this partition |
    | `Replicas` | Every broker holding a copy. The **first** one is the *preferred leader*. |
    | `Isr` | **In-sync replicas** - the copies that are fully caught up with the leader |
    | `Elr` | **Eligible leader replicas** (new in Kafka 4.x) - replicas that left the ISR but are guaranteed to hold all committed data, so they may still become leader |
    | `LastKnownElr` | ELR members that were also fenced - the last resort if everything else fails |

    Notice how Kafka spreads the work: each broker is the leader of an equal share of partitions, and each broker holds a copy of every partition (replication factor 3 on 3 brokers).

!!! note "Why `min.insync.replicas=2` appears on every topic"
    We never set it per topic. Kafka 4.x records the cluster-wide `min.insync.replicas` as a *dynamic cluster default* (the ELR feature needs it), and `--describe` shows it on every topic. `kafka-configs.sh --describe` in Exercise 2.6 shows where it comes from.

## Exercise 2.5 · Filter the describe output

**Task:** show only the topics that have their own settings.

!!! solution "Solution"
    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topics-with-overrides
    ```

    ```output
    Topic: orders       TopicId: ywkgJzfISRGP0UN2q1Y88A  PartitionCount: 3  ReplicationFactor: 3  Configs: min.insync.replicas=2
    Topic: pinned       TopicId: MTyokh2qRhWcC_bIsZVkkg  PartitionCount: 3  ReplicationFactor: 2  Configs: min.insync.replicas=2
    Topic: user.events  TopicId: 1u3C0AHNTPG-diOgCIC6BQ  PartitionCount: 3  ReplicationFactor: 3  Configs: min.insync.replicas=2
    Topic: audit-log    TopicId: RUzgBoJcRhmMC_psWmYb3w  PartitionCount: 3  ReplicationFactor: 3  Configs: min.insync.replicas=2
    Topic: payments     TopicId: r4Sp6_JBST-S1r3OVVuQNQ  PartitionCount: 6  ReplicationFactor: 3  Configs: min.insync.replicas=2,retention.ms=86400000,max.message.bytes=2097152
    ```

    The other describe filters - you will use them in Lab 3 when a broker goes down:

    | Option | Shows partitions that ... |
    |--------|-----------------------------|
    | `--under-replicated-partitions` | have fewer in-sync replicas than replicas |
    | `--under-min-isr-partitions` | have fewer in-sync replicas than `min.insync.replicas` - `acks=all` writes fail |
    | `--at-min-isr-partitions` | have exactly `min.insync.replicas` in sync - one more failure and writes stop |
    | `--unavailable-partitions` | have no leader at all - no reads or writes |
    | `--exclude-internal` | (with any of the above) hide `__consumer_offsets` and other internal topics |

## Exercise 2.6 · Read and change topic settings

**Task:**

1. Show the settings `payments` overrides, then *all* settings of `orders` that deal with retention, segments and compression.
2. Give `audit-log` a 7-day retention and `zstd` compression, then remove the compression setting again.
3. Try to set `segment.bytes=1000` on `audit-log`.
4. Show the cluster-wide broker defaults.

!!! solution "Solution"
    **1 - Overrides only, then everything:**

    ```kafka
    kafka-configs.sh --bootstrap-server kafka1:9092 --describe --entity-type topics --entity-name payments
    ```

    ```output
    Dynamic configs for topic payments are:
      max.message.bytes=2097152 sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:max.message.bytes=2097152, DEFAULT_CONFIG:message.max.bytes=1048588}
      retention.ms=86400000 sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:retention.ms=86400000}
    ```

    `synonyms` shows every level the value could come from, highest priority first: the topic's own setting (`DYNAMIC_TOPIC_CONFIG`), then the broker's (`message.max.bytes`), then the built-in default.

    ```kafka
    kafka-configs.sh --bootstrap-server kafka1:9092 --describe --entity-type topics --entity-name orders --all \
      | grep -E 'cleanup.policy|retention|segment|index.interval|min.insync|max.message|compression.type'
    ```

    ```output
      cleanup.policy=delete sensitive=false synonyms={DEFAULT_CONFIG:log.cleanup.policy=delete}
      compression.type=producer sensitive=false synonyms={DEFAULT_CONFIG:compression.type=producer}
      delete.retention.ms=86400000 sensitive=false synonyms={DEFAULT_CONFIG:log.cleaner.delete.retention.ms=86400000}
      file.delete.delay.ms=60000 sensitive=false synonyms={DEFAULT_CONFIG:log.segment.delete.delay.ms=60000}
      index.interval.bytes=4096 sensitive=false synonyms={DEFAULT_CONFIG:log.index.interval.bytes=4096}
      local.retention.bytes=-2 sensitive=false synonyms={DEFAULT_CONFIG:log.local.retention.bytes=-2}
      local.retention.ms=-2 sensitive=false synonyms={DEFAULT_CONFIG:log.local.retention.ms=-2}
      max.message.bytes=1048588 sensitive=false synonyms={DEFAULT_CONFIG:message.max.bytes=1048588}
      min.insync.replicas=2 sensitive=false synonyms={DYNAMIC_DEFAULT_BROKER_CONFIG:min.insync.replicas=2, STATIC_BROKER_CONFIG:min.insync.replicas=2, DEFAULT_CONFIG:min.insync.replicas=1}
      retention.bytes=-1 sensitive=false synonyms={DEFAULT_CONFIG:log.retention.bytes=-1}
      retention.ms=604800000 sensitive=false synonyms={}
      segment.bytes=1073741824 sensitive=false synonyms={DEFAULT_CONFIG:log.segment.bytes=1073741824}
      segment.index.bytes=10485760 sensitive=false synonyms={DEFAULT_CONFIG:log.index.size.max.bytes=10485760}
      segment.jitter.ms=0 sensitive=false synonyms={}
      segment.ms=604800000 sensitive=false synonyms={}
    ```

    The important defaults, which later labs change:

    | Setting | Default | Meaning |
    |---------|---------|---------|
    | `cleanup.policy` | `delete` | Old data is deleted by age/size. `compact` keeps the latest value per key (Lab 4). |
    | `retention.ms` | 604800000 (7 days) | Delete segments older than this |
    | `retention.bytes` | -1 (no limit) | Delete old segments when a partition grows beyond this |
    | `segment.bytes` | 1073741824 (1 GB) | Start a new segment file when the current one reaches this size |
    | `segment.ms` | 604800000 (7 days) | ... or when it is this old |
    | `index.interval.bytes` | 4096 | Add an index entry roughly every 4 KB of log (Lab 9) |
    | `segment.index.bytes` | 10485760 (10 MB) | Maximum size of each index file (Lab 9) |
    | `compression.type` | `producer` | Keep whatever compression the producer used |
    | `min.insync.replicas` | 2 (our cluster) | Copies that must confirm an `acks=all` write |

    **2 - Add settings, then remove one:**

    ```kafka
    kafka-configs.sh --bootstrap-server kafka1:9092 --alter --entity-type topics --entity-name audit-log \
      --add-config retention.ms=604800000,cleanup.policy=delete,compression.type=zstd
    kafka-configs.sh --bootstrap-server kafka1:9092 --describe --entity-type topics --entity-name audit-log
    ```

    ```output
    Completed updating config for topic audit-log.
    Dynamic configs for topic audit-log are:
      cleanup.policy=delete sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:cleanup.policy=delete, DEFAULT_CONFIG:log.cleanup.policy=delete}
      compression.type=zstd sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:compression.type=zstd, DEFAULT_CONFIG:compression.type=producer}
      retention.ms=604800000 sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:retention.ms=604800000}
    ```

    ```kafka
    kafka-configs.sh --bootstrap-server kafka1:9092 --alter --entity-type topics --entity-name audit-log \
      --delete-config compression.type
    ```

    ```output
    Completed updating config for topic audit-log.
    ```

    Changes take effect immediately on all brokers - no restart. `--delete-config` removes the override, so the topic falls back to the broker default.

    **3 - Values are validated:**

    ```kafka
    kafka-configs.sh --bootstrap-server kafka1:9092 --alter --entity-type topics --entity-name audit-log \
      --add-config segment.bytes=1000
    ```

    ```output
    Caused by: org.apache.kafka.common.errors.InvalidConfigurationException: Invalid value 1000 for configuration segment.bytes: Value must be at least 1048576
    ```

    In Kafka 4.x a segment is at least 1 MB. Lab 4 uses exactly 1 MB to make segments roll quickly.

    **4 - Broker settings:**

    ```kafka
    kafka-configs.sh --bootstrap-server kafka1:9092 --describe --entity-type brokers --entity-default
    ```

    ```output
    Default configs for brokers in the cluster are:
      min.insync.replicas=2 sensitive=false synonyms={DYNAMIC_DEFAULT_BROKER_CONFIG:min.insync.replicas=2}
    ```

    ```kafka
    kafka-configs.sh --bootstrap-server kafka1:9092 --describe --entity-type brokers --entity-name 1 --all \
      | grep -E 'num.partitions|default.replication|log.retention.hours|log.segment.bytes|auto.create|min.insync'
    ```

    ```output
      auto.create.topics.enable=false sensitive=false synonyms={STATIC_BROKER_CONFIG:auto.create.topics.enable=false, DEFAULT_CONFIG:auto.create.topics.enable=true}
      default.replication.factor=3 sensitive=false synonyms={STATIC_BROKER_CONFIG:default.replication.factor=3, DEFAULT_CONFIG:default.replication.factor=1}
      log.retention.hours=168 sensitive=false synonyms={DEFAULT_CONFIG:log.retention.hours=168}
      log.segment.bytes=1073741824 sensitive=false synonyms={DEFAULT_CONFIG:log.segment.bytes=1073741824}
      min.insync.replicas=2 sensitive=false synonyms={DYNAMIC_DEFAULT_BROKER_CONFIG:min.insync.replicas=2, STATIC_BROKER_CONFIG:min.insync.replicas=2, DEFAULT_CONFIG:min.insync.replicas=1}
      num.partitions=3 sensitive=false synonyms={STATIC_BROKER_CONFIG:num.partitions=3, DEFAULT_CONFIG:num.partitions=1}
    ```

    `STATIC_BROKER_CONFIG` values came from `docker-compose.yml`; `DEFAULT_CONFIG` is Kafka's own default. Broker-level names start with `log.` where the topic-level name does not (`log.segment.bytes` vs `segment.bytes`).

## Exercise 2.7 · Add partitions

**Task:** grow `audit-log` from 3 to 6 partitions. Then try to shrink it to 2.

!!! solution "Solution"
    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --alter --topic audit-log --partitions 6
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic audit-log
    ```

    ```output
    Topic: audit-log  TopicId: RUzgBoJcRhmMC_psWmYb3w  PartitionCount: 6  ReplicationFactor: 3  Configs: min.insync.replicas=2,cleanup.policy=delete,retention.ms=604800000
        Topic: audit-log  Partition: 0  Leader: 1  Replicas: 1,2,3  Isr: 1,2,3
        Topic: audit-log  Partition: 1  Leader: 2  Replicas: 2,3,1  Isr: 2,3,1
        Topic: audit-log  Partition: 2  Leader: 3  Replicas: 3,1,2  Isr: 3,1,2
        Topic: audit-log  Partition: 3  Leader: 3  Replicas: 3,1,2  Isr: 3,1,2
        Topic: audit-log  Partition: 4  Leader: 1  Replicas: 1,2,3  Isr: 1,2,3
        Topic: audit-log  Partition: 5  Leader: 2  Replicas: 2,3,1  Isr: 2,3,1
    ```

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --alter --topic audit-log --partitions 2
    ```

    ```output
    Error while executing topic command : The topic audit-log currently has 6 partition(s); 2 would not be an increase.
    ```

!!! warning "Adding partitions changes where keys go"
    A keyed message goes to `hash(key) mod number-of-partitions`. Change the number of partitions and most keys map to a different partition from then on - new messages for customer `alice` may land in a different partition from her old ones, so per-key ordering breaks across the change. Kafka cannot remove partitions at all. Choose the partition count up front, with room to grow.

## Exercise 2.8 · Delete topics

**Task:**

1. Delete `user.events`.
2. Create `tmp-a`, `tmp-b` and `tmp-c`, then delete all three with one command.
3. Delete a topic that does not exist - first so it fails, then so it does not.

!!! solution "Solution"
    **1 - One topic:**

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --delete --topic user.events
    kafka-topics.sh --bootstrap-server kafka1:9092 --list
    ```

    ```output
    audit-log
    orders
    payments
    pinned
    ```

    **2 - Several topics by pattern.** `--topic` accepts a regular expression for `--delete`, `--describe` and `--alter`. Quote it so the shell does not expand the `*`:

    ```kafka
    for t in tmp-a tmp-b tmp-c; do
      kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic $t --partitions 1
    done
    kafka-topics.sh --bootstrap-server kafka1:9092 --delete --topic 'tmp-.*'
    kafka-topics.sh --bootstrap-server kafka1:9092 --list
    ```

    ```output
    Created topic tmp-a.
    Created topic tmp-b.
    Created topic tmp-c.
    audit-log
    orders
    payments
    pinned
    ```

    **3 - A topic that is not there:**

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --delete --topic no-such-topic
    ```

    ```output
    Error while executing topic command : Topic 'no-such-topic' does not exist as expected
    ```

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --delete --topic no-such-topic --if-exists
    echo "exit code: $?"
    ```

    ```output
    exit code: 0
    ```

!!! warning "Deleting a topic is permanent"
    Deletion removes the topic from the metadata at once; the brokers then rename the partition directories with a `-delete` suffix and remove them in the background. There is no undo. In production, protect important topics with ACLs, and consider `delete.topic.enable=false` on the brokers.

## Exercise 2.9 · Explore a topic's data

**Task:** without reading any messages, find out how much data each partition of `orders` holds, and how big it is on disk. (Do this after Exercise 3.1, which loads 10 orders.)

!!! solution "Solution"
    **Offsets per partition.** `kafka-get-offsets.sh` asks the leaders for an offset per partition. With no `--time` it returns the **latest** offset - the next offset that will be written:

    ```kafka
    kafka-get-offsets.sh --bootstrap-server kafka1:9092 --topic orders
    ```

    ```output
    orders:0:4
    orders:1:3
    orders:2:3
    ```

    Format: `topic:partition:offset`. Partition 0 holds offsets 0-3 (4 messages), and so on. `--time -2` gives the earliest offset, and `--time <epoch-ms>` the first offset at or after a timestamp - both are used in Labs 4, 6 and 9.

    **Size on disk, per broker.** `kafka-log-dirs.sh` reports each partition directory's size and whether the copy lags behind:

    ```kafka
    kafka-log-dirs.sh --bootstrap-server kafka1:9092 --describe --topic-list orders --broker-list 1
    ```

    ```output
    Querying brokers for log directories information
    Received log directory information from brokers 1
    {"brokers":[{"broker":1,"logDirs":[{"partitions":[{"partition":"orders-0","size":282,"offsetLag":0,"isFuture":false},{"partition":"orders-1","size":222,"offsetLag":0,"isFuture":false},{"partition":"orders-2","size":224,"offsetLag":0,"isFuture":false}],"error":null,"logDir":"/var/lib/kafka/data"}]}],"version":1}
    ```

    `size` is in bytes. `offsetLag` is how far this copy is behind the leader. `isFuture: true` would mean the partition is being moved between disks on that broker.

## Check yourself

1. Which command would you run to see *only* the partitions that are at risk because one more broker failure would stop writes?
2. A colleague ran `--alter --partitions 12` on a keyed topic that had 6. What changed for existing keys?
3. Where do the values in `synonyms={...}` come from, and which one wins?

!!! solution "Answers"
    1. `kafka-topics.sh --bootstrap-server kafka1:9092 --describe --at-min-isr-partitions`
    2. Most keys now hash to a different partition. Old messages stay where they were; new messages for the same key may go elsewhere, so per-key order is only guaranteed within each "era".
    3. From the topic override, the dynamic broker or cluster settings, the static broker file (`server.properties` / environment), and Kafka's built-in default - in that order. The first one listed wins.
