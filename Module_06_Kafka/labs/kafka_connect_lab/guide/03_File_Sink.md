# Lab 3 · File Sink: from a Topic into a File

**Goal:** add the other half: a sink connector that writes `shop-orders` to a file. You then have a complete pipeline, file → Kafka → file. You will also see that a sink connector is, underneath, a consumer group.

## Exercise 3.1 · Create the sink

**Task:** create `orders-file-sink` from `lab\connectors\orders-file-sink.json`, check its status, and open the file it writes.

<!-- include: lab/connectors/orders-file-sink.json -->

!!! solution "Solution"
    ```powershell
    curl.exe -s -X PUT localhost:8083/connectors/orders-file-sink/config -H "Content-Type: application/json" --data "@lab/connectors/orders-file-sink.json"
    curl.exe -s localhost:8083/connectors/orders-file-sink/status
    ```

    ```output
    {"name":"orders-file-sink","config":{"connector.class":"org.apache.kafka.connect.file.FileStreamSinkConnector",...},"tasks":[],"type":"sink"}
    {"name":"orders-file-sink","connector":{"state":"RUNNING","worker_id":"connect1:8083","version":"4.3.1"},"tasks":[{"id":0,"state":"RUNNING","worker_id":"connect1:8083","version":"4.3.1"}],"type":"sink"}
    ```

    ```powershell
    Get-Content lab\data\out\shop-orders.txt
    ```

    ```output
    {"order":3001,"customer":"alice","item":"keyboard","amount":45,"email":"alice@example.com","card":"4111111111111111"}
    {"order":3002,"customer":"dave","item":"monitor","amount":210,"email":"dave@example.com","card":"5500005555555559"}
    {"order":3003,"customer":"carol","item":"mouse","amount":18,"email":"carol@example.com","card":"340000000000009"}
    {"order":3004,"customer":"alice","item":"headset","amount":60,"email":"alice@example.com","card":"4111111111111111"}
    {"order":3005,"customer":"erin","item":"webcam","amount":75,"email":"erin@example.com","card":"6011000000000004"}
    {"order":3006,"customer":"frank","item":"dock","amount":140,"email":"frank@example.com","card":"5105105105105100"}
    {"order":3007,"customer":"bob","item":"cable","amount":9,"email":"bob@example.com","card":"4012888888881881"}
    {"order":3008,"customer":"dave","item":"chair","amount":320,"email":"dave@example.com","card":"5500005555555559"}
    ```

    A sink uses `topics`, plural (or `topics.regex`): **one sink can read many topics**. It read `shop-orders` from the beginning, so the file holds all eight orders. Windows can **read** the output file while the connector has it open. Only writing to it is blocked.

## Exercise 3.2 · A sink is a consumer group

**Task:** a sink connector consumes, so it must belong to a consumer group. Find it with `kafka-consumer-groups.sh`.

!!! solution "Solution"
    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group connect-orders-file-sink
    ```

    ```output
    GROUP                     TOPIC        PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID
    connect-orders-file-sink  shop-orders  0          0               0               0    connector-consumer-orders-file-sink-0-5e7f632d
    connect-orders-file-sink  shop-orders  1          0               0               0    connector-consumer-orders-file-sink-0-5e7f632d
    connect-orders-file-sink  shop-orders  2          8               8               0    connector-consumer-orders-file-sink-0-5e7f632d
    ```

    (Spacing tightened; `HOST` and `CLIENT-ID` columns and the end of each consumer id left out.) Every sink connector gets the group **`connect-<connector name>`**, and each task is a member of it. Unlike a source connector's file position, **a sink's offsets are ordinary committed consumer offsets** in `__consumer_offsets`. Everything from the Consumers lesson applies: lag, `--reset-offsets` while the connector is stopped, and at-least-once delivery.

## Exercise 3.3 · The whole pipeline, live

**Task:** add order 3009 with `add-order.sh` and look at the last lines of the output file.

!!! solution "Solution"
    ```powershell
    docker exec connect1 bash /lab/add-order.sh 3009 carol "desk lamp" 35
    Get-Content lab\data\out\shop-orders.txt -Tail 2
    ```

    ```output
    {"order":3009,"customer":"carol","item":"desk lamp","amount":35,"email":"carol@example.com","card":"4111111111111111"}

    {"order":3008,"customer":"dave","item":"chair","amount":320,"email":"dave@example.com","card":"5500005555555559"}
    {"order":3009,"customer":"carol","item":"desk lamp","amount":35,"email":"carol@example.com","card":"4111111111111111"}
    ```

    One line appended to one file showed up in another file, about a second later. Between them: a source connector producing, a topic replicated three times, and a sink connector consuming. No code was written. Any other consumer can read the same orders from `shop-orders` at the same time, or a week later.

## Exercise 3.4 · All connectors at once

**Task:** list every connector with its status in one call.

!!! solution "Solution"
    ```powershell
    curl.exe -s "localhost:8083/connectors?expand=status"
    ```

    One line per connector, shortened from the JSON:

    ```output
    orders-file-sink    sink    RUNNING  task 0 RUNNING on connect1:8083
    orders-file-source  source  RUNNING  task 0 RUNNING on connect1:8083
    ```

    `?expand=status` (or `?expand=info` for the configs) turns the list of names from `GET /connectors` into a full overview. It is the call to use in a monitoring script.
