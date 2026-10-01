# Lab 7 · Consumer Groups

**Goal:** run several consumers in one group and watch Kafka share the partitions between them, rebalance when members come and go, track lag, reset offsets, and look at the internal topic where it is all stored.

!!! note "Open four terminals"
    This lab runs several consumers at the same time. Open four PowerShell windows in the lab folder. Terminals A, B and C run consumers; terminal D runs the admin commands (`docker exec -it kafka1 bash`).

## Exercise 7.1 · One consumer, all partitions

**Task:** start one console consumer in group `orders-app` with client ID `app-1`. Describe the group: its members and its offsets.

!!! solution "Solution"
    **Terminal A:**

    ```powershell
    docker exec -it kafka1 kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic orders `
      --group orders-app --command-property client.id=app-1 `
      --formatter-property print.partition=true --formatter-property print.key=true
    ```

    (In PowerShell the backtick `` ` `` continues a line.) The consumer waits for new messages.

    **Terminal D:**

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group orders-app --members --verbose
    ```

    ```output
    GROUP       CONSUMER-ID                                 HOST          CLIENT-ID  #PARTITIONS  CURRENT-ASSIGNMENT
    orders-app  app-1-20cddbc5-1f06-4544-bab3-65dbc0787af2  /172.21.0.2   app-1      3            orders:0,1,2
    ```

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group orders-app
    ```

    ```output
    GROUP       TOPIC   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID                                 HOST          CLIENT-ID
    orders-app  orders  0          6               6               0    app-1-20cddbc5-1f06-4544-bab3-65dbc0787af2  /172.21.0.2   app-1
    orders-app  orders  1          3               3               0    app-1-20cddbc5-1f06-4544-bab3-65dbc0787af2  /172.21.0.2   app-1
    orders-app  orders  2          3               3               0    app-1-20cddbc5-1f06-4544-bab3-65dbc0787af2  /172.21.0.2   app-1
    ```

    - One member owns all three partitions.
    - The group is new, so it started at `latest` (the default `auto.offset.reset`) and committed that position: `LAG 0`, nothing printed.
    - The `CONSUMER-ID` is the client ID plus a random suffix, given by the group coordinator.

## Exercise 7.2 · Scale out to three consumers

**Task:** start two more consumers in the same group - `app-2` on `kafka2` and `app-3` on `kafka3`. Describe the members again. Then produce three orders for heidi, ivan and judy and see which consumer prints what.

!!! solution "Solution"
    **Terminal B** and **Terminal C:**

    ```powershell
    docker exec -it kafka2 kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic orders `
      --group orders-app --command-property client.id=app-2 `
      --formatter-property print.partition=true --formatter-property print.key=true
    ```

    ```powershell
    docker exec -it kafka3 kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic orders `
      --group orders-app --command-property client.id=app-3 `
      --formatter-property print.partition=true --formatter-property print.key=true
    ```

    **Terminal D:**

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group orders-app --members --verbose
    ```

    ```output
    GROUP       CONSUMER-ID                                 HOST          CLIENT-ID  #PARTITIONS  CURRENT-ASSIGNMENT
    orders-app  app-2-fc658f39-b846-4075-aca8-6cfd73036b7d  /172.21.0.3   app-2      1            orders:1
    orders-app  app-3-5a516243-b444-475c-9f77-e5a8f060ba58  /172.21.0.4   app-3      1            orders:2
    orders-app  app-1-20cddbc5-1f06-4544-bab3-65dbc0787af2  /172.21.0.2   app-1      1            orders:0
    ```

    When `app-2` and `app-3` joined, the group **rebalanced**: `app-1` gave up partitions 1 and 2, and each member now owns exactly one. Each partition is read by **exactly one** member of the group - that is how a group shares work without reading anything twice.

    ```kafka
    printf 'heidi:{"order":2013,"item":"ssd","amount":90}\nivan:{"order":2014,"item":"ram","amount":70}\njudy:{"order":2015,"item":"fan","amount":25}\n' \
      | kafka-console-producer.sh --bootstrap-server kafka1:9092 --topic orders \
        --reader-property parse.key=true --reader-property key.separator=:
    ```

    **Terminal B (app-2)** prints:

    ```output
    Partition:1	heidi	{"order":2013,"item":"ssd","amount":90}
    ```

    **Terminal C (app-3)** prints:

    ```output
    Partition:2	ivan	{"order":2014,"item":"ram","amount":70}
    Partition:2	judy	{"order":2015,"item":"fan","amount":25}
    ```

    Terminal A (app-1, partition 0) prints nothing: none of the three keys hashes to partition 0.

## Exercise 7.3 · A fourth consumer

**Task:** start a fourth consumer, `app-4`, in the group (in another terminal, on `kafka1`). What does it get? Check the group's state.

!!! solution "Solution"
    ```powershell
    docker exec -it kafka1 kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic orders `
      --group orders-app --command-property client.id=app-4
    ```

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group orders-app --members --verbose
    ```

    ```output
    GROUP       CONSUMER-ID                                 HOST          CLIENT-ID  #PARTITIONS  CURRENT-ASSIGNMENT
    orders-app  app-2-fc658f39-b846-4075-aca8-6cfd73036b7d  /172.21.0.3   app-2      1            orders:1
    orders-app  app-4-df6fa62f-f346-411a-841b-044d924c7078  /172.21.0.2   app-4      0            -
    orders-app  app-3-5a516243-b444-475c-9f77-e5a8f060ba58  /172.21.0.4   app-3      1            orders:2
    orders-app  app-1-20cddbc5-1f06-4544-bab3-65dbc0787af2  /172.21.0.2   app-1      1            orders:0
    ```

    `app-4` has **no partitions**: a partition cannot be split between members, so a group can use at most as many consumers as the topic has partitions. The extra one waits as a hot standby.

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group orders-app --state
    ```

    ```output
    GROUP       COORDINATOR (ID)   ASSIGNMENT-STRATEGY  STATE   #MEMBERS
    orders-app  kafka1:9092  (1)   range                Stable  4
    ```

    | Field | Meaning |
    |-------|---------|
    | `COORDINATOR` | The broker managing this group - the leader of the `__consumer_offsets` partition that stores the group (Exercise 7.8) |
    | `ASSIGNMENT-STRATEGY` | How partitions were split. `range` is the Java consumer's first default choice. |
    | `STATE` | `Stable` (working), `PreparingRebalance` / `CompletingRebalance` (rebalancing), `Empty` (no members but offsets kept), `Dead` (being removed) |

## Exercise 7.4 · A consumer fails

**Task:** stop `app-2` (Ctrl+C in terminal B). What happens to partition 1?

!!! solution "Solution"
    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group orders-app --members --verbose
    ```

    ```output
    GROUP       CONSUMER-ID                                 HOST          CLIENT-ID  #PARTITIONS  CURRENT-ASSIGNMENT
    orders-app  app-4-df6fa62f-f346-411a-841b-044d924c7078  /172.21.0.2   app-4      1            orders:2
    orders-app  app-3-5a516243-b444-475c-9f77-e5a8f060ba58  /172.21.0.4   app-3      1            orders:1
    orders-app  app-1-20cddbc5-1f06-4544-bab3-65dbc0787af2  /172.21.0.2   app-1      1            orders:0
    ```

    The group rebalanced again and the standby `app-4` was put to work. With the classic protocol and the `range` assignor, **every** member's assignment is recalculated - here `app-3` moved from partition 2 to partition 1, and `app-4` took partition 2. The new consumer continues from the last **committed** offset of each partition, so nothing is lost. Messages processed but not yet committed before the failure are read again (at-least-once).

    A clean stop (Ctrl+C) leaves the group at once. A crashed consumer is only noticed after `session.timeout.ms` (45 s) without heartbeats.

## Exercise 7.5 · Lag

**Task:** stop **all** the consumers. Produce 300 messages to `orders`, then describe the group.

!!! solution "Solution"
    Press Ctrl+C in every consumer terminal. Then in terminal D:

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group orders-app --state
    ```

    ```output
    Consumer group 'orders-app' has no active members.

    GROUP       COORDINATOR (ID)   ASSIGNMENT-STRATEGY  STATE  #MEMBERS
    orders-app  kafka1:9092  (1)   -                    Empty  0
    ```

    ```kafka
    kafka-producer-perf-test.sh --bootstrap-server kafka1:9092 --topic orders --num-records 300 --record-size 50 \
      --throughput -1 --command-property acks=all
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group orders-app
    ```

    ```output
    300 records sent, 560.747664 records/sec (0.03 MB/sec), 29.39 ms avg latency, 492.00 ms max latency, ...

    Consumer group 'orders-app' has no active members.

    GROUP       TOPIC   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID  HOST  CLIENT-ID
    orders-app  orders  0          6               6               0    -            -     -
    orders-app  orders  1          4               4               0    -            -     -
    orders-app  orders  2          5               305             300  -            -     -
    ```

    - The group is **Empty** but its committed offsets are kept (for 7 days, `offsets.retention.minutes`), so it can resume later.
    - All 300 messages went to partition 2: the perf-test messages have no key, and the sticky partitioner filled one partition. Its **LAG is 300**.
    - Lag is *the* health metric for consumers. Growing lag means the group cannot keep up: add consumers (up to the number of partitions) or make processing faster.

## Exercise 7.6 · Reset offsets

**Task:** the team wants to reprocess `orders`. With the group stopped:

1. Preview a reset to the earliest offsets, then do it.
2. Move partition 0 forward by 3.
3. Skip everything - jump to the latest offsets.
4. Set partition 1 to offset 1.
5. Preview a reset to "10 minutes ago", both by duration and by date-time.
6. Try a reset while a consumer is running.

!!! solution "Solution"
    Every reset needs a scope (`--topic`, `--topic orders:0` for one partition, or `--all-topics`), a target, and either `--dry-run` (show only) or `--execute`.

    **1 - Earliest.** Always dry-run first:

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --group orders-app --topic orders \
      --reset-offsets --to-earliest --dry-run
    ```

    ```output
    GROUP       TOPIC   PARTITION  NEW-OFFSET
    orders-app  orders  0          0
    orders-app  orders  1          0
    orders-app  orders  2          0
    ```

    Replace `--dry-run` with `--execute` to apply it - the output is the same table.

    **2 - Shift one partition** (`orders:0` means partition 0 only; a negative number moves back):

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --group orders-app --topic orders:0 \
      --reset-offsets --shift-by 3 --execute
    ```

    ```output
    GROUP       TOPIC   PARTITION  NEW-OFFSET
    orders-app  orders  0          3
    ```

    **3 - Latest** (skip the backlog):

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --group orders-app --all-topics \
      --reset-offsets --to-latest --execute
    ```

    ```output
    GROUP       TOPIC   PARTITION  NEW-OFFSET
    orders-app  orders  0          6
    orders-app  orders  1          4
    orders-app  orders  2          305
    ```

    **4 - An exact offset:**

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --group orders-app --topic orders:1 \
      --reset-offsets --to-offset 1 --execute
    ```

    ```output
    GROUP       TOPIC   PARTITION  NEW-OFFSET
    orders-app  orders  1          1
    ```

    **5 - By time.** `--by-duration` takes an ISO-8601 duration (`PT10M` = 10 minutes, `P1D` = 1 day); `--to-datetime` takes `YYYY-MM-DDTHH:mm:SS.sss` (UTC, or add a zone like `+05:30`):

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --group orders-app --topic orders \
      --reset-offsets --by-duration PT10M --dry-run
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --group orders-app --topic orders \
      --reset-offsets --to-datetime 2026-09-27T12:00:00.000 --dry-run
    ```

    ```output
    GROUP       TOPIC   PARTITION  NEW-OFFSET
    orders-app  orders  0          5
    orders-app  orders  1          3
    orders-app  orders  2          3
    ```

    Kafka uses each partition's **time index** (Lab 9) to find the first message at or after that moment: the 300 perf-test messages and the latest orders.

    **6 - While the group is running** (start a consumer in terminal A first):

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --group orders-app --topic orders \
      --reset-offsets --to-earliest --execute
    ```

    ```output
    Error: Assignments can only be reset if the group 'orders-app' is inactive, but the current state is Stable.
    ```

    Offsets can only be reset while the group is **Empty** - otherwise the running consumers would overwrite them with their next commit. Stop the consumers first.

    Other targets: `--to-current` (commit the current position), `--from-file` (a CSV of `topic,partition,offset`), and `--export` to save a plan as CSV.

## Exercise 7.7 · Delete offsets and groups

**Task:** remove `orders-reporting`'s offsets for `orders`, then delete the whole `orders-app` group.

!!! solution "Solution"
    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --delete-offsets --group orders-reporting --topic orders
    ```

    ```output
    Request succeeded for deleting offsets from group orders-reporting.

    TOPIC   PARTITION  STATUS
    orders  0          Successful
    orders  1          Successful
    orders  2          Successful
    ```

    Deleting a group that still has members fails:

    ```output
    Error: Deletion of some consumer groups failed:
    * Group 'orders-app' could not be deleted due to: org.apache.kafka.common.errors.GroupNotEmptyException: The group is not empty.
    ```

    With every consumer stopped:

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --delete --group orders-app
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --list
    ```

    ```output
    Deletion of requested consumer groups ('orders-app') was successful.
    console-consumer-15844
    orders-reporting
    console-consumer-83412
    console-consumer-50275
    ```

    The `console-consumer-NNNNN` groups were created by earlier console consumers run *without* `--group`: the tool invents a group name each time. They are harmless and expire after 7 days without members.

## Exercise 7.8 · Where offsets live: `__consumer_offsets`

**Task:** find the internal topic that stores committed offsets, and read the raw commit records of group `orders-reporting`.

!!! solution "Solution"
    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic __consumer_offsets | head -4
    ```

    ```output
    Topic: __consumer_offsets  TopicId: nmQYx_6ZThG2B5qpu-IUSw  PartitionCount: 50  ReplicationFactor: 3  Configs: compression.type=producer,min.insync.replicas=2,cleanup.policy=compact,segment.bytes=104857600
        Topic: __consumer_offsets  Partition: 0  Leader: 1  Replicas: 1,2,3  Isr: 1,2,3
        Topic: __consumer_offsets  Partition: 1  Leader: 2  Replicas: 2,3,1  Isr: 1,2,3
        Topic: __consumer_offsets  Partition: 2  Leader: 3  Replicas: 3,1,2  Isr: 1,2,3
    ```

    - 50 partitions, replication factor 3, **compacted** (Lab 4): only the latest commit per group + topic + partition is kept.
    - It was created automatically the first time a consumer group committed.
    - A group lives in partition `abs(hashCode(group.id)) % 50`. For `orders-reporting` that is partition **44**. The leader of that partition is the group's **coordinator**.

    The console consumer can decode it with a special formatter. The formatter prints the records one after another **without line breaks**, so `sed` splits them before `grep` picks out our group:

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic __consumer_offsets --from-beginning \
      --formatter org.apache.kafka.tools.consumer.OffsetsMessageFormatter --timeout-ms 8000 2>/dev/null \
      | sed 's/}{"key"/}\n{"key"/g' | grep '"group":"orders-reporting"'
    ```

    ```output
    {"key":{"type":1,"data":{"group":"orders-reporting","topic":"orders","partition":0}},"value":{"version":4,"data":{"offset":5,"leaderEpoch":-1,"metadata":"","commitTimestamp":1790510722450,"topicId":"ywkgJzfISRGP0UN2q1Y88A"}}}
    {"key":{"type":1,"data":{"group":"orders-reporting","topic":"orders","partition":1}},"value":{"version":4,"data":{"offset":0,"leaderEpoch":-1,"metadata":"","commitTimestamp":1790510722450,"topicId":"ywkgJzfISRGP0UN2q1Y88A"}}}
    {"key":{"type":1,"data":{"group":"orders-reporting","topic":"orders","partition":2}},"value":{"version":4,"data":{"offset":0,"leaderEpoch":-1,"metadata":"","commitTimestamp":1790510722450,"topicId":"ywkgJzfISRGP0UN2q1Y88A"}}}
    {"key":{"type":1,"data":{"group":"orders-reporting","topic":"orders","partition":0}},"value":null}
    {"key":{"type":1,"data":{"group":"orders-reporting","topic":"orders","partition":1}},"value":null}
    {"key":{"type":1,"data":{"group":"orders-reporting","topic":"orders","partition":2}},"value":null}
    ```

    - The first three records are the commits from Exercise 6.5: offsets 5, 0, 0.
    - The last three have `"value":null` - **tombstones** written by `--delete-offsets` in Exercise 7.7. Compaction will remove both the commits and the tombstones.
    - Key `type:1` is an offset commit; `type:2` records hold group metadata (members and assignment). Lab 8 decodes this topic straight from the file.

## Exercise 7.9 · The new consumer protocol (KIP-848)

**Task:** run two consumers in group `orders-v2` with `group.protocol=consumer`. Compare the group with a classic one.

!!! solution "Solution"
    In two terminals:

    ```powershell
    docker exec -it kafka1 kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic orders `
      --group orders-v2 --command-property group.protocol=consumer --command-property client.id=v2-1
    ```

    ```powershell
    docker exec -it kafka1 kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic orders `
      --group orders-v2 --command-property group.protocol=consumer --command-property client.id=v2-2
    ```

    ```kafka
    kafka-groups.sh --bootstrap-server kafka1:9092 --list
    ```

    ```output
    GROUP                   TYPE      PROTOCOL
    console-consumer-15844  Classic   consumer
    orders-v2               Consumer  consumer
    orders-reporting        Classic   consumer
    ```

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group orders-v2 --members --verbose
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group orders-v2 --state
    ```

    ```output
    GROUP      CONSUMER-ID             HOST          CLIENT-ID  #PARTITIONS  CURRENT-EPOCH  CURRENT-ASSIGNMENT  TARGET-EPOCH  TARGET-ASSIGNMENT
    orders-v2  qiXasRWeQ_-BzAC9z77bcw  /172.21.0.2   v2-1       2            3              orders:0,1          3             orders:0,1
    orders-v2  zeFSFJpbQOewIausgTNLHA  /172.21.0.2   v2-2       1            3              orders:2            3             orders:2

    GROUP      COORDINATOR (ID)   ASSIGNMENT-STRATEGY  STATE   #MEMBERS
    orders-v2  kafka3:9092  (3)   uniform              Stable  2
    ```

    | | Classic protocol | New consumer protocol (KIP-848) |
    |---|---|---|
    | Who assigns partitions | The group leader - one of the consumers | The **broker** (group coordinator) |
    | Rebalance | Stop-the-world: every member pauses and rejoins | **Incremental**: only the partitions that move are paused |
    | Epochs | - | `CURRENT-EPOCH` / `TARGET-EPOCH` show each member converging on the target assignment |
    | Default assignor | `range` (client side) | `uniform` (server side) |
    | Enable | default | `group.protocol=consumer` in the consumer (Kafka 4.0+) |

    `kafka-groups.sh` is the newer tool that lists every kind of group: `Classic` and `Consumer` groups, and also `Share` and `Streams` groups.

## Check yourself

1. A topic has 6 partitions. How many consumers in one group can do useful work? What do the others do?
2. Two applications must both process every order. How do you configure them?
3. Why must a group be `Empty` before you reset its offsets?

!!! solution "Answers"
    1. Six, one partition each. Extra members get no partitions and wait as standbys.
    2. Give them **different** `group.id`s. Each group gets every message; within a group, each message goes to one member.
    3. Active members hold their own positions and commit them regularly; they would overwrite the reset straight away.
