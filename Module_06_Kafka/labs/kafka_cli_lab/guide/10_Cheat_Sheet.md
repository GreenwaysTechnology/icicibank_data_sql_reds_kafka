# Lab 10 · Cheat Sheet and Troubleshooting

Every command from the labs, grouped by task. `B=kafka1:9092` stands for `--bootstrap-server kafka1:9092`.

## Cluster (Windows / PowerShell, in the lab folder)

| Task | Command |
|------|---------|
| Start / status | `docker compose up -d` · `docker compose ps` |
| Shell in a broker | `docker exec -it kafka1 bash` |
| Broker log | `docker compose logs -f kafka1` |
| Stop / start one broker | `docker stop kafka2` · `docker start kafka2` |
| Stop, keep data | `docker compose down` |
| Stop, delete everything | `docker compose down -v` |
| With Kafka UI | `docker compose --profile ui up -d` -> `http://localhost:8080` |

## Cluster information (inside a broker)

| Task | Command |
|------|---------|
| Version | `kafka-topics.sh --version` |
| Cluster ID | `kafka-cluster.sh cluster-id --bootstrap-server B` |
| KRaft leader and voters | `kafka-metadata-quorum.sh --bootstrap-server B describe --status` |
| Controller replication | `kafka-metadata-quorum.sh --bootstrap-server B describe --replication` |
| Brokers | `kafka-broker-api-versions.sh --bootstrap-server B \| grep -E '^kafka'` |
| Feature versions | `kafka-features.sh --bootstrap-server B describe` |

## Topics

| Task | Command |
|------|---------|
| Create | `kafka-topics.sh --bootstrap-server B --create --topic T --partitions 3 --replication-factor 3 [--config k=v]` |
| Create if missing | `... --create --topic T --if-not-exists` |
| Create with placement | `... --create --topic T --replica-assignment 1:2,2:3,3:1` |
| List | `kafka-topics.sh --bootstrap-server B --list [--exclude-internal]` |
| Describe | `kafka-topics.sh --bootstrap-server B --describe [--topic T]` |
| Health filters | `--describe --under-replicated-partitions` · `--under-min-isr-partitions` · `--at-min-isr-partitions` · `--unavailable-partitions` · `--topics-with-overrides` |
| Add partitions | `kafka-topics.sh --bootstrap-server B --alter --topic T --partitions 6` |
| Delete | `kafka-topics.sh --bootstrap-server B --delete --topic T [--if-exists]` (`--topic` takes a regex) |
| Offsets per partition | `kafka-get-offsets.sh --bootstrap-server B --topic T [--time -2 \| -1 \| -3 \| epoch-ms]` |
| Size on disk | `kafka-log-dirs.sh --bootstrap-server B --describe --topic-list T [--broker-list 1]` |
| Delete records before offset | `kafka-delete-records.sh --bootstrap-server B --offset-json-file F.json` |

## Configuration

| Task | Command |
|------|---------|
| Topic overrides | `kafka-configs.sh --bootstrap-server B --describe --entity-type topics --entity-name T` |
| All topic settings | `... --describe --entity-type topics --entity-name T --all` |
| Set | `kafka-configs.sh --bootstrap-server B --alter --entity-type topics --entity-name T --add-config k=v,k2=v2` |
| Remove | `... --alter --entity-type topics --entity-name T --delete-config k` |
| Broker settings | `... --describe --entity-type brokers --entity-name 1 --all` |
| Cluster-wide defaults | `... --describe --entity-type brokers --entity-default` |

## Replication and leadership

| Task | Command |
|------|---------|
| Preferred leader election | `kafka-leader-election.sh --bootstrap-server B --election-type preferred --all-topic-partitions` |
| Propose a move | `kafka-reassign-partitions.sh --bootstrap-server B --topics-to-move-json-file F --broker-list 1,3 --generate` |
| Execute / verify a move | `kafka-reassign-partitions.sh --bootstrap-server B --reassignment-json-file F --execute` then `--verify` |

## Producing

| Task | Command |
|------|---------|
| Plain lines | `kafka-console-producer.sh --bootstrap-server B --topic T` |
| With keys | `... --reader-property parse.key=true --reader-property key.separator=:` |
| With headers | `... --reader-property parse.key=true --reader-property parse.headers=true` (line: `h1:v1,h2:v2<TAB>key<TAB>value`) |
| Tombstones | `... --reader-property null.marker=NULL` |
| From a file | `kafka-console-producer.sh ... < /lab/data/orders.txt` |
| Producer settings | `--command-property acks=all` · `--command-config /lab/config/producer.properties` |
| Compression (console) | `--compression-codec lz4` |
| Load test | `kafka-producer-perf-test.sh --bootstrap-server B --topic T --num-records N --record-size 500 --throughput -1 --command-property acks=all` |

## Consuming

| Task | Command |
|------|---------|
| New messages only | `kafka-console-consumer.sh --bootstrap-server B --topic T` |
| From the start | `... --from-beginning` |
| One partition from an offset | `... --partition 1 --offset 42` (or `earliest` / `latest`) |
| Stop conditions | `--max-messages N` · `--timeout-ms T` |
| Show metadata | `--formatter-property print.key=true` (also `print.partition`, `print.offset`, `print.timestamp`, `print.headers`) |
| Several topics | `--include 'orders\|payments'` |
| In a group | `--group G` |
| Consumer settings | `--command-property k=v` · `--command-config /lab/config/consumer.properties` |

## Consumer groups

| Task | Command |
|------|---------|
| List | `kafka-consumer-groups.sh --bootstrap-server B --list` · `kafka-groups.sh --bootstrap-server B --list` |
| Offsets and lag | `kafka-consumer-groups.sh --bootstrap-server B --describe --group G` |
| Members | `... --describe --group G --members --verbose` |
| State | `... --describe --group G --state` |
| Reset (group stopped) | `... --group G --topic T --reset-offsets --to-earliest \| --to-latest \| --to-offset N \| --shift-by N \| --to-datetime 2026-09-27T12:00:00.000 \| --by-duration PT10M  --dry-run \| --execute` |
| Delete offsets | `... --delete-offsets --group G --topic T` |
| Delete group | `... --delete --group G` |
| New protocol | consumer setting `group.protocol=consumer` |

## Files on disk

| Task | Command |
|------|---------|
| Batches | `kafka-dump-log.sh --files /var/lib/kafka/data/T-0/00000000000000000000.log` |
| Records | `... --print-data-log` |
| Offset index | `kafka-dump-log.sh --files .../00000000000000000000.index` |
| Time index | `kafka-dump-log.sh --files .../00000000000000000000.timeindex` |
| Check an index | `... --index-sanity-check` · `--verify-index-only` |
| Consumer offsets topic | `... --files .../__consumer_offsets-44/...log --offsets-decoder` |
| Metadata log | `... --files .../__cluster_metadata-0/...log --cluster-metadata-decoder` |
| Metadata as a tree | `kafka-metadata-shell.sh --snapshot /tmp/meta/00000000000000000000.log ls /image/topics/byName` (on a copy) |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `docker compose up` says *port is already allocated* | Another Kafka (or program) uses 19092/29092/39092 | `docker ps` to find it; stop it, or change the host port on the left of `"19092:19092"` |
| Container stays `(health: starting)`, then `unhealthy` | Broker failed to start | `docker compose logs kafka1` - look for the first `ERROR` |
| `Invalid cluster.id` in the log | Old volumes from a cluster with another `CLUSTER_ID` | `docker compose down -v`, then `up -d` |
| Windows client: *connection refused* to `kafka1:9092` | The client used the internal listener address | Use `localhost:19092,localhost:29092,localhost:39092` from Windows |
| `UNKNOWN_TOPIC_OR_PARTITION` / *topic not present in metadata* when producing | The topic does not exist, and auto-creation is off in this lab | Create it with `kafka-topics.sh --create` |
| `NotEnoughReplicasException` | Fewer in-sync replicas than `min.insync.replicas`, with `acks=all` | `--describe --under-min-isr-partitions`; bring the broker back |
| Console consumer prints nothing | It starts at `latest` | Add `--from-beginning`, or produce while it runs |
| Group reset fails: *group ... is inactive, but the current state is Stable* | Consumers are still running | Stop every member of the group first |
| `kafka-metadata-shell.sh`: *Unable to lock /var/lib/kafka/data* | It is pointed at a live broker's directory | Copy the metadata log to `/tmp/meta` and open the copy |
| Git Bash: paths like `/lab/...` become `C:/Program Files/Git/lab/...` | Git Bash path conversion | Use PowerShell, or `export MSYS_NO_PATHCONV=1` |
| `--property`, `--producer-property` or `--consumer-property` warn *DEPRECATED* | Old option names | Use `--reader-property` / `--formatter-property` / `--command-property` |

## Clean up

When you are done with the labs:

```powershell
docker compose down -v
```

This removes the three containers, their network and all data volumes. The image stays cached, so the next `docker compose up -d` starts in seconds with an empty cluster.
