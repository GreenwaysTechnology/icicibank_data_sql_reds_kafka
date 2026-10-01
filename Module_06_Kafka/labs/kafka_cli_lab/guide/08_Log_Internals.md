# Lab 8 · Inside the Log Files

**Goal:** open Kafka's `.log` files with `kafka-dump-log.sh` and understand exactly what is stored: record batches, records, producer IDs and sequence numbers, compression, tombstones - and the two internal logs, `__consumer_offsets` and `__cluster_metadata`.

`kafka-dump-log.sh` reads segment files **directly from disk**, so it must run on a broker that has a copy of the partition. Every broker has every `orders` partition, so we stay on `kafka1`.

## Exercise 8.1 · The files of one partition

**Task:** list the files of `orders` partition 0 and read the two small text files.

!!! solution "Solution"
    ```kafka
    ls -l /var/lib/kafka/data/orders-0/
    ```

    ```output
    -rw-r--r-- 1 appuser appuser 10485760 Sep 27 11:51 00000000000000000000.index
    -rw-r--r-- 1 appuser appuser      535 Sep 27 12:02 00000000000000000000.log
    -rw-r--r-- 1 appuser appuser 10485756 Sep 27 11:51 00000000000000000000.timeindex
    -rw-r--r-- 1 appuser appuser        8 Sep 27 11:53 leader-epoch-checkpoint
    -rw-r--r-- 1 appuser appuser       43 Sep 27 11:51 partition.metadata
    ```

    ```kafka
    cat /var/lib/kafka/data/orders-0/partition.metadata
    cat /var/lib/kafka/data/orders-0/leader-epoch-checkpoint
    ```

    ```output
    version: 0
    topic_id: ywkgJzfISRGP0UN2q1Y88A
    0
    1
    0 0
    ```

    - `partition.metadata` ties the directory to the **topic ID** (compare `kafka-topics.sh --describe`). If a topic is deleted and recreated with the same name, a leftover directory with the old ID is recognised as stale.
    - `leader-epoch-checkpoint`: format version `0`, then `1` entry, then `epoch 0 started at offset 0`. Each new leader of the partition adds a line. When a failed leader comes back, it uses these epochs to find where its log diverged from the new leader's and truncates the difference.
    - One segment only: 535 bytes of data - far from the 1 GB `segment.bytes` - so there is still one, active segment.

## Exercise 8.2 · Record batches

**Task:** dump the `orders-0` segment and explain each field of a batch.

!!! solution "Solution"
    ```kafka
    kafka-dump-log.sh --files /var/lib/kafka/data/orders-0/00000000000000000000.log
    ```

    ```output
    Dumping /var/lib/kafka/data/orders-0/00000000000000000000.log
    Log starting offset: 0
    baseOffset: 0 lastOffset: 3 count: 4 baseSequence: 0 lastSequence: 3 producerId: 0 producerEpoch: 0 partitionLeaderEpoch: 0 isTransactional: false isControl: false deleteHorizonMs: OptionalLong.empty position: 0 CreateTime: 1790510023056 size: 282 magic: 2 compresscodec: none crc: 123657965 isvalid: true
    baseOffset: 4 lastOffset: 4 count: 1 baseSequence: 0 lastSequence: 0 producerId: 1 producerEpoch: 0 partitionLeaderEpoch: 0 isTransactional: false isControl: false deleteHorizonMs: OptionalLong.empty position: 282 CreateTime: 1790510098947 size: 111 magic: 2 compresscodec: none crc: 570975783 isvalid: true
    baseOffset: 5 lastOffset: 5 count: 1 baseSequence: 0 lastSequence: 0 producerId: 7 producerEpoch: 0 partitionLeaderEpoch: 0 isTransactional: false isControl: false deleteHorizonMs: OptionalLong.empty position: 393 CreateTime: 1790510578789 size: 142 magic: 2 compresscodec: none crc: 2384294184 isvalid: true
    ```

    Kafka never stores single messages: it stores **record batches**. By default `kafka-dump-log.sh` prints one line per batch.

    | Field | Meaning | Here |
    |-------|---------|------|
    | `baseOffset` / `lastOffset` / `count` | Offsets of the first and last record in the batch, and how many | Batch 1 = offsets 0-3: the four `orders.txt` lines for this partition, sent together |
    | `producerId` / `producerEpoch` | ID the broker gave the (idempotent) producer, and its epoch | Three batches from three producer runs: IDs 0, 1 and 7 |
    | `baseSequence` / `lastSequence` | Per-producer, per-partition sequence numbers | The broker rejects a batch whose sequence it has already seen: this is how **idempotence** drops duplicate retries |
    | `partitionLeaderEpoch` | The leader epoch when the batch was written | 0 - these were written before any leader change |
    | `isTransactional` / `isControl` | Part of a transaction / a transaction commit or abort marker | No transactions here |
    | `deleteHorizonMs` | Set by compaction on batches holding tombstones | Empty (not a compacted topic) |
    | `position` | **Byte position** of the batch in the `.log` file | 0, 282, 393 - each batch starts where the previous one ended (0 + 282 = 282; 282 + 111 = 393) |
    | `CreateTime` | The batch's largest timestamp | |
    | `size` | Bytes on disk, including the 61-byte batch header | 282 + 111 + 142 = 535 = the file size |
    | `magic` | Record format version. 2 has been current since Kafka 0.11. | 2 |
    | `compresscodec` | How the batch is compressed | none |
    | `crc` / `isvalid` | CRC-32C checksum of the batch, and whether it matches | Kafka checks it on write and consumers check it on read |

## Exercise 8.3 · The records inside

**Task:** print the records too, with keys, values and headers.

!!! solution "Solution"
    ```kafka
    kafka-dump-log.sh --files /var/lib/kafka/data/orders-0/00000000000000000000.log --print-data-log
    ```

    ```output
    baseOffset: 0 lastOffset: 3 count: 4 baseSequence: 0 lastSequence: 3 producerId: 0 ... position: 0 CreateTime: 1790510023056 size: 282 magic: 2 compresscodec: none crc: 123657965 isvalid: true
    | offset: 0 CreateTime: 1790510023037 keySize: 5 valueSize: 44 sequence: 0 headerKeys: [] key: alice payload: {"order":2001,"item":"keyboard","amount":45}
    | offset: 1 CreateTime: 1790510023055 keySize: 5 valueSize: 43 sequence: 1 headerKeys: [] key: alice payload: {"order":2004,"item":"headset","amount":60}
    | offset: 2 CreateTime: 1790510023056 keySize: 3 valueSize: 40 sequence: 2 headerKeys: [] key: bob payload: {"order":2007,"item":"cable","amount":9}
    | offset: 3 CreateTime: 1790510023056 keySize: 5 valueSize: 48 sequence: 3 headerKeys: [] key: alice payload: {"order":2010,"item":"laptop stand","amount":55}
    baseOffset: 4 lastOffset: 4 count: 1 baseSequence: 0 lastSequence: 0 producerId: 1 ... position: 282 CreateTime: 1790510098947 size: 111 ...
    | offset: 4 CreateTime: 1790510098947 keySize: 5 valueSize: 38 sequence: 0 headerKeys: [] key: grace payload: {"order":2011,"item":"pen","amount":3}
    baseOffset: 5 lastOffset: 5 count: 1 baseSequence: 0 lastSequence: 0 producerId: 7 ... position: 393 CreateTime: 1790510578789 size: 142 ...
    | offset: 5 CreateTime: 1790510578789 keySize: 5 valueSize: 44 sequence: 0 headerKeys: [source,trace] key: grace payload: {"order":2012,"item":"notebook","amount":12}
    ```

    - Lines starting with `|` are **records** inside the batch above them.
    - `keySize` / `valueSize` are in bytes (`alice` = 5). A null key or value shows as `-1`.
    - `headerKeys: [source,trace]` - the headers from Exercise 5.3. (Header values are not printed.)
    - Each record keeps its own timestamp; the batch's `CreateTime` is the largest of them.
    - Inside the file, records store their offset and timestamp as **deltas** from the batch's base values. That is why batching saves space as well as network round trips.

## Exercise 8.4 · Compressed batches

**Task:** dump the gzip-compressed topic from Exercise 5.6, first as batches, then record by record.

!!! solution "Solution"
    ```kafka
    kafka-dump-log.sh --files /var/lib/kafka/data/comp-gzip-0/00000000000000000000.log | sed -n '1,4p'
    ```

    ```output
    Dumping /var/lib/kafka/data/comp-gzip-0/00000000000000000000.log
    Log starting offset: 0
    baseOffset: 0 lastOffset: 59 count: 60 baseSequence: 0 lastSequence: 59 producerId: 11 ... position: 0 CreateTime: 1790510641963 size: 1273 magic: 2 compresscodec: gzip crc: 3797260463 isvalid: true
    baseOffset: 60 lastOffset: 351 count: 292 baseSequence: 60 lastSequence: 351 producerId: 11 ... position: 1273 CreateTime: 1790510641991 size: 4523 magic: 2 compresscodec: gzip crc: 1264871835 isvalid: true
    ```

    The second batch holds **292 records in 4,523 bytes** - about 15 bytes per record, for JSON lines of about 110 bytes. `compresscodec: gzip` confirms the codec. The broker stored the producer's compressed batch unchanged.

    To see the records, the tool must decompress the batch. `--deep-iteration` does that (it is implied by `--print-data-log`):

    ```kafka
    kafka-dump-log.sh --files /var/lib/kafka/data/comp-gzip-0/00000000000000000000.log --deep-iteration --print-data-log | sed -n '1,5p'
    ```

    ```output
    Dumping /var/lib/kafka/data/comp-gzip-0/00000000000000000000.log
    Log starting offset: 0
    baseOffset: 0 lastOffset: 59 count: 60 ... compresscodec: gzip crc: 3797260463 isvalid: true
    | offset: 0 CreateTime: 1790510641932 keySize: -1 valueSize: 107 sequence: 0 headerKeys: [] payload: {"order": 3178, "customer": "cust-47", "item": "chair", "amount": 81, "city": "Delhi", "status": "CREATED"}
    | offset: 1 CreateTime: 1790510641956 keySize: -1 valueSize: 111 sequence: 1 headerKeys: [] payload: {"order": 3396, "customer": "cust-33", "item": "monitor", "amount": 32, "city": "Kolkata", "status": "CREATED"}
    ```

    `keySize: -1`: the perf-test producer sends no key.

## Exercise 8.5 · A compacted segment

**Task:** dump the compacted `customer-profile` segment from Exercise 4.4. How are deletions and removed offsets shown?

!!! solution "Solution"
    ```kafka
    kafka-dump-log.sh --files /var/lib/kafka/data/customer-profile-0/00000000000000000000.log --print-data-log
    ```

    ```output
    Dumping /var/lib/kafka/data/customer-profile-0/00000000000000000000.log
    Log starting offset: 0
    baseOffset: 0 lastOffset: 5 count: 3 baseSequence: 0 lastSequence: 5 producerId: 3 ... deleteHorizonMs: OptionalLong[1790510504371] position: 0 ... size: 167 ... compresscodec: none ...
    | offset: 3 CreateTime: 1790510459930 keySize: 5 valueSize: 32 sequence: 3 headerKeys: [] key: carol payload: {"city":"Delhi","tier":"silver"}
    | offset: 4 CreateTime: 1790510459930 keySize: 5 valueSize: 34 sequence: 4 headerKeys: [] key: alice payload: {"city":"Bengaluru","tier":"gold"}
    | offset: 5 CreateTime: 1790510459930 keySize: 3 valueSize: -1 sequence: 5 headerKeys: [] key: bob
    Non-consecutive offsets in /var/lib/kafka/data/customer-profile-0/00000000000000000000.log
      -1 is followed by 3
    ```

    - The batch still says `baseOffset: 0 lastOffset: 5`, but `count: 3`: the cleaner kept the batch's offset range and removed three records from inside it.
    - Offsets 0, 1 and 2 are simply missing. The tool warns about the gap ("-1 is followed by 3": the first record is 3). Gaps are normal in compacted topics.
    - bob's record has `valueSize: -1` and no payload: a **tombstone**.
    - `deleteHorizonMs` is now set: after that time (now + `delete.retention.ms`), the next cleaning may remove the tombstone as well.

## Exercise 8.6 · Decode `__consumer_offsets` from disk

**Task:** decode the partition of `__consumer_offsets` that holds group `orders-reporting` (partition 44, see Exercise 7.8).

!!! solution "Solution"
    `--offsets-decoder` turns the binary keys and values into JSON:

    ```kafka
    kafka-dump-log.sh --files /var/lib/kafka/data/__consumer_offsets-44/00000000000000000000.log --offsets-decoder \
      | grep orders-reporting | head -6
    ```

    ```output
    | offset: 4 ... key: {"type":"2","data":{"group":"orders-reporting"}} payload: {"version":"3","data":{"protocolType":"","generation":0,"protocol":null,"leader":null,"currentStateTimestamp":1790510722280,"members":[]}}
    | offset: 5 ... key: {"type":"2","data":{"group":"orders-reporting"}} payload: {"version":"3","data":{"protocolType":"consumer","generation":1,"protocol":"range","leader":"lab-consumer-1e03a0e7-...","members":[{"memberId":"lab-consumer-1e03a0e7-...","clientId":"lab-consumer","clientHost":"/172.21.0.2","rebalanceTimeout":300000,"sessionTimeout":45000,"subscription":{"topics":["orders"],...},"assignment":{"assignedPartitions":[{"topic":"orders","partitions":[0,1,2]}],...}}]}}
    | offset: 6 ... key: {"type":"1","data":{"group":"orders-reporting","topic":"orders","partition":0}} payload: {"version":"4","data":{"offset":5,"leaderEpoch":-1,"metadata":"","commitTimestamp":1790510722450,"topicId":"ywkgJzfISRGP0UN2q1Y88A"}}
    | offset: 7 ... key: {"type":"1","data":{"group":"orders-reporting","topic":"orders","partition":1}} payload: {"version":"4","data":{"offset":0,...}}
    | offset: 8 ... key: {"type":"1","data":{"group":"orders-reporting","topic":"orders","partition":2}} payload: {"version":"4","data":{"offset":0,...}}
    | offset: 9 ... key: {"type":"2","data":{"group":"orders-reporting"}} payload: {"version":"3","data":{"protocolType":"consumer","generation":2,"protocol":null,"leader":null,"members":[]}}
    ```

    This is the whole life of the console consumer from Exercise 6.5, written by the group coordinator:

    1. **offset 4** - group created, generation 0, no members.
    2. **offset 5** - generation 1: one member (`lab-consumer`), strategy `range`, assigned `orders` 0, 1, 2.
    3. **offsets 6-8** - the offset commits: 5, 0, 0 (the `CURRENT-OFFSET` column in Exercise 6.5).
    4. **offset 9** - generation 2: the consumer left; the group is empty.

    `type 1` = offset commit, `type 2` = group metadata. `kafka-consumer-groups.sh` simply reads the latest of these through the coordinator.

## Exercise 8.7 · Decode the cluster metadata log

**Task:** find the record that created the `orders` topic in the KRaft metadata log, and count the record types in it.

!!! solution "Solution"
    ```kafka
    kafka-dump-log.sh --files /var/lib/kafka/data/__cluster_metadata-0/00000000000000000000.log --cluster-metadata-decoder \
      | grep '"name":"orders"'
    ```

    ```output
    | offset: 111 CreateTime: 1790509878206 keySize: -1 valueSize: 27 sequence: -1 headerKeys: [] payload: {"type":"TOPIC_RECORD","version":0,"data":{"name":"orders","topicId":"ywkgJzfISRGP0UN2q1Y88A"}}
    ```

    ```kafka
    kafka-dump-log.sh --files /var/lib/kafka/data/__cluster_metadata-0/00000000000000000000.log --cluster-metadata-decoder \
      | grep -o '"type":"[A-Z_]*"' | sort | uniq -c | sort -rn
    ```

    ```output
       2464 "type":"NO_OP_RECORD"
        167 "type":"PARTITION_CHANGE_RECORD"
         90 "type":"PARTITION_RECORD"
         26 "type":"CONFIG_RECORD"
         20 "type":"TOPIC_RECORD"
         10 "type":"BROKER_REGISTRATION_CHANGE_RECORD"
          6 "type":"FEATURE_LEVEL_RECORD"
          4 "type":"REMOVE_TOPIC_RECORD"
          4 "type":"REGISTER_CONTROLLER_RECORD"
          4 "type":"REGISTER_BROKER_RECORD"
          1 "type":"PRODUCER_IDS_RECORD"
          1 "type":"END_TRANSACTION_RECORD"
          1 "type":"CLEAR_ELR_RECORD"
          1 "type":"BEGIN_TRANSACTION_RECORD"
    ```

    Everything you did in Labs 2-7 is here as records - the same *log* idea Kafka uses for your data:

    | Record | Written when ... |
    |--------|------------------|
    | `TOPIC_RECORD` + `PARTITION_RECORD` | A topic is created: one topic record, one partition record per partition (20 topics, 90 partitions so far) |
    | `PARTITION_CHANGE_RECORD` | A leader or the ISR changes - Lab 3's broker failure produced many |
    | `CONFIG_RECORD` | A config is set with `--config` or `kafka-configs.sh` |
    | `REMOVE_TOPIC_RECORD` | A topic is deleted |
    | `REGISTER_BROKER_RECORD` / `BROKER_REGISTRATION_CHANGE_RECORD` | A broker starts, or is fenced / unfenced |
    | `NO_OP_RECORD` | The active controller writes one regularly so that followers can tell it is alive |

!!! tip "Browse the metadata like a file system"
    `kafka-metadata-shell.sh` loads the metadata log into a tree you can `ls` and `cat`. It refuses to open a live broker's directory (it is locked), so work on a copy:

    ```kafka
    mkdir -p /tmp/meta
    cp /var/lib/kafka/data/__cluster_metadata-0/00000000000000000000.log /tmp/meta/
    kafka-metadata-shell.sh --snapshot /tmp/meta/00000000000000000000.log ls /image/topics/byName
    kafka-metadata-shell.sh --snapshot /tmp/meta/00000000000000000000.log cat /image/topics/byName/orders/0
    ```

    ```output
    __consumer_offsets
    audit-log
    ...
    orders
    payments
    ...
    PartitionRegistration(replicas=[3, 1, 2], directories=[HRx9RyH0pi-j8zhurmQcgA, W6ZXRWs45VFCVyxnSoUExg, 9-duCaGAc4VxlM-rPcTcMA], isr=[1, 2, 3], removingReplicas=[], addingReplicas=[], elr=[], lastKnownElr=[], leader=3, leaderRecoveryState=RECOVERED, leaderEpoch=0, partitionEpoch=2)
    ```

    Without a command at the end it opens an interactive shell (`ls`, `cd`, `cat`, `find`, `exit`).

## Other decoders

| Option | Decodes |
|--------|---------|
| `--offsets-decoder` | `__consumer_offsets` |
| `--transaction-log-decoder` | `__transaction_state` (transactional producers) |
| `--cluster-metadata-decoder` | `__cluster_metadata` |
| `--share-group-state-decoder` | `__share_group_state` (share groups) |
| `--remote-log-metadata-decoder` | `__remote_log_metadata` (tiered storage) |
| `--key-decoder-class` / `--value-decoder-class` | Your own topics, with a custom decoder class |

## Check yourself

1. A batch shows `baseOffset: 200 lastOffset: 249 count: 50 position: 81920 size: 3100`. Where does the next batch start in the file, and what is its base offset?
2. The same `producerId` and `baseSequence` arrive twice. What does the broker do, and why?
3. How can you prove, from disk alone, that a topic's data is compressed?

!!! solution "Answers"
    1. At byte position 85020 (81920 + 3100), with base offset 250 - unless the topic is compacted, where gaps are possible.
    2. It acknowledges the second one without writing it again: it is a retry of a batch it already has. This is producer idempotence.
    3. `kafka-dump-log.sh --files <segment>.log` shows `compresscodec:` on every batch, and `count` versus `size` shows how many records share how few bytes.
