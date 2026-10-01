# Lab 4 · Segments, Retention and Compaction

**Goal:** see that a partition is not one file but a chain of **segments**, watch new segments being created, and watch old data leave through **retention**, **record deletion** and **compaction**.

## Background: what a partition looks like on disk

A partition directory holds one or more **segments**. Each segment is a set of files that share a name - the **base offset**, the first offset in that segment, padded to 20 digits:

| File | Holds |
|------|-------|
| `00000000000000004992.log` | The messages themselves, in record batches (Lab 8) |
| `00000000000000004992.index` | Offset index: offset -> byte position in the `.log` (Lab 9) |
| `00000000000000004992.timeindex` | Time index: timestamp -> offset (Lab 9) |
| `00000000000000004992.snapshot` | Producer state (producer IDs and sequence numbers) at this point, for idempotence |
| `leader-epoch-checkpoint` | Which leader epoch started at which offset - used to truncate diverged replicas |
| `partition.metadata` | The topic ID this directory belongs to |

Only the newest segment - the **active segment** - is written to. A new segment is **rolled** when the active one reaches `segment.bytes` (default 1 GB) or gets older than `segment.ms` (default 7 days). Retention and compaction only ever touch **closed** segments.

## Exercise 4.1 · Watch segments roll

**Task:** create `segments-demo` with one partition on broker 1 and `segment.bytes=1048576` (1 MB, the minimum). Write 20,000 messages of 200 bytes and list the partition directory before and after.

!!! solution "Solution"
    `--replica-assignment 1` means *one partition, one replica, on broker 1* - so we know exactly where the files are:

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic segments-demo \
      --replica-assignment 1 --config segment.bytes=1048576
    ls -l /var/lib/kafka/data/segments-demo-0/
    ```

    ```output
    Created topic segments-demo.
    -rw-r--r-- 1 appuser appuser 10485760 Sep 27 11:57 00000000000000000000.index
    -rw-r--r-- 1 appuser appuser        0 Sep 27 11:57 00000000000000000000.log
    -rw-r--r-- 1 appuser appuser 10485756 Sep 27 11:57 00000000000000000000.timeindex
    -rw-r--r-- 1 appuser appuser        8 Sep 27 11:57 leader-epoch-checkpoint
    -rw-r--r-- 1 appuser appuser       43 Sep 27 11:57 partition.metadata
    ```

    An empty partition already has one segment: an empty `.log`, and index files **pre-allocated** at 10 MB (`segment.index.bytes`) so they can be memory-mapped at a fixed size.

    `kafka-producer-perf-test.sh` is the quickest way to write a lot of data. `--throughput -1` means "as fast as possible":

    ```kafka
    kafka-producer-perf-test.sh --bootstrap-server kafka1:9092 --topic segments-demo \
      --num-records 20000 --record-size 200 --throughput -1 \
      --command-property acks=1 linger.ms=5
    ```

    ```output
    20000 records sent, 14970.059880 records/sec (2.86 MB/sec), 202.15 ms avg latency, 593.00 ms max latency, 208 ms 50th, 401 ms 95th, 419 ms 99th, 430 ms 99.9th.
    ```

    ```kafka
    ls -l /var/lib/kafka/data/segments-demo-0/
    ```

    ```output
    -rw-r--r-- 1 appuser appuser      504 Sep 27 11:58 00000000000000000000.index
    -rw-r--r-- 1 appuser appuser  1048128 Sep 27 11:58 00000000000000000000.log
    -rw-r--r-- 1 appuser appuser      684 Sep 27 11:58 00000000000000000000.timeindex
    -rw-r--r-- 1 appuser appuser      504 Sep 27 11:58 00000000000000004992.index
    -rw-r--r-- 1 appuser appuser  1048128 Sep 27 11:58 00000000000000004992.log
    -rw-r--r-- 1 appuser appuser       10 Sep 27 11:58 00000000000000004992.snapshot
    -rw-r--r-- 1 appuser appuser      660 Sep 27 11:58 00000000000000004992.timeindex
    -rw-r--r-- 1 appuser appuser      504 Sep 27 11:58 00000000000000009984.index
    -rw-r--r-- 1 appuser appuser  1048128 Sep 27 11:58 00000000000000009984.log
    -rw-r--r-- 1 appuser appuser       10 Sep 27 11:58 00000000000000009984.snapshot
    -rw-r--r-- 1 appuser appuser      624 Sep 27 11:58 00000000000000009984.timeindex
    -rw-r--r-- 1 appuser appuser      504 Sep 27 11:58 00000000000000014976.index
    -rw-r--r-- 1 appuser appuser  1048128 Sep 27 11:58 00000000000000014976.log
    -rw-r--r-- 1 appuser appuser       10 Sep 27 11:58 00000000000000014976.snapshot
    -rw-r--r-- 1 appuser appuser      600 Sep 27 11:58 00000000000000014976.timeindex
    -rw-r--r-- 1 appuser appuser 10485760 Sep 27 11:58 00000000000000019968.index
    -rw-r--r-- 1 appuser appuser     6749 Sep 27 11:58 00000000000000019968.log
    -rw-r--r-- 1 appuser appuser       10 Sep 27 11:58 00000000000000019968.snapshot
    -rw-r--r-- 1 appuser appuser 10485756 Sep 27 11:58 00000000000000019968.timeindex
    -rw-r--r-- 1 appuser appuser        8 Sep 27 11:57 leader-epoch-checkpoint
    -rw-r--r-- 1 appuser appuser       43 Sep 27 11:57 partition.metadata
    ```

    Read it carefully:

    - **Five segments.** Each closed `.log` stopped just under 1 MB (1,048,128 bytes): the next batch would not have fitted, so Kafka rolled a new segment.
    - **The names are offsets.** The second segment starts at offset 4992, so the first one holds offsets 0-4991: 4,992 messages of ~210 bytes each on disk.
    - **Closed segments have small indexes.** When a segment is rolled, its index files are trimmed to their real size (504 bytes = 63 entries of 8 bytes). Only the **active** segment (19968) still has the pre-allocated 10 MB index.
    - `.snapshot` files appear when a segment rolls; they record producer state so that idempotent producers can be checked after a restart.

    Now check the offsets and the total size:

    ```kafka
    kafka-get-offsets.sh --bootstrap-server kafka1:9092 --topic segments-demo --time -2
    kafka-get-offsets.sh --bootstrap-server kafka1:9092 --topic segments-demo --time -1
    kafka-log-dirs.sh --bootstrap-server kafka1:9092 --describe --topic-list segments-demo --broker-list 1 | tail -1
    ```

    ```output
    segments-demo:0:0
    segments-demo:0:20000
    {"brokers":[{"broker":1,"logDirs":[{"partitions":[{"partition":"segments-demo-0","size":4199261,"offsetLag":0,"isFuture":false}],"error":null,"logDir":"/var/lib/kafka/data"}]}],"version":1}
    ```

    `--time -2` is the **log start offset** (earliest), `--time -1` the **log end offset** (latest). The partition holds offsets 0-19999, about 4.2 MB.

!!! note "Rolling by time"
    `segment.ms` rolls a segment when its *first* message is older than the limit - but only when the next message arrives. A topic that receives nothing never rolls. `segment.jitter.ms` adds a random delay so that thousands of partitions do not all roll at the same moment.

## Exercise 4.2 · Retention by size

**Task:** limit `segments-demo` to about 2 MB per partition with `retention.bytes`. Watch what happens on disk over the next two minutes, and find the new earliest offset.

!!! solution "Solution"
    ```kafka
    kafka-configs.sh --bootstrap-server kafka1:9092 --alter --entity-type topics --entity-name segments-demo \
      --add-config retention.bytes=2097152
    ```

    ```output
    Completed updating config for topic segments-demo.
    ```

    Wait 30-40 seconds (the lab cluster checks retention every 30 s; the default is every 5 minutes):

    ```kafka
    ls -l /var/lib/kafka/data/segments-demo-0/ | grep -E "log|deleted"
    ```

    ```output
    -rw-r--r-- 1 appuser appuser      504 Sep 27 11:58 00000000000000000000.index.deleted
    -rw-r--r-- 1 appuser appuser  1048128 Sep 27 11:58 00000000000000000000.log.deleted
    -rw-r--r-- 1 appuser appuser      684 Sep 27 11:58 00000000000000000000.timeindex.deleted
    -rw-r--r-- 1 appuser appuser      504 Sep 27 11:58 00000000000000004992.index.deleted
    -rw-r--r-- 1 appuser appuser  1048128 Sep 27 11:58 00000000000000004992.log.deleted
    -rw-r--r-- 1 appuser appuser       10 Sep 27 11:58 00000000000000004992.snapshot.deleted
    -rw-r--r-- 1 appuser appuser      660 Sep 27 11:58 00000000000000004992.timeindex.deleted
    -rw-r--r-- 1 appuser appuser  1048128 Sep 27 11:58 00000000000000009984.log
    -rw-r--r-- 1 appuser appuser  1048128 Sep 27 11:58 00000000000000014976.log
    -rw-r--r-- 1 appuser appuser     6749 Sep 27 11:58 00000000000000019968.log
    ```

    The broker log explains the decision:

    ```kafka
    grep -h "segments-demo-0.*Deleting segment" /opt/kafka/logs/server.log*
    ```

    ```output
    [2026-09-27 11:59:04,025] INFO [UnifiedLog partition=segments-demo-0, dir=/var/lib/kafka/data] Deleting segment LogSegment(baseOffset=0, size=1048128, ...) due to log retention size 2097152 breach. Log size after deletion will be 3151133.
    [2026-09-27 11:59:04,025] INFO [UnifiedLog partition=segments-demo-0, dir=/var/lib/kafka/data] Deleting segment LogSegment(baseOffset=4992, size=1048128, ...) due to log retention size 2097152 breach. Log size after deletion will be 2103005.
    ```

    ```kafka
    kafka-get-offsets.sh --bootstrap-server kafka1:9092 --topic segments-demo --time -2
    ```

    ```output
    segments-demo:0:9984
    ```

    About a minute later the `.deleted` files are gone:

    ```kafka
    ls -l /var/lib/kafka/data/segments-demo-0/ | grep -E "\.log"
    ```

    ```output
    -rw-r--r-- 1 appuser appuser  1048128 Sep 27 11:58 00000000000000009984.log
    -rw-r--r-- 1 appuser appuser  1048128 Sep 27 11:58 00000000000000014976.log
    -rw-r--r-- 1 appuser appuser     6749 Sep 27 11:58 00000000000000019968.log
    ```

    What happened, step by step:

    1. The retention check found the partition at 4.2 MB, over the 2 MB limit.
    2. It deleted **whole segments, oldest first**, as long as the partition stayed at or above the limit afterwards (4.2 -> 3.15 -> 2.10 MB). Deleting a third would have taken it below 2 MB, so it stopped. Retention never deletes part of a segment.
    3. The **log start offset** moved to 9984, the base offset of the oldest remaining segment. A consumer asking for offset 5000 now gets an "offset out of range" and follows its `auto.offset.reset` setting.
    4. The files were first renamed to `.deleted`, then removed after `file.delete.delay.ms` (60 s), so that any reader still using them can finish.

!!! note "Retention by time"
    `retention.ms` works the same way: a closed segment is deleted when its **newest** message is older than `retention.ms`. Data therefore lives *at least* as long as the retention period, and up to one segment's lifetime longer. Setting both `retention.ms` and `retention.bytes` deletes a segment when either limit is exceeded.

## Exercise 4.3 · Delete records up to an offset

**Task:** a bad batch of messages sits at the start of `segments-demo`. Delete everything before offset 12000 - right now, without waiting for retention.

!!! solution "Solution"
    `kafka-delete-records.sh` takes a JSON file listing, per partition, the first offset to **keep**:

    ```kafka
    echo '{"partitions":[{"topic":"segments-demo","partition":0,"offset":12000}],"version":1}' > /tmp/delete.json
    kafka-delete-records.sh --bootstrap-server kafka1:9092 --offset-json-file /tmp/delete.json
    ```

    ```output
    Executing records delete operation
    Records delete operation completed:
    partition: segments-demo-0	low_watermark: 12000
    ```

    ```kafka
    kafka-get-offsets.sh --bootstrap-server kafka1:9092 --topic segments-demo --time -2
    ls -l /var/lib/kafka/data/segments-demo-0/ | grep -E "\.log"
    ```

    ```output
    segments-demo:0:12000
    -rw-r--r-- 1 appuser appuser  1048128 Sep 27 11:58 00000000000000009984.log
    -rw-r--r-- 1 appuser appuser  1048128 Sep 27 11:58 00000000000000014976.log
    -rw-r--r-- 1 appuser appuser     6749 Sep 27 11:58 00000000000000019968.log
    ```

    The log start offset (the *low watermark*) is now 12000, although segment `9984` is still on disk: offset 12000 is in the middle of it. Offsets 9984-11999 are logically deleted - no consumer can read them - and the file goes away once retention finds a segment entirely below the log start offset. Offsets are never reused: the next message is still offset 20000.

## Exercise 4.4 · Log compaction

**Task:** create a compacted topic `customer-profile` that keeps only the latest profile per customer. Write several updates for the same customers and a delete, force a segment roll, and compare what a consumer sees before and after compaction.

!!! solution "Solution"
    Compaction is switched on with `cleanup.policy=compact`. To see it in minutes rather than days, the lab also rolls segments every 10 s (`segment.ms`), cleans as soon as 1 % of the log is "dirty" (`min.cleanable.dirty.ratio`), and keeps delete markers for only 10 s (`delete.retention.ms`):

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic customer-profile --replica-assignment 1 \
      --config cleanup.policy=compact --config segment.ms=10000 \
      --config min.cleanable.dirty.ratio=0.01 --config delete.retention.ms=10000
    ```

    Write six updates. `null.marker=NULL` turns the text `NULL` into a real null value - a **tombstone**, which means "delete this key":

    ```kafka
    printf 'alice:{"city":"Chennai","tier":"silver"}\nbob:{"city":"Pune","tier":"gold"}\nalice:{"city":"Chennai","tier":"gold"}\ncarol:{"city":"Delhi","tier":"silver"}\nalice:{"city":"Bengaluru","tier":"gold"}\nbob:NULL\n' \
      | kafka-console-producer.sh --bootstrap-server kafka1:9092 --topic customer-profile \
        --reader-property parse.key=true --reader-property key.separator=: --reader-property null.marker=NULL
    ```

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic customer-profile --from-beginning --max-messages 6 \
      --formatter-property print.offset=true --formatter-property print.key=true
    ```

    ```output
    Offset:0	alice	{"city":"Chennai","tier":"silver"}
    Offset:1	bob	{"city":"Pune","tier":"gold"}
    Offset:2	alice	{"city":"Chennai","tier":"gold"}
    Offset:3	carol	{"city":"Delhi","tier":"silver"}
    Offset:4	alice	{"city":"Bengaluru","tier":"gold"}
    Offset:5	bob	null
    Processed a total of 6 messages
    ```

    Compaction never touches the active segment. Wait more than 10 s and write one more message, so that the segment holding offsets 0-5 is closed:

    ```kafka
    echo 'dave:{"city":"Mumbai","tier":"silver"}' | kafka-console-producer.sh --bootstrap-server kafka1:9092 \
      --topic customer-profile --reader-property parse.key=true --reader-property key.separator=:
    ```

    Within about 30 seconds the **log cleaner** runs:

    ```kafka
    ls -l /var/lib/kafka/data/customer-profile-0/ | grep -E "\.log"
    grep -h "customer-profile" /opt/kafka/logs/log-cleaner.log | tail -2
    ```

    ```output
    -rw-r--r-- 1 appuser appuser      167 Sep 27 12:00 00000000000000000000.log
    -rw-r--r-- 1 appuser appuser      290 Sep 27 12:00 00000000000000000000.log.deleted
    -rw-r--r-- 1 appuser appuser      105 Sep 27 12:01 00000000000000000006.log
    [2026-09-27 12:01:34,426] INFO Cleaner 0: Swapping in cleaned segment LogSegment(baseOffset=0, size=167, ...) for segment(s) [LogSegment(baseOffset=0, size=290, ...)] in log Log(dir=/var/lib/kafka/data/customer-profile-0, ...)
    	Log cleaner thread 0 cleaned log customer-profile-0 (dirty section = [0, 6])
    ```

    The cleaner wrote a new, smaller copy of segment 0 (290 -> 167 bytes) and swapped it in. Read the topic again:

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic customer-profile --from-beginning --timeout-ms 6000 \
      --formatter-property print.offset=true --formatter-property print.key=true
    ```

    ```output
    Offset:3	carol	{"city":"Delhi","tier":"silver"}
    Offset:4	alice	{"city":"Bengaluru","tier":"gold"}
    Offset:5	bob	null
    Offset:6	dave	{"city":"Mumbai","tier":"silver"}
    Processed a total of 4 messages
    ```

    - alice's two older profiles (offsets 0 and 2) are gone; only her **latest** value remains.
    - bob's first value (offset 1) is gone. His **tombstone** (offset 5) stays for `delete.retention.ms`, so that consumers who are behind still learn that bob was deleted. A later cleaning removes it too.
    - **Offsets do not change.** The surviving messages keep 3, 4, 5 - the log now has gaps, and consumers simply skip them.

!!! tip "Where compaction is used"
    Compacted topics are the "table" side of Kafka: the latest state per key, kept forever. Kafka itself keeps consumer offsets in the compacted topic `__consumer_offsets` (Lab 7). Kafka Connect keeps its configs, offsets and status the same way, and Kafka Streams keeps its state-store changelogs so.

## Check yourself

1. The newest file in a partition directory is `00000000000000734112.log`. What do you know from the name alone?
2. `retention.ms` is 1 day and `segment.ms` is 7 days on a quiet topic. How long can a message live?
3. Why must the active segment never be compacted or deleted?

!!! solution "Answers"
    1. It is the active segment, and its first message is offset 734112. Every older segment ends at 734111 or below.
    2. Up to about 8 days. Retention only deletes closed segments, and a segment only closes after 7 days (or 1 GB); then its newest message must be over 1 day old.
    3. It is still being written. Retention and the cleaner work on immutable, closed segments, so they never race with the producer's appends.
