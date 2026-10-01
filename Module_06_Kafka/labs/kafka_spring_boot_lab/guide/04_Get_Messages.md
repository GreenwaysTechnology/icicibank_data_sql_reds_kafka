# Lab 4 · Get Messages over REST

**Goal:** get messages back out in two ways. The first is the **listener**, a consumer group that keeps up with the topic and remembers its place. The second is the **reader**, which reads any part of the log on demand. You will also watch the group catch up after a restart.

## Exercise 4.1 · Messages from outside, while the app is down

**Task:** stop the app with **Ctrl+C**. With the CLI, write two messages: one for judy as JSON, and one for grace as plain text. Then describe the group `orders-api`.

!!! solution "Solution"
    ```kafka
    kafka-console-producer.sh --bootstrap-server kafka1:9092 --topic orders \
      --reader-property parse.key=true --reader-property key.separator=:
    >judy:{"order":2016,"item":"usb hub","amount":22}
    >grace:order 2017 - typed by hand, not JSON
    >^C
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group orders-api
    ```

    ```output
    Consumer group 'orders-api' has no active members.

    GROUP       TOPIC   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID
    orders-api  orders  0          6               7               1    -
    orders-api  orders  1          3               3               0    -
    orders-api  orders  2          3               4               1    -
    ```

    (Spacing tightened. The `HOST` and `CLIENT-ID` columns are left out here and in the rest of the book.) The group still exists while no app is running. Its **committed offsets** are stored in `__consumer_offsets`. Before it stopped, the listener had handled everything: `CURRENT-OFFSET` 6, 3 and 3 are the next offsets it will read. grace went to partition 0 and judy to partition 2, so each of those partitions now has a **lag of 1**: one message the group has not processed yet.

!!! note "Ctrl+C, not closing the window"
    Ctrl+C lets Spring shut down cleanly. The listener commits its offsets and **leaves the group**, so the group shows *no active members* at once. If the process is killed instead, the broker only notices when the member's session times out after `session.timeout.ms`, 45 s by default. Until then the dead member still owns its partitions.

## Exercise 4.2 · Restart and catch up

**Task:** start the app again. What does it receive first, and what does the group look like afterwards?

!!! solution "Solution"
    ```powershell
    java -jar target\orders-api-1.0.0.jar
    ```

    ```output
    06:34:12.301 [main] OrdersApiApplication : Started OrdersApiApplication in 10.011 seconds
    06:34:12.526 [-listener-0-C-1] KafkaMessageListenerContainer : orders-api: partitions assigned: [orders-0, orders-1, orders-2]
    06:34:12.720 [-listener-0-C-1] OrderListener : received key=grace <- orders-0 @ offset 6
    06:34:12.801 [-listener-0-C-1] OrderListener : received key=judy <- orders-2 @ offset 3
    ```

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group orders-api
    ```

    ```output
    GROUP       TOPIC   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID
    orders-api  orders  0          7               7               0    orders-api-0-d8ba3877-0fbe-4846-b567-c821c4d54034
    orders-api  orders  1          3               3               0    orders-api-0-d8ba3877-0fbe-4846-b567-c821c4d54034
    orders-api  orders  2          4               4               0    orders-api-0-d8ba3877-0fbe-4846-b567-c821c4d54034
    ```

    The listener started from the **committed offsets**, 6 and 3, not from the beginning and not from the end. It received exactly the two messages it had missed, and nothing twice. The lag is back to 0. This is the "consumer goes away and comes back" story from the Consumers lesson. `auto-offset-reset: earliest` played no part: it only applies to a group with **no** committed offset.

    The `HOST` column, left out above, shows `/172.21.0.1`: Docker's gateway. From inside the Docker network, the app on Windows appears to come from there.

## Exercise 4.3 · What did the listener receive?

**Task:** send heidi's order 2018 (a stylus for 30), then call `GET /api/orders/received`. Look at the app's log too.

!!! solution "Solution"
    ```powershell
    $body = @{ customer = "heidi"; order = 2018; item = "stylus"; amount = 30 } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri http://localhost:8090/api/orders -ContentType 'application/json' -Body $body
    curl.exe -s http://localhost:8090/api/orders/received
    ```

    ```output
    [
      {"topic": "orders", "partition": 1, "offset": 3, "timestamp": "2026-10-01T01:04:34.444Z", "key": "heidi", "value": {"order": 2018, "item": "stylus", "amount": 30}},
      {"topic": "orders", "partition": 2, "offset": 3, "timestamp": "2026-10-01T01:03:27.361Z", "key": "judy", "value": {"order": 2016, "item": "usb hub", "amount": 22}},
      {"topic": "orders", "partition": 0, "offset": 6, "timestamp": "2026-10-01T01:03:27.383Z", "key": "grace", "value": "order 2017 - typed by hand, not JSON"}
    ]
    ```

    (The POST's receipt is not shown. The list is formatted one message per line.) Three things to notice:

    - **Newest first**, and only messages received **since the restart**. The buffer lives in memory, while the topic still holds all 15 messages.
    - grace's value came back as a **string**, because it was not JSON. Anyone with access can write anything to a topic. A consumer has to cope with that, or a **schema** has to prevent it (Module 8, Schema Registry).
    - judy's and grace's timestamps are from when the **CLI** sent them, not from when the app read them.

    The log shows both halves of the round trip:

    ```output
    06:34:34.561 [-listener-0-C-1] OrderListener : received key=heidi <- orders-1 @ offset 3
    06:34:34.577 [nio-8090-exec-1] OrderProducer : sent     key=heidi -> orders-1 @ offset 3
    ```

    *Received* is logged **before** *sent*. The listener thread got the message from Kafka before the web thread had finished logging the broker's acknowledgement. From producer, through three replicas, to consumer took a few milliseconds.

## Exercise 4.4 · Read the log from an offset

**Task:** read three messages from partition 0, starting at offset 2.

!!! solution "Solution"
    ```powershell
    curl.exe -s "http://localhost:8090/api/orders?partition=0&offset=2&limit=3"
    ```

    ```output
    [
      {"topic": "orders", "partition": 0, "offset": 2, "timestamp": "2026-10-01T01:02:26.712Z", "key": "alice", "value": {"order": 2001, "item": "keyboard", "amount": 45}},
      {"topic": "orders", "partition": 0, "offset": 3, "timestamp": "2026-10-01T01:02:27.004Z", "key": "alice", "value": {"order": 2004, "item": "headset", "amount": 60}},
      {"topic": "orders", "partition": 0, "offset": 4, "timestamp": "2026-10-01T01:02:27.142Z", "key": "bob", "value": {"order": 2007, "item": "cable", "amount": 9}}
    ]
    ```

    The CLI equivalent is `kafka-console-consumer.sh --partition 0 --offset 2 --max-messages 3`. Put the URL in quotes in PowerShell: an unquoted `&` is an operator.

## Exercise 4.5 · One customer's orders

**Task:** get all of alice's orders. How many partitions did the reader have to look in?

!!! solution "Solution"
    ```powershell
    curl.exe -s "http://localhost:8090/api/orders?customer=alice"
    ```

    ```output
    [
      {"topic": "orders", "partition": 0, "offset": 0, "timestamp": "2026-10-01T01:00:31.397Z", "key": "alice", "value": {"order": 2001, "item": "keyboard", "amount": 45}},
      {"topic": "orders", "partition": 0, "offset": 2, "timestamp": "2026-10-01T01:02:26.712Z", "key": "alice", "value": {"order": 2001, "item": "keyboard", "amount": 45}},
      {"topic": "orders", "partition": 0, "offset": 3, "timestamp": "2026-10-01T01:02:27.004Z", "key": "alice", "value": {"order": 2004, "item": "headset", "amount": 60}},
      {"topic": "orders", "partition": 0, "offset": 5, "timestamp": "2026-10-01T01:02:27.249Z", "key": "alice", "value": {"order": 2010, "item": "laptop stand", "amount": 55}}
    ]
    ```

    All four are in partition 0, in the order they were sent, with the duplicate 2001 included. The reader still scanned **all three** partitions: Kafka has no index by key, so it filtered the records in the app. Looking up by key is a job for a database or a Kafka Streams state store, which a topic is not.

## Exercise 4.6 · Reading does not delete

**Task:** read the whole topic twice. Does the second read return the same messages? Did the listener's group move?

!!! solution "Solution"
    ```powershell
    (Invoke-RestMethod "http://localhost:8090/api/orders?limit=50").Count
    ```

    ```output
    15
    ```

    That is 7 + 4 + 4 messages in the three partitions. Run it again as often as you like: the answer stays 15 until someone writes more. A topic is a **log, not a queue**, and consuming removes nothing. The reader uses `assign()` with no group and commits nothing, so `kafka-consumer-groups.sh --describe --group orders-api` shows the same offsets as before. There is also no new group in `--list`.

## Exercise 4.7 · Describe the topic over REST

**Task:** call `GET /api/orders/topic` and compare it with `kafka-topics.sh --describe` from Exercise 1.4.

!!! solution "Solution"
    ```powershell
    curl.exe -s http://localhost:8090/api/orders/topic
    ```

    ```output
    {"topic": "orders", "partitions": [
        {"partition": 0, "leader": 1, "replicas": [1, 2, 3], "isr": [1, 2, 3], "startOffset": 0, "endOffset": 7},
        {"partition": 1, "leader": 2, "replicas": [2, 3, 1], "isr": [2, 3, 1], "startOffset": 0, "endOffset": 4},
        {"partition": 2, "leader": 3, "replicas": [3, 1, 2], "isr": [3, 1, 2], "startOffset": 0, "endOffset": 4}
    ]}
    ```

    Same leaders, replicas and ISR as the CLI shows, because the CLI uses the same Admin API. `endOffset` is the **next** offset to be written. `endOffset - startOffset` is the number of messages still in the partition, as long as retention has not deleted any and the topic is not compacted.

!!! tip "Errors are JSON too"
    Ask for a partition that does not exist:

    ```powershell
    curl.exe -s "http://localhost:8090/api/orders?partition=7"
    ```

    ```output
    {"title":"Bad Request","status":400,"detail":"Topic orders has no partition 7","instance":"/api/orders"}
    ```
