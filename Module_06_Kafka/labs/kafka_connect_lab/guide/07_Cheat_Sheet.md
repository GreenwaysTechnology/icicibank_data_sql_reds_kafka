# Lab 7 · Cheat Sheet and Troubleshooting

## The REST API

Base URL `http://localhost:8083`. Every worker answers for the whole Connect cluster.

| Call | What it does |
|---|---|
| `GET /` | Worker version and the Kafka cluster id |
| `GET /connector-plugins[?connectorsOnly=false]` | Connector plugins the worker can load (plus transforms, predicates, converters) |
| `GET /connectors[?expand=status&expand=info]` | All connectors, optionally with status and config |
| `PUT /connectors/{name}/config` | **Create or update** a connector. Body: the config JSON. `201` new, `200` updated |
| `GET /connectors/{name}/status` | Connector and task states, worker ids, the stack trace of a failed task |
| `GET /connectors/{name}/config` | The current config |
| `PUT /connectors/{name}/pause` · `/resume` | Hold processing. Tasks stay assigned |
| `PUT /connectors/{name}/stop` | Shut the tasks down completely: state `STOPPED` |
| `POST /connectors/{name}/restart?includeTasks=true&onlyFailed=true` | Restart the connector and (only the failed) tasks |
| `GET /connectors/{name}/offsets` | Source: positions in the source system. Sink: consumer offsets |
| `DELETE /connectors/{name}/offsets` | Reset offsets. The connector must be `STOPPED` |
| `DELETE /connectors/{name}` | Remove the connector. Its topics and committed offsets stay |

With `curl.exe` in PowerShell: send config bodies from a file with `--data "@file.json"`, and put URLs that contain `?` or `&` in quotes.

## Connector settings used in this lab

| Setting | Where | Meaning |
|---|---|---|
| `connector.class`, `tasks.max` | all | The plugin, and the upper limit of parallel tasks |
| `topic` / `topics`, `topics.regex` | source / sink | Where to write / what to read |
| `key.converter`, `value.converter`, `...converter.schemas.enable` | all | Override the worker's converters |
| `topic.creation.default.partitions`, `.replication.factor` | source | Let Connect create the topics it writes to |
| `transforms`, `transforms.<name>.type`, `transforms.<name>.*` | all | The SMT chain, in order |
| `predicates`, `predicates.<name>.type`, `transforms.<t>.predicate` | all | Apply a transform only to matching records |
| `errors.tolerance`, `errors.deadletterqueue.*`, `errors.log.enable` | sink | Skip bad records and keep them in a DLQ |
| `mode`, `incrementing.column.name`, `timestamp.column.name`, `topic.prefix`, `poll.interval.ms` | JDBC source | How changed rows are found |
| `insert.mode`, `pk.mode`, `pk.fields`, `auto.create`, `table.name.format` | JDBC sink | How rows are written |

## Built-in SMTs at a glance

| SMT | Does |
|---|---|
| `InsertField` | Adds a fixed value, or the topic, partition, offset or timestamp |
| `ReplaceField` | `include` / `exclude` fields, `renames=old:new` |
| `MaskField` | Replaces field values with a null-like value or a `replacement` |
| `ValueToKey`, `ExtractField` | Build the key from value fields; pull one field out of a struct |
| `Cast`, `TimestampConverter` | Change a field's type or a timestamp's format |
| `HoistField`, `Flatten` | Wrap a value in a struct; flatten nested structs to `a.b` names |
| `RegexRouter`, `TimestampRouter` | Change the topic name |
| `Filter` + `HasHeaderKey` / `TopicNameMatches` / `RecordIsTombstone` | Drop matching records |
| `InsertHeader`, `HeaderFrom`, `DropHeaders` | Work with headers |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Add-Content : ... being used by another process` | The FileStream source holds the file open, and Docker Desktop then blocks writes from Windows | Append inside the container: `docker exec connect1 bash /lab/add-order.sh ...` |
| `Failed to find any class that implements Connector ... JdbcSourceConnector` | The plugin is not on `plugin.path`, or the worker started before it was installed | Check `plugins\`, then `docker compose restart connect1` (and `connect2`) |
| Source task FAILED: `UNKNOWN_TOPIC_OR_PARTITION` / topic not present | The cluster has `auto.create.topics.enable=false` | Add `topic.creation.default.replication.factor` and `.partitions`, or create the topic first |
| Sink task FAILED: `JsonParseException` | A message is not JSON, but the converter is `JsonConverter` | Fix the producer, or use `errors.tolerance=all` with a DLQ (Lab 6) |
| `JsonConverter with schemas.enable requires "schema" and "payload" fields` | The sink expects the schema envelope, but the topic has plain JSON | Make producer and sink agree on `schemas.enable` - or use Schema Registry |
| JDBC sink: `Sink connector ... requires records with a non-null Struct value and non-null Struct schema` | The data has no schema (plain JSON) | `value.converter.schemas.enable=true` on both sides, or Avro with Schema Registry |
| Messages show up as `"{\"order\":...}"` | A string was written by `JsonConverter` | Use `StringConverter` for text that is already JSON (Lab 2.5) |
| Status says RUNNING for a worker that is gone | A dead worker cannot update its status | Wait for the rebalance - up to `scheduled.rebalance.max.delay.ms` (5 min by default) |
| A connector's tasks do nothing after a worker restart | Same delay, while the cluster waits for the worker to return | Same - or restart the connector |

## Cleaning up

```powershell
# delete one connector (its topics and data stay)
curl.exe -s -X DELETE localhost:8083/connectors/orders-clean-sink

# stop the lab, keep the PostgreSQL data          / and delete it
docker compose --profile scale down
docker compose --profile scale down -v
```

```kafka
# the topics this lab created, if you want them gone
kafka-topics.sh --bootstrap-server kafka1:9092 --delete --topic 'shop-orders.*|pg-users'
# the Connect cluster's state - only with every worker stopped
kafka-topics.sh --bootstrap-server kafka1:9092 --delete --topic 'connect-(configs|offsets|status)'
```

Deleting the three `connect-*` topics resets the Connect cluster completely: every connector config and every source offset is gone.
