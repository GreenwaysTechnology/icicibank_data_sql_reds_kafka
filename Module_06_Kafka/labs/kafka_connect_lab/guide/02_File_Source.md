# Lab 2 · File Source: from a File into a Topic

**Goal:** create your first connector with one REST call. Watch it read a file into a topic and follow new lines as they are added. Then see how it remembers its place, and what a converter does.

The input is `lab\data\in\orders.jsonl`: one order per line, as JSON, with personal data such as an email and a card number. In Lab 4 you mask those.

```output
{"order":3001,"customer":"alice","item":"keyboard","amount":45,"email":"alice@example.com","card":"4111111111111111"}
{"order":3002,"customer":"dave","item":"monitor","amount":210,"email":"dave@example.com","card":"5500005555555559"}
... six orders, 3001 to 3006
```

## Exercise 2.1 · Create the connector

**Task:** create the connector `orders-file-source` from `lab\connectors\orders-file-source.json`.

<!-- include: lab/connectors/orders-file-source.json -->

!!! solution "Solution"
    ```powershell
    curl.exe -s -i -X PUT localhost:8083/connectors/orders-file-source/config -H "Content-Type: application/json" --data "@lab/connectors/orders-file-source.json"
    ```

    ```output
    HTTP/1.1 201 Created
    Location: http://localhost:8083/connectors/orders-file-source
    Content-Type: application/json

    {"name":"orders-file-source","config":{"connector.class":"org.apache.kafka.connect.file.FileStreamSourceConnector","tasks.max":"1","file":"/lab/data/in/orders.jsonl","topic":"shop-orders",...},"tasks":[],"type":"source"}
    ```

    That is the whole deployment: **a name and a JSON config, sent with `PUT /connectors/<name>/config`**. `201 Created` means the connector is new. Send the same request again and you get `200 OK`, which is why `PUT` is the verb to use in scripts: it creates or updates, and repeating it does no harm.

    What each line of the config does:

    | Setting | Meaning |
    |---|---|
    | `connector.class` | The plugin to run - it must be on the worker's `plugin.path` |
    | `tasks.max` | At most this many tasks. A file can only be read by one |
    | `file`, `topic` | The connector's own settings - every connector has different ones |
    | `value.converter` | Overrides the worker default: write each line as plain text, not as JSON (Exercise 2.5) |
    | `topic.creation.default.*` | Let Connect **create** `shop-orders` with 3 partitions and replication factor 3. The cluster has `auto.create.topics.enable=false` |

## Exercise 2.2 · Is it running?

**Task:** check the connector's status, then look at the topic it created and read it.

!!! solution "Solution"
    ```powershell
    curl.exe -s localhost:8083/connectors/orders-file-source/status
    ```

    ```output
    {
      "name": "orders-file-source",
      "connector": {"state": "RUNNING", "worker_id": "connect1:8083", "version": "4.3.1"},
      "tasks": [
        {"id": 0, "state": "RUNNING", "worker_id": "connect1:8083", "version": "4.3.1"}
      ],
      "type": "source"
    }
    ```

    A **connector** plans the work, and its **tasks** do it. Both are running on worker `connect1`.

    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic shop-orders | head -1
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic shop-orders --from-beginning --max-messages 6 \
      --formatter-property print.key=true --formatter-property print.partition=true --formatter-property print.offset=true
    ```

    ```output
    Topic: shop-orders	TopicId: vUUe-VrSQ6SSkMx9EiWGGA	PartitionCount: 3	ReplicationFactor: 3	Configs: min.insync.replicas=2
    Partition:2	Offset:0	null	{"order":3001,"customer":"alice","item":"keyboard","amount":45,"email":"alice@example.com","card":"4111111111111111"}
    Partition:2	Offset:1	null	{"order":3002,"customer":"dave","item":"monitor","amount":210,"email":"dave@example.com","card":"5500005555555559"}
    Partition:2	Offset:2	null	{"order":3003,"customer":"carol","item":"mouse","amount":18,"email":"carol@example.com","card":"340000000000009"}
    Partition:2	Offset:3	null	{"order":3004,"customer":"alice","item":"headset","amount":60,"email":"alice@example.com","card":"4111111111111111"}
    Partition:2	Offset:4	null	{"order":3005,"customer":"erin","item":"webcam","amount":75,"email":"erin@example.com","card":"6011000000000004"}
    Partition:2	Offset:5	null	{"order":3006,"customer":"frank","item":"dock","amount":140,"email":"frank@example.com","card":"5105105105105100"}
    Processed a total of 6 messages
    ```

    One message per line, all with key **`null`**: a line of a file has no key. With no key, the producer inside Connect used the **sticky partitioner** (CLI Lab 5), so all six lines went into one batch and one partition, partition 2.

## Exercise 2.3 · New lines arrive

**Task:** add two orders to the end of `orders.jsonl`. Try it from PowerShell first.

!!! solution "Solution"
    ```powershell
    Add-Content lab\data\in\orders.jsonl '{"order":3007,"customer":"bob","item":"cable","amount":9}'
    ```

    ```output
    Add-Content : The process cannot access the file 'D:\trainings\Apache_Kafka_Training\labs\kafka_connect_lab\lab\data\in\orders.jsonl'
    because it is being used by another process.
    ```

    The connector keeps the file **open** so it can follow it, and Docker Desktop then refuses Windows programs write access to it. Write from **inside** the container instead, where the file is an ordinary Linux file:

    ```powershell
    docker exec -it connect1 bash
    ```

    ```connect
    echo '{"order":3007,"customer":"bob","item":"cable","amount":9,"email":"bob@example.com","card":"4012888888881881"}' >> /lab/data/in/orders.jsonl
    echo '{"order":3008,"customer":"dave","item":"chair","amount":320,"email":"dave@example.com","card":"5500005555555559"}' >> /lab/data/in/orders.jsonl
    exit
    ```

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic shop-orders --partition 2 --offset 6 --max-messages 2 \
      --formatter-property print.offset=true
    ```

    ```output
    Offset:6	{"order":3007,"customer":"bob","item":"cable","amount":9,"email":"bob@example.com","card":"4012888888881881"}
    Offset:7	{"order":3008,"customer":"dave","item":"chair","amount":320,"email":"dave@example.com","card":"5500005555555559"}
    ```

    Both lines were in Kafka within a second. The source task polls the file for new lines, much as `tail -f` does.

!!! tip "A shortcut for the rest of the lab"
    `lab\add-order.sh` appends one order for you, and runs inside the container:

    ```powershell
    docker exec connect1 bash /lab/add-order.sh 3009 carol "desk lamp" 35
    ```

## Exercise 2.4 · How does it know where it was?

**Task:** ask Connect for the connector's **offsets**, and compare them with the size of the file. Then restart the connector and its task. Are the orders sent again?

!!! solution "Solution"
    ```powershell
    curl.exe -s localhost:8083/connectors/orders-file-source/offsets
    (Get-Item lab\data\in\orders.jsonl).Length
    ```

    ```output
    {"offsets":[{"partition":{"filename":"/lab/data/in/orders.jsonl"},"offset":{"position":918}}]}
    918
    ```

    A source connector's offset is not a Kafka offset but **a position in the source system**, in whatever form suits that system. For a file, it is the byte position: 918, the file's length, so the connector has read everything. The worker stores it in **`connect-offsets`**, every `offset.flush.interval.ms` (10 s in this lab).

    ```powershell
    curl.exe -s -i -X POST "localhost:8083/connectors/orders-file-source/restart?includeTasks=true"
    ```

    ```kafka
    kafka-get-offsets.sh --bootstrap-server kafka1:9092 --topic shop-orders
    ```

    ```output
    HTTP/1.1 202 Accepted
    shop-orders:0:0
    shop-orders:1:0
    shop-orders:2:8
    ```

    Still 8 messages. The restarted task read its stored position and carried on from byte 918, without reading the file again. (A crash **between** writing to Kafka and saving the offset can repeat the last few lines. Source connectors are at-least-once unless they support exactly-once.)

## Exercise 2.5 · What a converter does

**Task:** create a second source connector on the same file, without the `value.converter` line, so it uses the worker default `JsonConverter`. Its topic is `shop-orders-json`. Compare one message with `shop-orders`, then delete the connector.

!!! solution "Solution"
    `lab\connectors\orders-file-source-json.json` is the same config without the converter line, writing to `shop-orders-json` (one partition):

    ```powershell
    curl.exe -s -X PUT localhost:8083/connectors/orders-file-source-json/config -H "Content-Type: application/json" --data "@lab/connectors/orders-file-source-json.json"
    ```

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic shop-orders-json --from-beginning --max-messages 1
    ```

    ```output
    "{\"order\":3001,\"customer\":\"alice\",\"item\":\"keyboard\",\"amount\":45,\"email\":\"alice@example.com\",\"card\":\"4111111111111111\"}"
    Processed a total of 1 messages
    ```

    The FileStream source hands each line to Connect as a **string**. The `JsonConverter` then did its job: it wrote that string as a **JSON string**, with quotes around it and every inner quote escaped. Nothing failed, and the data is still awkward for any consumer to use. **The connector decides what the data is; the converter decides how it becomes bytes.** For text that is already JSON, `StringConverter` is the right choice.

    ```powershell
    curl.exe -s -i -X DELETE localhost:8083/connectors/orders-file-source-json
    ```

    ```output
    HTTP/1.1 204 No Content
    ```

    Deleting a connector stops it and removes its config. Its topic, `shop-orders-json`, stays. You can delete it with `kafka-topics.sh --delete` if you like.
