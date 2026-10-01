# Lab 6 · Running Connect: Errors, Pausing, Scaling, Replaying

**Goal:** the jobs you do once connectors are running: handle a poison message with a **dead letter queue**, pause and resume a connector, add a second worker and lose it again, and replay a source from the beginning.

## Exercise 6.1 · A poison message

**Task:** append a line that is not JSON to `orders.jsonl`. What happens to `orders-file-sink`, which writes text, and to `orders-clean-sink`, which parses JSON?

!!! solution "Solution"
    ```powershell
    docker exec connect1 bash -c "echo this is not json >> /lab/data/in/orders.jsonl"
    curl.exe -s localhost:8083/connectors/orders-file-sink/status
    curl.exe -s localhost:8083/connectors/orders-clean-sink/status
    ```

    ```output
    {"name":"orders-file-sink","connector":{"state":"RUNNING",...},"tasks":[{"id":0,"state":"RUNNING",...}],"type":"sink"}
    {"name":"orders-clean-sink","connector":{"state":"RUNNING",...},"tasks":[{"id":0,"state":"FAILED","worker_id":"connect1:8083",
     "trace":"org.apache.kafka.connect.errors.ConnectException: Tolerance exceeded in error handler
        at org.apache.kafka.connect.runtime.errors.RetryWithToleranceOperator.execAndHandleError(...)
        ...
     Caused by: org.apache.kafka.connect.errors.DataException: Converting byte[] to Kafka Connect data failed due to serialization error:
        ...
     Caused by: com.fasterxml.jackson.core.JsonParseException: Unrecognized token 'this': was expecting (JSON String, Number, Array, Object or token 'null', 'true' or 'false')
        ..."}],"type":"sink"}
    ```

    (Stack trace shortened.) The plain sink does not care: it wrote `this is not json` into its file. The clean sink's **task FAILED**, while its connector still says RUNNING, so always check the tasks. With the default `errors.tolerance=none`, a record that cannot be converted stops the task. It does not skip the record, because skipping silently would lose data. The bad record stays at its offset. Restarting the task alone would fail on it again.

## Exercise 6.2 · A dead letter queue

**Task:** let `orders-clean-sink` skip records it cannot handle, but put them in a topic `shop-orders-dlq` so nothing is lost. Then look at what landed there.

!!! solution "Solution"
    `lab\connectors\orders-clean-sink-dlq.json` adds five lines to the previous config:

    ```json
    "errors.tolerance": "all",
    "errors.deadletterqueue.topic.name": "shop-orders-dlq",
    "errors.deadletterqueue.topic.replication.factor": "3",
    "errors.deadletterqueue.context.headers.enable": "true",
    "errors.log.enable": "true",
    ```

    ```powershell
    curl.exe -s -o NUL -w "HTTP %{http_code}\n" -X PUT localhost:8083/connectors/orders-clean-sink/config -H "Content-Type: application/json" --data "@lab/connectors/orders-clean-sink-dlq.json"
    curl.exe -s localhost:8083/connectors/orders-clean-sink/status
    ```

    ```output
    HTTP 200
    {"name":"orders-clean-sink","connector":{"state":"RUNNING",...},"tasks":[{"id":0,"state":"RUNNING",...}],"type":"sink"}
    ```

    The config change restarted the failed task. This time the bad record went to the DLQ, and the task carried on:

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic shop-orders-dlq --from-beginning --max-messages 1 \
      --formatter-property print.headers=true
    ```

    ```output
    __connect.errors.topic:shop-orders,__connect.errors.partition:1,__connect.errors.offset:0,
    __connect.errors.connector.name:orders-clean-sink,__connect.errors.task.id:0,
    __connect.errors.stage:VALUE_CONVERTER,__connect.errors.class.name:org.apache.kafka.connect.json.JsonConverter,
    __connect.errors.exception.class.name:org.apache.kafka.connect.errors.DataException,
    __connect.errors.exception.message:Converting byte[] to Kafka Connect data failed due to serialization error: ,
    __connect.errors.exception.stacktrace:...	this is not json
    ```

    (Headers wrapped and the stack trace cut.) The original message, `this is not json`, is unchanged. The **headers** record where it came from (`shop-orders`, partition 1, offset 0), which **stage** failed (`VALUE_CONVERTER`) and why. Someone can fix it and produce it again, or a small consumer can do that automatically.

    Dead letter queues exist only for **sink** connectors, and they catch failures in converters and transforms. An error thrown by the external system, for example a database constraint violation, is handled by the connector itself.

## Exercise 6.3 · Pause and resume

**Task:** pause `orders-file-sink`, add an order, and look at the output file and the sink's lag. Then resume it.

!!! solution "Solution"
    ```powershell
    curl.exe -s -i -X PUT localhost:8083/connectors/orders-file-sink/pause
    curl.exe -s localhost:8083/connectors/orders-file-sink/status
    docker exec connect1 bash /lab/add-order.sh 3011 frank "laptop stand" 55
    Get-Content lab\data\out\shop-orders.txt -Tail 1
    ```

    ```output
    HTTP/1.1 202 Accepted
    {"name":"orders-file-sink","connector":{"state":"PAUSED",...},"tasks":[{"id":0,"state":"PAUSED",...}],"type":"sink"}
    {"order":3011,"customer":"frank","item":"laptop stand","amount":55,"email":"frank@example.com","card":"4111111111111111"}
    this is not json
    ```

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group connect-orders-file-sink
    ```

    ```output
    GROUP                     TOPIC        PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID
    connect-orders-file-sink  shop-orders  0          3               3               0    connector-consumer-orders-file-sink-0-019f231b
    connect-orders-file-sink  shop-orders  1          1               2               1    connector-consumer-orders-file-sink-0-019f231b
    connect-orders-file-sink  shop-orders  2          8               8               0    connector-consumer-orders-file-sink-0-019f231b
    ```

    (Columns trimmed as in Lab 3.) The order is in the topic, but not in the file: **lag 1**. A paused task stays in its group, so its partitions are not given to anyone else. It just stops processing.

    ```powershell
    curl.exe -s -i -X PUT localhost:8083/connectors/orders-file-sink/resume
    Get-Content lab\data\out\shop-orders.txt -Tail 1
    ```

    ```output
    HTTP/1.1 202 Accepted
    {"order":3011,"customer":"frank","item":"laptop stand","amount":55,"email":"frank@example.com","card":"4111111111111111"}
    ```

    Pausing is how you hold back a sink while its target system is under maintenance. Nothing is lost: the messages wait in Kafka.

## Exercise 6.4 · Scale out: a second worker

**Task:** start `connect2`, with the same `group.id` and a different host name. Where do the five connectors run now?

!!! solution "Solution"
    ```powershell
    docker compose --profile scale up -d
    curl.exe -s "localhost:8083/connectors?expand=status"
    ```

    Shortened to one line per connector:

    ```output
    orders-clean-sink    connector@connect2:8083  tasks: 0 RUNNING@connect2:8083
    orders-file-sink     connector@connect1:8083  tasks: 0 RUNNING@connect1:8083
    orders-file-source   connector@connect1:8083  tasks: 0 RUNNING@connect1:8083
    users-db-sink        connector@connect2:8083  tasks: 0 RUNNING@connect2:8083
    users-db-source      connector@connect1:8083  tasks: 0 RUNNING@connect1:8083
    ```

    The new worker joined the Connect cluster `connect-lab`, and the group **rebalanced**: two connectors and their tasks moved to `connect2`. You did nothing but start a process. Either worker answers the REST API with the same picture, and a request to one worker for a connector on the other is forwarded. Both workers mount the same `plugins\` folder, so `connect2` can run the JDBC sink too. **Every worker needs every plugin.**

## Exercise 6.5 · Losing a worker

**Task:** stop `connect2` and keep checking the status. How long until its connectors run again?

!!! solution "Solution"
    ```powershell
    docker compose stop connect2
    curl.exe -s "localhost:8083/connectors?expand=status"
    ```

    ```output
    right after the stop:
    orders-clean-sink    connector@connect2:8083  tasks: 0 RUNNING@connect2:8083
    users-db-sink        connector@connect2:8083  tasks: 0 RUNNING@connect2:8083
    ... the other three on connect1

    34 seconds later:
    orders-clean-sink    connector@connect1:8083  tasks: 0 RUNNING@connect1:8083
    orders-file-sink     connector@connect1:8083  tasks: 0 RUNNING@connect1:8083
    orders-file-source   connector@connect1:8083  tasks: 0 RUNNING@connect1:8083
    users-db-sink        connector@connect1:8083  tasks: 0 RUNNING@connect1:8083
    users-db-source      connector@connect1:8083  tasks: 0 RUNNING@connect1:8083
    ```

    Two lessons. First, **status can be stale**: a worker that is gone cannot report that its tasks stopped. Second, the surviving worker waited before taking over. Connect's rebalancing assumes a departed worker may be restarting, and gives it **`scheduled.rebalance.max.delay.ms`** to come back, so that a rolling restart does not move everything twice. The default is **5 minutes**. This lab sets 30 s, which is why the move took 34 s.

## Exercise 6.6 · Replay a source

**Task:** make `users-db-source` read the whole table again. You must **stop** the connector, delete its offsets and resume it. Does the replica get duplicate rows?

!!! solution "Solution"
    ```powershell
    curl.exe -s -i -X PUT localhost:8083/connectors/users-db-source/stop
    curl.exe -s localhost:8083/connectors/users-db-source/offsets
    curl.exe -s -X DELETE localhost:8083/connectors/users-db-source/offsets
    curl.exe -s localhost:8083/connectors/users-db-source/offsets
    curl.exe -s -i -X PUT localhost:8083/connectors/users-db-source/resume
    ```

    ```output
    HTTP/1.1 204 No Content
    {"offsets":[{"partition":{"protocol":"1","table":"public.users"},"offset":{"timestamp_nanos":729000000,"incrementing":3,"timestamp":1790818723729}}]}
    {"message":"The Connect framework-managed offsets for this connector have been reset successfully. However, if this connector manages offsets externally, they will need to be manually reset in the system that the connector uses."}
    {"offsets":[]}
    HTTP/1.1 202 Accepted
    ```

    ```kafka
    kafka-get-offsets.sh --bootstrap-server kafka1:9092 --topic pg-users
    ```

    ```sql
    SELECT count(*) FROM users_replica;
    ```

    ```output
    pg-users:0:4
    pg-users:1:2
    pg-users:2:5
    count
    -------
         5
    ```

    `STOPPED` is stronger than `PAUSED`: the tasks are shut down completely, which is what Connect requires before it lets you change offsets. With the offsets gone, the source read all 5 rows again: the topic grew from 6 to **11** messages. The replica still has **5 rows**. The sink **upserts** by primary key, so writing the same row twice has the same effect as writing it once. This is the at-least-once world of Kafka: **make the sink idempotent**, and duplicates do no harm.
