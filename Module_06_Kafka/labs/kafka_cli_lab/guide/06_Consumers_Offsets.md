# Lab 6 · Consumers, Consumer Properties and Offsets

**Goal:** read data with `kafka-console-consumer.sh` from any point in a topic, show everything a record carries, configure a consumer from a file, and understand the different kinds of offset.

## Background: the offsets you will meet

For every partition, several offsets matter:

```output
offset:   0   1   2   3   4   5   6   7   8   9
        +---+---+---+---+---+---+---+---+---+---+
        | x | x | x | x | x | x | x | x | . | . |
        +---+---+---+---+---+---+---+---+---+---+
          ^           ^                   ^       ^
   log start     committed           high        log end
    offset        offset           watermark     offset
   (earliest)   (a group's        (last safe    (next offset
                 position)          + 1)         to write)
```

| Offset | Meaning | How to see it |
|--------|---------|---------------|
| **Log start offset** | The oldest offset still stored. Moves forward with retention and `kafka-delete-records`. | `kafka-get-offsets.sh --time -2` |
| **High watermark** | Messages below it are on all in-sync replicas: *committed*. Consumers only ever see messages below it. | `kafka-get-offsets.sh --time -1` (what `-1` returns) |
| **Log end offset** | The offset the next message will get, on the leader. Equal to the high watermark when all replicas are caught up. | `LOG-END-OFFSET` in `kafka-consumer-groups.sh` |
| **Committed offset** | Where a consumer group will resume: the offset of the *next* message to read, per partition. Stored in `__consumer_offsets`. | `CURRENT-OFFSET` in `kafka-consumer-groups.sh` |
| **Lag** | High watermark minus committed offset: how far the group is behind. | `LAG` in `kafka-consumer-groups.sh` |

## Exercise 6.1 · Latest vs beginning

**Task:** start a console consumer on `orders` without any options and wait 5 seconds. Then start one with `--from-beginning`. Why the difference?

!!! solution "Solution"
    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic orders --timeout-ms 5000
    ```

    ```output
    Processed a total of 0 messages
    ```

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic orders --from-beginning --max-messages 3
    ```

    ```output
    {"order":2001,"item":"keyboard","amount":45}
    {"order":2004,"item":"headset","amount":60}
    {"order":2007,"item":"cable","amount":9}
    Processed a total of 3 messages
    ```

    A new consumer with no committed offset starts according to `auto.offset.reset`. The default is `latest`: start at the end and wait for **new** messages - that is why the first one printed nothing. `--from-beginning` sets it to `earliest`.

    Useful stop conditions: `--max-messages N` exits after N messages; `--timeout-ms T` exits after T ms without a message. Without them the consumer runs until **Ctrl+C**.

!!! note "The banner you will see"
    Every console consumer in Kafka 4.3 first prints: *"The consumer rebalance protocol (KIP-848) is production-ready! Set group.protocol=consumer to try it out."* It is informational. Lab 7 tries the new protocol.

## Exercise 6.2 · Show everything a record carries

**Task:** print the first four messages of `orders` with their timestamp, partition, offset, headers and key, separated by ` | `.

!!! solution "Solution"
    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic orders --from-beginning --max-messages 4 \
      --formatter-property print.timestamp=true --formatter-property print.partition=true \
      --formatter-property print.offset=true --formatter-property print.headers=true \
      --formatter-property print.key=true --formatter-property key.separator=' | '
    ```

    ```output
    CreateTime:1790510023037 | Partition:0 | Offset:0 | NO_HEADERS | alice | {"order":2001,"item":"keyboard","amount":45}
    CreateTime:1790510023055 | Partition:0 | Offset:1 | NO_HEADERS | alice | {"order":2004,"item":"headset","amount":60}
    CreateTime:1790510023056 | Partition:0 | Offset:2 | NO_HEADERS | bob | {"order":2007,"item":"cable","amount":9}
    CreateTime:1790510023056 | Partition:0 | Offset:3 | NO_HEADERS | alice | {"order":2010,"item":"laptop stand","amount":55}
    ```

    | `--formatter-property` | Prints |
    |---|---|
    | `print.timestamp=true` | `CreateTime` (set by the producer) or `LogAppendTime` (set by the broker, if the topic says so), in epoch milliseconds |
    | `print.partition=true` / `print.offset=true` | Where the record lives |
    | `print.headers=true` | Headers as `name:value,...`, or `NO_HEADERS` |
    | `print.key=true` / `print.value=false` | Show the key / hide the value |
    | `key.separator` | Text between fields (default: tab) |
    | `null.literal` | What to print for a null key or value (default `null`) |

    `1790510023037` is milliseconds since 1970: 27 Sep 2026, 11:53:43 UTC.

## Exercise 6.3 · Read from an exact position

**Task:**

1. Read 2 messages from partition 1 of `orders`, starting at offset 1.
2. Read partition 2 from its earliest offset.

!!! solution "Solution"
    `--offset` needs `--partition`: an offset only means something inside one partition.

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic orders --partition 1 --offset 1 --max-messages 2 \
      --formatter-property print.offset=true --formatter-property print.key=true
    ```

    ```output
    Offset:1	frank	{"order":2006,"item":"dock","amount":140}
    Offset:2	dave	{"order":2008,"item":"chair","amount":320}
    Processed a total of 2 messages
    ```

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic orders --partition 2 --offset earliest --max-messages 3 \
      --formatter-property print.offset=true
    ```

    ```output
    Offset:0	{"order":2003,"item":"mouse","amount":18}
    Offset:1	{"order":2005,"item":"webcam","amount":75}
    Offset:2	{"order":2009,"item":"desk lamp","amount":35}
    Processed a total of 3 messages
    ```

    `--offset` accepts a number, `earliest` or `latest`. Reading a partition directly like this uses **no consumer group** and commits nothing - ideal for inspecting data or replaying one partition by hand.

## Exercise 6.4 · The offsets of a topic

**Task:** find the earliest offset, the latest offset, and the offset of the message with the highest timestamp in each partition of `orders`.

!!! solution "Solution"
    ```kafka
    kafka-get-offsets.sh --bootstrap-server kafka1:9092 --topic orders --time -2
    kafka-get-offsets.sh --bootstrap-server kafka1:9092 --topic orders --time -1
    kafka-get-offsets.sh --bootstrap-server kafka1:9092 --topic orders --time -3
    ```

    ```output
    orders:0:0
    orders:1:0
    orders:2:0
    ---
    orders:0:6
    orders:1:3
    orders:2:3
    ---
    orders:0:5
    orders:1:1
    orders:2:2
    ```

    | `--time` | Name | Returns |
    |----------|------|---------|
    | `-2` | `earliest` | The log start offset |
    | `-1` | `latest` (default) | The high watermark - the next offset to be read |
    | `-3` | `max-timestamp` | The offset of the record with the largest timestamp |
    | `-4` | `earliest-local` | The earliest offset still on the broker's disk (differs only with tiered storage) |
    | `-5` | `latest-tiered` | The last offset copied to remote storage (tiered storage) |
    | `-6` | `earliest-pending-upload` | The first offset not yet copied to remote storage (tiered storage) |
    | *epoch ms* | | The first offset whose timestamp is at or after that time (uses the time index - Lab 9) |

    The names work too: `--time earliest` is the same as `--time -2`.

    Partition 0 holds offsets 0-5: six messages (alice x3, bob, and grace x2).

## Exercise 6.5 · Consumer properties and committed offsets

**Task:** use `/lab/config/consumer.properties` to read 5 messages from `orders`. Which group did it use, and what did it commit?

!!! solution "Solution"
    ```kafka
    grep -v '^#' /lab/config/consumer.properties | grep .
    ```

    ```output
    client.id=lab-consumer
    group.id=orders-reporting
    auto.offset.reset=earliest
    enable.auto.commit=true
    auto.commit.interval.ms=5000
    max.poll.records=100
    isolation.level=read_committed
    ```

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic orders \
      --command-config /lab/config/consumer.properties --max-messages 5 --formatter-property print.key=true
    ```

    ```output
    alice	{"order":2001,"item":"keyboard","amount":45}
    alice	{"order":2004,"item":"headset","amount":60}
    bob	{"order":2007,"item":"cable","amount":9}
    alice	{"order":2010,"item":"laptop stand","amount":55}
    grace	{"order":2011,"item":"pen","amount":3}
    Processed a total of 5 messages
    ```

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group orders-reporting
    ```

    ```output
    Consumer group 'orders-reporting' has no active members.

    GROUP            TOPIC   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID  HOST  CLIENT-ID
    orders-reporting orders  0          5               6               1    -            -     -
    orders-reporting orders  1          0               3               3    -            -     -
    orders-reporting orders  2          0               3               3    -            -     -
    ```

    - The group committed **5** for partition 0: it read offsets 0-4, so the *next* message it needs is offset 5. A committed offset always points at the next message, never the last one read.
    - It read nothing from partitions 1 and 2 before `--max-messages 5` stopped it, so it committed their starting position, 0.
    - `LAG` is how much is left: 1 + 3 + 3 = 7 messages. Run the same command again and it resumes exactly there.

The consumer settings you will tune most:

| Setting | Default | Meaning |
|---------|---------|---------|
| `group.id` | (none) | The consumer group. Without it there are no commits and no partition sharing. |
| `auto.offset.reset` | `latest` | Where to start when the group has no committed offset (or it is out of range): `earliest`, `latest` or `none` (throw an error) |
| `enable.auto.commit` | `true` | Commit automatically in the background ... |
| `auto.commit.interval.ms` | 5000 | ... every 5 s. Turn auto-commit off to commit only after processing. |
| `max.poll.records` | 500 | Records returned by one `poll()` |
| `max.poll.interval.ms` | 300000 | If `poll()` is not called for this long, the consumer is thrown out of the group |
| `session.timeout.ms` | 45000 | No heartbeat for this long = consumer considered dead (classic protocol) |
| `fetch.min.bytes` / `fetch.max.wait.ms` | 1 / 500 | Wait for this much data, or this long, before a fetch returns |
| `isolation.level` | `read_uncommitted` | `read_committed` hides messages from aborted or open transactions |
| `group.protocol` | `classic` | `consumer` selects the new KIP-848 rebalance protocol (Lab 7) |

!!! note "Where do `--command-config` settings go?"
    `--command-config FILE` and `--command-property key=value` pass any consumer setting. The console consumer's own options - `--group`, `--from-beginning`, `--isolation-level` - are shortcuts for some of them.

## Exercise 6.6 · Several topics at once

**Task:** read from both `orders` and `payments` with one consumer.

!!! solution "Solution"
    `--include` takes a regular expression instead of `--topic`:

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --include 'orders|payments' --from-beginning \
      --max-messages 30 --timeout-ms 8000 --formatter-property print.partition=true | grep -c Partition
    ```

    ```output
    22
    ```

    12 messages from `orders` plus 10 from `payments` (at that point in the labs). This is the same regex subscription a Java consumer does with `subscribe(Pattern)`: topics created later that match are picked up automatically.

## Check yourself

1. A group's `CURRENT-OFFSET` for a partition is 120 and `LOG-END-OFFSET` is 150. Which offset will it read next, and what is its lag?
2. A new consumer group reads a topic that holds a year of data, and the team wants only new messages. Which setting matters?
3. Retention deleted offsets 0-999. A group's committed offset is 500. What happens when it starts?

!!! solution "Answers"
    1. Offset 120; lag 30.
    2. `auto.offset.reset=latest` (the default) - it only applies because the group has no committed offset yet.
    3. Offset 500 is out of range, so the consumer applies `auto.offset.reset`: `earliest` jumps to 1000 (the new log start), `latest` to the end, `none` throws an error.
