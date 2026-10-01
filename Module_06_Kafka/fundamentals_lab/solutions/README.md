# Kafka Fundamentals - lab solutions

The same answers as the "Solution" slides, in one place. Numbers are from the reference run on 2026-09-26; your milliseconds will differ, the patterns will not.

## Lab 1 - Feel the coupling

| Run | Transfers OK | Avg latency | Transfers / s |
|-----|-------------|-------------|---------------|
| healthy, sequential | 12 / 12 | 181 ms | 21.8 |
| SMS down, sequential | 0 / 12 | 2,085 ms | 1.9 |
| healthy, `--parallel` | 12 / 12 | 72 ms | 53.9 |
| SMS down, `--parallel` | 0 / 12 | 2,014 ms | 2.0 |

1. **Fraud and ledger answered. Why did all 12 transfers fail?** The SMS call sits inside the transfer. When it times out, the whole request fails, so the least important system decides the outcome.
2. **Did `--parallel` fix the outage?** No. Latency fell from 181 to 72 ms (the slowest call rather than the sum of all four), but with SMS down every transfer still failed. Parallelism makes the chain faster; it does not remove the dependency.
3. **The ledger posted, then SMS timed out. What does the customer see?** "Transfer failed", for money that actually moved. They retry, and now there are two transfers. Synchronous chains create partial failures.
4. **Four systems at 99.9% each. How available is the chain?** 0.999^4 = 99.60%, about 35 hours a year, against 8.8 hours for one system. A fifth dependency makes it 43.7 hours.

## Lab 2 - Start Kafka

Success looks like `kafka ... Up ... (healthy)` in `docker compose ps`, `4.3.1` from `kafka-topics.sh --version`, and `LeaderId: 1` from `kafka-metadata-quorum.sh ... describe --status`: one node, acting as its own KRaft controller.

## Lab 3 - Your first topic

1. **Why did all five unkeyed messages land in one partition?** With no key there is no hash. The sticky partitioner fills a batch for one partition before it switches, so it is not per-message round robin, and a small burst lands together.
2. **Why did the second read return the same five messages?** A topic is a log. Reading moves the reader's position and deletes nothing. Messages stay until the retention period ends (7 days by default).
3. **Why did Step 5 print nothing?** A consumer with no saved position starts at the end by default (`auto.offset.reset=latest`). `--from-beginning` overrides that.
4. **Did the order survive?** Within a partition, yes: 9001's `DEBIT 2500`, `DEBIT 700`, `CREDIT 300` came back in order. Across partitions there is no ordering; the reader interleaves them. 9001 → partition 0, 9002 → 1, 9003 → 2, every time.

## Lab 4 - One event, many readers

1. **How many lines of `transfer_service.py` changed to add loyalty?** None. Loyalty is a new consumer group, and the producer never knew about fraud, SMS or ledger either.
2. **Loyalty started after the transfers. How did it see them?** Kafka kept them (retention), and a brand-new group with `auto.offset.reset=earliest` starts at the oldest event.
3. **Loyalty printed partition 2 first. Is that a problem?** No. Partitions are read independently. Order per account still holds because each account lives in one partition.
4. **If SMS had been down, what happens to fraud and ledger?** Nothing. Separate groups keep separate offsets. The SMS group falls behind and catches up later, as Lab 6 shows.

## Lab 5 - Consumer groups

1. **Why did A get partitions 0 and 1, and B only 2?** The default range assignor splits 3 partitions over 2 members as 2 + 1. A partition is never shared by two members of one group.
2. **What happened when B left?** A rebalance: A's partitions were revoked, then all three were given back to A. A resumed partition 2 at offset 12, exactly where B had committed. Nothing was lost or repeated.
3. **Who processed each event?** Exactly one member. The first 12 events split 6 and 6: A had partitions 0 and 1, B had partition 2.
4. **Challenge: four members, three partitions.** `describe --members` shows one member with `#PARTITIONS 0`. It sits idle. Partition count caps a group's parallelism, so size partitions for your peak number of readers.

```text
GROUP           CONSUMER-ID              CLIENT-ID          #PARTITIONS
warehouse-sink  warehouse-sink/W2-...    warehouse-sink/W2  1
warehouse-sink  warehouse-sink/W3-...    warehouse-sink/W3  1
warehouse-sink  warehouse-sink/W4-...    warehouse-sink/W4  0
warehouse-sink  warehouse-sink/W1-...    warehouse-sink/W1  1
```

## Lab 6 - Replay the outage

Part A (2,000 events each way, `acks=all`): sync took 3.116 s (642 events/s, 1.56 ms each); async took 0.015 s (130,470 events/s). Both runs had 2,000 of 2,000 acknowledged.

Part B, lag for `sms-notifier`:

| Moment | P0 | P1 | P2 | Total |
|--------|----|----|----|-------|
| reader down since Lab 4 | 6 | 3 | 9 | 18 |
| after 20 more transfers | 13 | 7 | 18 | 38 |
| after the reader ran | 0 | 0 | 0 | 0 (38 SMS sent) |

1. **Both runs used `acks=all`. Why was async about 200x faster?** Sync waits one network round trip per event, so it can never batch. Async keeps sending while acks come back and packs many events into each request.
2. **Why did no transfer fail while SMS was down?** The transfer service no longer calls SMS. It hands one event to Kafka and is done. SMS is a reader, and a reader is allowed to be late.
3. **Where were the 38 SMS events?** In the topic. Kafka keeps events for the retention period whether or not anyone read them, and the group's committed offsets marked where to resume.
4. **Challenge: what does waiting for the broker's ack cost?** See `transfer_service_sync.py`: one `flush()` after `produce()`. Each transfer went from 30 ms to about 32 ms (the first one takes longer while the connection opens), and the service now knows each event is stored before it says Done. It waits for Kafka, never for SMS.

```powershell
python solutions\transfer_service_sync.py 12
```
