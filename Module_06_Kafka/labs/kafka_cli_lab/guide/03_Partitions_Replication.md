# Lab 3 · Partitions and Replication

**Goal:** see how keys map to partitions, where each copy of a partition lives, what happens when a broker dies, how `min.insync.replicas` protects your data, and how to move replicas around.

## Exercise 3.1 · Keys decide the partition

**Task:** load the 10 sample orders from `/lab/data/orders.txt` into `orders`, using the customer name before the `:` as the key. Then read them back showing each message's partition. What do you notice?

!!! solution "Solution"
    The file on Windows is `lab\data\orders.txt`; inside the container it is `/lab/data/orders.txt`:

    ```kafka
    cat /lab/data/orders.txt
    ```

    ```output
    alice:{"order":2001,"item":"keyboard","amount":45}
    dave:{"order":2002,"item":"monitor","amount":210}
    carol:{"order":2003,"item":"mouse","amount":18}
    alice:{"order":2004,"item":"headset","amount":60}
    erin:{"order":2005,"item":"webcam","amount":75}
    frank:{"order":2006,"item":"dock","amount":140}
    bob:{"order":2007,"item":"cable","amount":9}
    dave:{"order":2008,"item":"chair","amount":320}
    carol:{"order":2009,"item":"desk lamp","amount":35}
    alice:{"order":2010,"item":"laptop stand","amount":55}
    ```

    Feed the file to the console producer. `parse.key=true` splits each line at `key.separator` into key and value:

    ```kafka
    kafka-console-producer.sh --bootstrap-server kafka1:9092 --topic orders \
      --reader-property parse.key=true --reader-property key.separator=: \
      < /lab/data/orders.txt
    ```

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic orders --from-beginning --max-messages 10 \
      --formatter-property print.partition=true --formatter-property print.key=true
    ```

    ```output
    Partition:0	alice	{"order":2001,"item":"keyboard","amount":45}
    Partition:0	alice	{"order":2004,"item":"headset","amount":60}
    Partition:0	bob	{"order":2007,"item":"cable","amount":9}
    Partition:0	alice	{"order":2010,"item":"laptop stand","amount":55}
    Partition:1	dave	{"order":2002,"item":"monitor","amount":210}
    Partition:1	frank	{"order":2006,"item":"dock","amount":140}
    Partition:1	dave	{"order":2008,"item":"chair","amount":320}
    Partition:2	carol	{"order":2003,"item":"mouse","amount":18}
    Partition:2	erin	{"order":2005,"item":"webcam","amount":75}
    Partition:2	carol	{"order":2009,"item":"desk lamp","amount":35}
    Processed a total of 10 messages
    ```

    - **Every message with the same key is in the same partition**, in the order it was written: all of alice's orders are in partition 0, in order 2001, 2004, 2010.
    - Different keys can share a partition (alice and bob).
    - The consumer reads partition by partition here, so the output is *not* in the original file order. Order is guaranteed **within a partition only**.

    The Java producer chooses the partition as `murmur2(key) mod 3` - the same rule in every Java client, so the same key always lands in the same place.

## Exercise 3.2 · Where do the copies live?

**Task:** list the partition directories for `orders` and `pinned` on each broker. Compare with `--describe`.

!!! solution "Solution"
    Run the same command in each container (from PowerShell):

    ```powershell
    docker exec kafka1 bash -c "hostname; ls -d /var/lib/kafka/data/orders-* /var/lib/kafka/data/pinned-*"
    docker exec kafka2 bash -c "hostname; ls -d /var/lib/kafka/data/orders-* /var/lib/kafka/data/pinned-*"
    docker exec kafka3 bash -c "hostname; ls -d /var/lib/kafka/data/orders-* /var/lib/kafka/data/pinned-*"
    ```

    ```output
    kafka1
    /var/lib/kafka/data/orders-0
    /var/lib/kafka/data/orders-1
    /var/lib/kafka/data/orders-2
    /var/lib/kafka/data/pinned-0
    /var/lib/kafka/data/pinned-2
    kafka2
    /var/lib/kafka/data/orders-0
    /var/lib/kafka/data/orders-1
    /var/lib/kafka/data/orders-2
    /var/lib/kafka/data/pinned-0
    /var/lib/kafka/data/pinned-1
    kafka3
    /var/lib/kafka/data/orders-0
    /var/lib/kafka/data/orders-1
    /var/lib/kafka/data/orders-2
    /var/lib/kafka/data/pinned-1
    /var/lib/kafka/data/pinned-2
    ```

    - `orders` has replication factor 3 on 3 brokers, so **every broker has every partition**.
    - `pinned` (replication factor 2) matches its `Replicas` column exactly: partition 0 on brokers 1 and 2, partition 1 on 2 and 3, partition 2 on 3 and 1.
    - A replica is simply a directory named `<topic>-<partition>` on a broker's disk. Leaders and followers look identical on disk.

## Exercise 3.3 · A broker fails

**Task:** create `strict-payments` (1 partition, replication factor 3, `min.insync.replicas=3`). Then stop broker 2 and answer:

1. What happens to the leaders and the ISR of `orders`?
2. Which partitions are under-replicated? Which are below their minimum ISR? Which are exactly at it?
3. Can you still write to `orders` with `acks=all`? To `strict-payments`?

!!! solution "Solution"
    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic strict-payments \
      --partitions 1 --replication-factor 3 --config min.insync.replicas=3
    ```

    Stop broker 2 **from PowerShell** (not inside a container):

    ```powershell
    docker stop kafka2
    ```

    Wait about 10 seconds, then back in `kafka1`:

    **1 - Leaders and ISR:**

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic orders
    ```

    ```output
    Topic: orders  TopicId: ywkgJzfISRGP0UN2q1Y88A  PartitionCount: 3  ReplicationFactor: 3  Configs: min.insync.replicas=2
        Topic: orders  Partition: 0  Leader: 3  Replicas: 3,1,2  Isr: 3,1  Elr:   LastKnownElr:
        Topic: orders  Partition: 1  Leader: 1  Replicas: 1,2,3  Isr: 1,3  Elr:   LastKnownElr:
        Topic: orders  Partition: 2  Leader: 3  Replicas: 2,3,1  Isr: 3,1  Elr:   LastKnownElr:
    ```

    - Broker 2 was the leader of partition 2. The controller **elected broker 3** (the next in-sync replica) as the new leader, automatically, within seconds.
    - Broker 2 dropped out of **every** ISR. `Replicas` does not change - broker 2 still *should* hold a copy; it just is not in sync.

    **2 - The health filters.** Adding `--exclude-internal` hides the 50 partitions of `__consumer_offsets`, which are also affected:

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --under-replicated-partitions --exclude-internal
    ```

    ```output
        Topic: orders           Partition: 0  Leader: 3  Replicas: 3,1,2  Isr: 3,1  Elr:    LastKnownElr:
        Topic: orders           Partition: 1  Leader: 1  Replicas: 1,2,3  Isr: 1,3  Elr:    LastKnownElr:
        Topic: orders           Partition: 2  Leader: 3  Replicas: 2,3,1  Isr: 3,1  Elr:    LastKnownElr:
        Topic: pinned           Partition: 0  Leader: 1  Replicas: 1,2    Isr: 1    Elr: 2  LastKnownElr:
        Topic: pinned           Partition: 1  Leader: 3  Replicas: 2,3    Isr: 3    Elr: 2  LastKnownElr:
        Topic: audit-log        Partition: 0  Leader: 1  Replicas: 1,2,3  Isr: 1,3  Elr:    LastKnownElr:
        ...
        Topic: strict-payments  Partition: 0  Leader: 1  Replicas: 1,2,3  Isr: 1,3  Elr: 2  LastKnownElr:
        Topic: payments         Partition: 0  Leader: 3  Replicas: 2,3,1  Isr: 3,1  Elr:    LastKnownElr:
        ...
    ```

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --under-min-isr-partitions
    ```

    ```output
        Topic: pinned           Partition: 0  Leader: 1  Replicas: 1,2    Isr: 1    Elr: 2  LastKnownElr:
        Topic: pinned           Partition: 1  Leader: 3  Replicas: 2,3    Isr: 3    Elr: 2  LastKnownElr:
        Topic: strict-payments  Partition: 0  Leader: 1  Replicas: 1,2,3  Isr: 1,3  Elr: 2  LastKnownElr:
    ```

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --at-min-isr-partitions --topic orders
    ```

    ```output
        Topic: orders  Partition: 0  Leader: 3  Replicas: 3,1,2  Isr: 3,1  Elr:   LastKnownElr:
        Topic: orders  Partition: 1  Leader: 1  Replicas: 1,2,3  Isr: 1,3  Elr:   LastKnownElr:
        Topic: orders  Partition: 2  Leader: 3  Replicas: 2,3,1  Isr: 3,1  Elr:   LastKnownElr:
    ```

    - `orders` has 2 in-sync copies and needs 2: **at** the minimum - still writable, but one more failure stops `acks=all` writes.
    - `pinned` (2 copies, needs 2) and `strict-payments` (3 copies, needs 3) are **below** the minimum.
    - Broker 2 now appears under **`Elr`** for those partitions: when the ISR shrank below `min.insync.replicas`, Kafka kept note that broker 2 still holds all committed data and is eligible to lead again.

    **3 - Writing with `acks=all`:**

    ```kafka
    echo 'grace:{"order":2011,"item":"pen","amount":3}' | kafka-console-producer.sh \
      --bootstrap-server kafka1:9092 --topic orders \
      --reader-property parse.key=true --reader-property key.separator=: \
      --command-property acks=all
    echo "exit code: $?"
    ```

    ```output
    exit code: 0
    ```

    ```kafka
    echo 'payment-1' | kafka-console-producer.sh --bootstrap-server kafka1:9092 --topic strict-payments \
      --command-property acks=all --command-property delivery.timeout.ms=10000 --command-property request.timeout.ms=5000
    ```

    ```output
    [2026-09-27 11:55:03,951] ERROR Error when sending message to topic strict-payments with key: null, value: 9 bytes with error: (org.apache.kafka.clients.producer.internals.ErrorLoggingCallback)
    org.apache.kafka.common.errors.NotEnoughReplicasException: Messages are rejected since there are fewer in-sync replicas than required.
    ```

    That is `min.insync.replicas` doing its job: the broker **refuses** an `acks=all` write it cannot store on enough copies, instead of accepting it and risking its loss.

!!! note "What about `acks=1`?"
    `min.insync.replicas` only applies to `acks=all`. With `acks=1` the write to `strict-payments` is accepted by the leader:

    ```kafka
    echo 'payment-1' | kafka-console-producer.sh --bootstrap-server kafka1:9092 --topic strict-payments --command-property acks=1
    kafka-get-offsets.sh --bootstrap-server kafka1:9092 --topic strict-payments
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic strict-payments --from-beginning --timeout-ms 5000
    ```

    ```output
    strict-payments:0:0
    Processed a total of 0 messages
    ```

    The message is on the leader's disk, yet the partition still reports offset 0 and consumers see nothing. In Kafka 4.x the **high watermark** - the point up to which data counts as committed and is shown to consumers - only moves while the ISR is at least `min.insync.replicas`. The message becomes visible when broker 2 is back (next exercise). `acks=1` did not make the write safe; it only hid the problem from the producer.

The KRaft quorum noticed too. Node 2 is a controller voter, and it stopped fetching:

```kafka
kafka-metadata-quorum.sh --bootstrap-server kafka1:9092 describe --replication
```

```output
NodeId  DirectoryId             LogEndOffset  Lag  LastFetchTimestamp  LastCaughtUpTimestamp  Status
1       AAAAAAAAAAAAAAAAAAAAAA  755           0    1790510114975       1790510114975          Leader
2       AAAAAAAAAAAAAAAAAAAAAA  -1            756  -1                  -1                     Follower
3       AAAAAAAAAAAAAAAAAAAAAA  755           0    1790510114711       1790510114711          Follower
```

!!! warning "Do not stop two brokers in this lab"
    Each node here is also a controller, and Raft needs a majority - 2 of 3 - to change metadata. With two nodes down the cluster cannot elect leaders or create topics. (Production clusters avoid this by running the controllers separately.)

## Exercise 3.4 · The broker comes back

**Task:** start broker 2 again. Check the ISR of `orders`, the `strict-payments` message from the note above, and who leads each partition. Then put leadership back where it belongs.

!!! solution "Solution"
    ```powershell
    docker start kafka2
    ```

    Wait until `docker compose ps` shows kafka2 as *healthy*, then:

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic orders
    ```

    ```output
    Topic: orders  TopicId: ywkgJzfISRGP0UN2q1Y88A  PartitionCount: 3  ReplicationFactor: 3  Configs: min.insync.replicas=2
        Topic: orders  Partition: 0  Leader: 3  Replicas: 3,1,2  Isr: 1,2,3  Elr:   LastKnownElr:
        Topic: orders  Partition: 1  Leader: 1  Replicas: 1,2,3  Isr: 1,2,3  Elr:   LastKnownElr:
        Topic: orders  Partition: 2  Leader: 3  Replicas: 2,3,1  Isr: 1,2,3  Elr:   LastKnownElr:
    ```

    Broker 2 copied what it missed (including grace's order) from the leaders and rejoined every ISR. The `strict-payments` message is now committed:

    ```kafka
    kafka-get-offsets.sh --bootstrap-server kafka1:9092 --topic strict-payments
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic strict-payments --from-beginning --max-messages 1
    ```

    ```output
    strict-payments:0:1
    payment-1
    Processed a total of 1 messages
    ```

    But partition 2 is still led by broker 3, although its preferred leader (first in `Replicas`) is broker 2. Broker 3 now leads two partitions and broker 2 none. Rebalance leadership with a **preferred leader election**:

    ```kafka
    kafka-leader-election.sh --bootstrap-server kafka1:9092 --election-type preferred --all-topic-partitions
    ```

    ```output
    Successfully completed leader election (PREFERRED) for partitions __consumer_offsets-47, __consumer_offsets-48, __consumer_offsets-16, pinned-1, audit-log-5, __consumer_offsets-14, payments-5, __consumer_offsets-11, payments-0, ..., orders-2, ...
    ```

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic orders
    ```

    ```output
        Topic: orders  Partition: 0  Leader: 3  Replicas: 3,1,2  Isr: 1,2,3
        Topic: orders  Partition: 1  Leader: 1  Replicas: 1,2,3  Isr: 1,2,3
        Topic: orders  Partition: 2  Leader: 2  Replicas: 2,3,1  Isr: 1,2,3
    ```

    Each broker leads one `orders` partition again. Brokers do this on their own every few minutes (`auto.leader.rebalance.enable=true`, checked every `leader.imbalance.check.interval.seconds=300`); the command just does it now. To target one partition instead of all, use `--topic orders --partition 2`.

## Exercise 3.5 · Increase the replication factor

**Task:** create `legacy-events` with 2 partitions and replication factor 1 (a common mistake). Give it replication factor 3 without losing data.

!!! solution "Solution"
    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic legacy-events --partitions 2 --replication-factor 1
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic legacy-events
    ```

    ```output
    Created topic legacy-events.
    Topic: legacy-events  TopicId: amXgW7CNSq2ArG2NHX68eg  PartitionCount: 2  ReplicationFactor: 1  Configs: min.insync.replicas=2
        Topic: legacy-events  Partition: 0  Leader: 3  Replicas: 3  Isr: 3
        Topic: legacy-events  Partition: 1  Leader: 1  Replicas: 1  Isr: 1
    ```

    There is no `--replication-factor` option for `--alter`. Instead you describe the new replica lists in a JSON file and hand it to `kafka-reassign-partitions.sh`. The lab has one ready:

    ```kafka
    cat /lab/config/increase-rf.json
    ```

    ```output
    {
      "version": 1,
      "partitions": [
        { "topic": "legacy-events", "partition": 0, "replicas": [1, 2, 3] },
        { "topic": "legacy-events", "partition": 1, "replicas": [2, 3, 1] }
      ]
    }
    ```

    **Execute** - Kafka starts copying the partitions to the new brokers in the background:

    ```kafka
    kafka-reassign-partitions.sh --bootstrap-server kafka1:9092 \
      --reassignment-json-file /lab/config/increase-rf.json --execute
    ```

    ```output
    Current partition replica assignment

    {"version":1,"partitions":[{"topic":"legacy-events","partition":0,"replicas":[3],"log_dirs":["/var/lib/kafka/data"]},{"topic":"legacy-events","partition":1,"replicas":[1],"log_dirs":["/var/lib/kafka/data"]}]}

    Save this to use as the --reassignment-json-file option during rollback
    Successfully started partition reassignments for legacy-events-0,legacy-events-1
    ```

    **Verify** - run until every partition says *completed*:

    ```kafka
    kafka-reassign-partitions.sh --bootstrap-server kafka1:9092 \
      --reassignment-json-file /lab/config/increase-rf.json --verify
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic legacy-events
    ```

    ```output
    Status of partition reassignment:
    Reassignment of partition legacy-events-0 is completed.
    Reassignment of partition legacy-events-1 is completed.

    Clearing broker-level throttles on brokers 1,2,3
    Clearing topic-level throttles on topic legacy-events
    Topic: legacy-events  TopicId: amXgW7CNSq2ArG2NHX68eg  PartitionCount: 2  ReplicationFactor: 3  Configs: min.insync.replicas=2
        Topic: legacy-events  Partition: 0  Leader: 3  Replicas: 1,2,3  Isr: 1,2,3
        Topic: legacy-events  Partition: 1  Leader: 1  Replicas: 2,3,1  Isr: 1,2,3
    ```

    The leaders did not change during the move (broker 3 still leads partition 0), so clients were never interrupted. A preferred leader election (Exercise 3.4) would now hand partition 0 to broker 1 and partition 1 to broker 2.

!!! tip "Let Kafka propose a plan"
    For big moves - emptying a broker before retiring it, for example - `--generate` writes the JSON for you. Here it proposes moving `pinned` onto brokers 1 and 3 only:

    ```kafka
    echo '{"version":1,"topics":[{"topic":"pinned"}]}' > /tmp/topics.json
    kafka-reassign-partitions.sh --bootstrap-server kafka1:9092 \
      --topics-to-move-json-file /tmp/topics.json --broker-list 1,3 --generate
    ```

    ```output
    Current partition replica assignment
    {"version":1,"partitions":[{"topic":"pinned","partition":0,"replicas":[1,2],...},{"topic":"pinned","partition":1,"replicas":[2,3],...},{"topic":"pinned","partition":2,"replicas":[3,1],...}]}

    Proposed partition reassignment configuration
    {"version":1,"partitions":[{"topic":"pinned","partition":0,"replicas":[3,1],"log_dirs":["any","any"]},{"topic":"pinned","partition":1,"replicas":[1,3],"log_dirs":["any","any"]},{"topic":"pinned","partition":2,"replicas":[1,3],"log_dirs":["any","any"]}]}
    ```

    Save the proposal to a file and run it with `--execute`, as above. On a busy cluster, add `--throttle 50000000` (bytes/second) so the copying does not starve your clients.

## Check yourself

1. A partition shows `Replicas: 2,3,1  Isr: 3,1`. Which broker is the preferred leader, and is it serving the partition?
2. With `min.insync.replicas=2` and replication factor 3, how many brokers can fail before `acks=all` writes stop?
3. Why did `docker stop kafka2` not lose any committed data?

!!! solution "Answers"
    1. Broker 2 is the preferred leader (first in `Replicas`). It is not in the ISR, so it cannot be the leader right now; broker 3 or 1 is.
    2. One. With one broker down, 2 copies are still in sync (enough). With two down, only 1 is left and `acks=all` writes fail with `NotEnoughReplicasException`.
    3. Every committed message was already on at least two brokers (`min.insync.replicas=2`), and the controller only elects leaders from the in-sync replicas.
