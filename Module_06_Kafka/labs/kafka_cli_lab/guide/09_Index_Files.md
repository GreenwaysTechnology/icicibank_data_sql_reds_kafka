# Lab 9 · Index Files

**Goal:** understand how Kafka finds offset *N* - or the first message after time *T* - in a segment of a gigabyte without reading it from the start: the **offset index** (`.index`) and the **time index** (`.timeindex`).

## Background: two small lookup tables per segment

| File | Entry | Entry size | Answers |
|------|-------|-----------|---------|
| `.index` | (relative offset, byte position in `.log`) | 8 bytes: 4 + 4 | "Where in the file is offset N?" |
| `.timeindex` | (timestamp, relative offset) | 12 bytes: 8 + 4 | "Which offset is the first at or after time T?" |

Three design choices make them tiny and fast:

- **Sparse.** An entry is added only after about `index.interval.bytes` (4096) bytes of log have been written since the previous entry - not for every message. Kafka finds the nearest entry below the target, then scans a few KB of the log.
- **Relative offsets.** Offsets are stored as *offset minus the segment's base offset*, so they fit in 4 bytes.
- **Memory-mapped.** Index files are mapped into memory and searched with a binary search. Each is pre-allocated at `segment.index.bytes` (10 MB) while the segment is active and trimmed to its real size when the segment is rolled.

## Exercise 9.1 · Build two indexed segments

**Task:** create `index-demo` (defaults) and `index-dense` (`index.interval.bytes=512`), each with one partition on broker 1 and 1 MB segments. Write 12,000 messages of 100 bytes to each, in small batches, and compare the index files.

!!! solution "Solution"
    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic index-demo --replica-assignment 1 \
      --config segment.bytes=1048576
    kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic index-dense --replica-assignment 1 \
      --config segment.bytes=1048576 --config index.interval.bytes=512
    for t in index-demo index-dense; do
      kafka-producer-perf-test.sh --bootstrap-server kafka1:9092 --topic $t --num-records 12000 --record-size 100 \
        --throughput 4000 --command-property acks=1 linger.ms=0 batch.size=1024 | tail -1
    done
    ```

    ```output
    12000 records sent, 3985.386915 records/sec (0.38 MB/sec), 131.40 ms avg latency, ...
    12000 records sent, 3978.779841 records/sec (0.38 MB/sec), 76.54 ms avg latency, ...
    ```

    `batch.size=1024` and `linger.ms=0` force small batches (about 8 records each), so the index gets many entries to show.

    ```kafka
    ls -l /var/lib/kafka/data/index-demo-0/ /var/lib/kafka/data/index-dense-0/
    ```

    ```output
    /var/lib/kafka/data/index-demo-0/:
    -rw-r--r-- 1 appuser appuser     1832 Sep 27 12:12 00000000000000000000.index
    -rw-r--r-- 1 appuser appuser  1047947 Sep 27 12:12 00000000000000000000.log
    -rw-r--r-- 1 appuser appuser     2520 Sep 27 12:12 00000000000000000000.timeindex
    -rw-r--r-- 1 appuser appuser 10485760 Sep 27 12:12 00000000000000008932.index
    -rw-r--r-- 1 appuser appuser   363997 Sep 27 12:12 00000000000000008932.log
    -rw-r--r-- 1 appuser appuser       10 Sep 27 12:12 00000000000000008932.snapshot
    -rw-r--r-- 1 appuser appuser 10485756 Sep 27 12:12 00000000000000008932.timeindex
    ...
    /var/lib/kafka/data/index-dense-0/:
    -rw-r--r-- 1 appuser appuser     8480 Sep 27 12:12 00000000000000000000.index
    -rw-r--r-- 1 appuser appuser  1048067 Sep 27 12:12 00000000000000000000.log
    -rw-r--r-- 1 appuser appuser     7824 Sep 27 12:12 00000000000000000000.timeindex
    -rw-r--r-- 1 appuser appuser 10485760 Sep 27 12:12 00000000000000008904.index
    ...
    ```

    - The first segment of each topic is closed (rolled at ~1 MB), so its index was **trimmed**; the active segment still has the 10 MB pre-allocated files.
    - `index-demo`: **1,832 bytes / 8 = 229 entries** for a 1 MB log - one entry per ~4.6 KB.
    - `index-dense`: **8,480 bytes / 8 = 1,060 entries** - about 4.6 times as many (not 8 times: see Exercise 9.2).
    - Time index: 2,520 / 12 = 210 entries versus 7,824 / 12 = 652.

## Exercise 9.2 · Read the offset index

**Task:** dump the first entries of `index-demo`'s closed `.index` file, count its entries, and look at the raw bytes.

!!! solution "Solution"
    ```kafka
    kafka-dump-log.sh --files /var/lib/kafka/data/index-demo-0/00000000000000000000.index | head -8
    ```

    ```output
    Dumping /var/lib/kafka/data/index-demo-0/00000000000000000000.index
    offset: 47 position: 4665
    offset: 87 position: 9330
    offset: 127 position: 13995
    offset: 167 position: 18660
    offset: 207 position: 23325
    offset: 247 position: 27990
    offset: 287 position: 32655
    ```

    ```kafka
    for t in index-demo index-dense; do
      printf "%-12s entries in first .index: " $t
      kafka-dump-log.sh --files /var/lib/kafka/data/$t-0/00000000000000000000.index | grep -c "^offset"
    done
    ```

    ```output
    index-demo   entries in first .index: 229
    index-dense  entries in first .index: 1060
    ```

    Entries appear every 4,665 bytes and 40 offsets. Each batch here holds 8 records and takes 933 bytes (61-byte header + 8 records of about 109 bytes). After 5 batches (4,665 bytes) more than 4,096 bytes have been written since the last entry, so the 6th batch gets one. In `index-dense` every 933-byte batch crosses the 512-byte interval, so every batch after the first gets an entry (`offset: 15 position: 933`, `offset: 23 position: 1866`, ...).

    **The raw bytes** confirm the format - 4-byte relative offset, 4-byte position, big-endian:

    ```kafka
    xxd -l 48 /var/lib/kafka/data/index-demo-0/00000000000000000000.index
    ```

    ```output
    00000000: 0000 002f 0000 1239 0000 0057 0000 2472  .../...9...W..$r
    00000010: 0000 007f 0000 36ab 0000 00a7 0000 48e4  ......6.......H.
    00000020: 0000 00cf 0000 5b1d 0000 00f7 0000 6d56  ......[.......mV
    ```

    `0000002f` = 47 and `00001239` = 4665: the first entry. `00000057` = 87 and `00002472` = 9330: the second. The tool adds the segment's base offset (0 here) to the relative offset when printing.

## Exercise 9.3 · What does an entry point to?

**Task:** find the batches that start at positions 4665, 9330 and 13995 in the `.log`. What exactly does an index entry record?

!!! solution "Solution"
    ```kafka
    kafka-dump-log.sh --files /var/lib/kafka/data/index-demo-0/00000000000000000000.log \
      | grep -E 'position: (4665|9330|13995) '
    ```

    ```output
    baseOffset: 40 lastOffset: 47 count: 8 ... position: 4665
    baseOffset: 80 lastOffset: 87 count: 8 ... position: 9330
    baseOffset: 120 lastOffset: 127 count: 8 ... position: 13995
    ```

    An index entry maps **the last offset of a batch** to **the byte position where that batch starts**. Entry `offset: 47 position: 4665` means "the batch containing offset 47 (offsets 40-47) begins at byte 4665". Kafka always reads whole batches, so pointing at batch starts is all it needs.

## Exercise 9.4 · Follow a lookup by hand

**Task:** a consumer asks for offset 100 of `index-demo`. Work out, step by step, how the broker finds it. Then check your answer with a consumer.

!!! solution "Solution"
    **Step 1 - Pick the segment.** The segments' base offsets are in their file names:

    ```kafka
    ls /var/lib/kafka/data/index-demo-0/*.log
    ```

    ```output
    /var/lib/kafka/data/index-demo-0/00000000000000000000.log
    /var/lib/kafka/data/index-demo-0/00000000000000008932.log
    ```

    The segment with the largest base offset not above 100 is `00000000000000000000`. (The broker keeps all its segments in a sorted map by base offset, so this is a quick lookup.)

    **Step 2 - Search that segment's `.index`** for the largest entry at or below 100. From Exercise 9.2: `offset: 87 position: 9330` (the next entry, 127, is too big). This is a binary search over the memory-mapped file.

    **Step 3 - Scan the `.log` from byte 9330.** Read batch headers forward - `80-87`, `88-95`, `96-103` - until a batch contains offset 100, and send from there. At most `index.interval.bytes` (~4 KB) is scanned.

    **Check:**

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic index-demo --partition 0 --offset 100 \
      --max-messages 1 --formatter-property print.offset=true | cut -c1-60
    ```

    ```output
    Offset:100	JZMXBWWTXBSBCBKFECWDXOTAYJOWYFJGIIDWWRILUZAZAZPQJ
    Processed a total of 1 messages
    ```

    Kafka actually returns the *whole batch* 96-103, and the consumer drops the records before offset 100. The broker never parses individual records to serve a fetch - it copies byte ranges from the file straight to the network (zero-copy `sendfile`), which is a big part of why Kafka is fast.

## Exercise 9.5 · The time index

**Task:** dump the first entries of the `.timeindex`, then ask Kafka for the first offset at or after timestamp `1790511121235`.

!!! solution "Solution"
    ```kafka
    kafka-dump-log.sh --files /var/lib/kafka/data/index-demo-0/00000000000000000000.timeindex | head -8
    ```

    ```output
    Dumping /var/lib/kafka/data/index-demo-0/00000000000000000000.timeindex
    timestamp: 1790511121224 offset: 47
    timestamp: 1790511121229 offset: 87
    timestamp: 1790511121232 offset: 127
    timestamp: 1790511121235 offset: 159
    timestamp: 1790511121238 offset: 191
    timestamp: 1790511121240 offset: 231
    timestamp: 1790511121244 offset: 287
    ```

    Each entry records the **largest timestamp seen so far** in the segment and the offset of the record that had it. Entries are only added when the timestamp increases, so the file is always sorted by time - even if producers send records with slightly out-of-order timestamps.

    ```kafka
    kafka-get-offsets.sh --bootstrap-server kafka1:9092 --topic index-demo --time 1790511121235
    ```

    ```output
    index-demo:0:159
    ```

    The broker (1) picks the first segment whose largest timestamp is at or after T, (2) finds the time-index entry just below T, (3) uses the offset index to jump into the `.log`, and (4) scans for the first record with timestamp at or after T - offset 159.

    The same lookup is behind `kafka-consumer-groups.sh --reset-offsets --to-datetime / --by-duration` (Exercise 7.6), the Java consumer's `offsetsForTimes()`, and time-based retention, which uses each segment's largest timestamp.

## Exercise 9.6 · Check an index

**Task:** verify that the index of `index-demo`'s first segment is consistent.

!!! solution "Solution"
    ```kafka
    kafka-dump-log.sh --files /var/lib/kafka/data/index-demo-0/00000000000000000000.index --index-sanity-check
    kafka-dump-log.sh --files /var/lib/kafka/data/index-demo-0/00000000000000000000.index --verify-index-only
    ```

    ```output
    Dumping /var/lib/kafka/data/index-demo-0/00000000000000000000.index
    /var/lib/kafka/data/index-demo-0/00000000000000000000.index passed sanity check.
    Dumping /var/lib/kafka/data/index-demo-0/00000000000000000000.index
    ```

    - `--index-sanity-check` checks the file's structure: its size is a multiple of the entry size, and the entries are in order.
    - `--verify-index-only` compares every entry against the `.log`: does each position really start a batch with that offset? No output means no mismatches.

!!! note "Indexes are disposable"
    Indexes can always be rebuilt from the `.log`, which is the only source of truth. After an unclean shutdown a broker checks the indexes of recent segments and rebuilds any that are corrupt; you may see *"Found a corrupted index file ... rebuilding index files"* in its log. Deleting a closed segment's `.index` and `.timeindex` while the broker is stopped is harmless - they are rebuilt on start (slower startup, nothing lost).

## Tuning the indexes

| Setting | Default | Effect |
|---------|---------|--------|
| `index.interval.bytes` | 4096 | Smaller = more entries, bigger indexes, shorter scans. Rarely worth changing. |
| `segment.index.bytes` | 10485760 | Maximum index size. A segment also rolls when its index is full: 10 MB / 8 bytes = 1,310,720 entries. |
| `log.index.size.max.bytes` | 10485760 | Broker-level default for the above |

## Check yourself

1. A segment's `.index` is 4,000 bytes after rolling. How many entries does it have?
2. Why is the index sparse instead of having one entry per message?
3. A consumer asks for an offset that is below the log start offset. Does the index help?

!!! solution "Answers"
    1. 500 (4,000 / 8).
    2. To stay small enough to keep in memory for every segment of every partition. A scan of a few KB after the lookup is cheap, and fetches return whole batches anyway.
    3. No. The broker checks the offset against the log start offset first and returns `OFFSET_OUT_OF_RANGE`; the consumer then applies `auto.offset.reset`.
