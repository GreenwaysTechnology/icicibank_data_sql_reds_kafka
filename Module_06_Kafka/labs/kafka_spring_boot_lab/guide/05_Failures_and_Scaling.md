# Lab 5 · Failures and Scaling

**Goal:** see the course's ideas work in a real application. Stop a broker, and the app keeps sending. Start a second copy of the app, and the consumer group splits the partitions between the two.

## Exercise 5.1 · A broker fails

**Task:** stop `kafka2`, then send two orders: ivan's 2019 and dave's 2020. Do they succeed, and how long do they take? Then describe the topic.

!!! solution "Solution"
    ```powershell
    docker stop kafka2
    curl.exe -s -w "\nHTTP %{http_code} in %{time_total}s\n" -X POST http://localhost:8090/api/orders -H "Content-Type: application/json" -d '{\"customer\":\"ivan\",\"order\":2019,\"item\":\"hdmi cable\",\"amount\":15}'
    curl.exe -s -w "\nHTTP %{http_code} in %{time_total}s\n" -X POST http://localhost:8090/api/orders -H "Content-Type: application/json" -d '{\"customer\":\"dave\",\"order\":2020,\"item\":\"footrest\",\"amount\":40}'
    ```

    ```output
    kafka2
    {"topic":"orders","partition":2,"offset":4,"timestamp":"2026-10-01T01:04:55.984Z","key":"ivan","value":{"order":2019,"item":"hdmi cable","amount":15}}
    HTTP 201 in 0.052261s
    {"topic":"orders","partition":1,"offset":4,"timestamp":"2026-10-01T01:04:56.152Z","key":"dave","value":{"order":2020,"item":"footrest","amount":40}}
    HTTP 201 in 0.059433s
    ```

    ```powershell
    curl.exe -s http://localhost:8090/api/orders/topic
    ```

    ```output
    {"topic": "orders", "partitions": [
        {"partition": 0, "leader": 1, "replicas": [1, 2, 3], "isr": [1, 3], "startOffset": 0, "endOffset": 7},
        {"partition": 1, "leader": 3, "replicas": [2, 3, 1], "isr": [3, 1], "startOffset": 0, "endOffset": 5},
        {"partition": 2, "leader": 3, "replicas": [3, 1, 2], "isr": [3, 1], "startOffset": 0, "endOffset": 5}
    ]}
    ```

    Both sends succeeded in about 50 ms, and the app noticed nothing. Broker 2 had led partition 1. The controller made broker **3** the new leader, and the producer's next metadata refresh pointed it there. Broker 2 also dropped out of every **ISR**. With `acks=all`, a write now waits for two replicas instead of three. That is still allowed, because `min.insync.replicas=2`.

## Exercise 5.2 · The broker comes back

**Task:** start `kafka2` again. When it is healthy, describe the topic once more. Is everything as before?

!!! solution "Solution"
    ```powershell
    docker start kafka2
    docker inspect -f "{{.State.Health.Status}}" kafka2      # repeat until it says healthy
    curl.exe -s http://localhost:8090/api/orders/topic
    ```

    ```output
    {"topic": "orders", "partitions": [
        {"partition": 0, "leader": 1, "replicas": [1, 2, 3], "isr": [1, 2, 3], "startOffset": 0, "endOffset": 7},
        {"partition": 1, "leader": 3, "replicas": [2, 3, 1], "isr": [1, 2, 3], "startOffset": 0, "endOffset": 5},
        {"partition": 2, "leader": 3, "replicas": [3, 1, 2], "isr": [1, 2, 3], "startOffset": 0, "endOffset": 5}
    ]}
    ```

    Broker 2 copied the messages it had missed, ivan's and dave's, from the leaders and **rejoined every ISR**. But partition 1 is still led by broker **3**, even though its preferred leader is the first replica in the list, broker 2. The cluster moves leadership back on its own within about 5 minutes (`leader.imbalance.check.interval.seconds=300`). You can also do it at once with `kafka-leader-election.sh --election-type preferred`, as in Lab 3 of the CLI lab.

!!! warning "What if two brokers stop?"
    Try it yourself and work out the answer first. With only one broker left, the ISR cannot reach `min.insync.replicas=2`, so an `acks=all` write cannot succeed. The KRaft quorum has also lost its majority, 1 vote of 3. The producer keeps retrying until `delivery.timeout.ms` (25 s) runs out. The app then answers **503** with the `Kafka unavailable` problem JSON. Start both brokers again before you go on.

## Exercise 5.3 · Scale out: a second instance

**Task:** leave the first instance running. Start a second one on port 8091, in a second PowerShell window, then look at both logs and at the group.

!!! solution "Solution"
    ```powershell
    java -jar target\orders-api-1.0.0.jar --server.port=8091
    ```

    First instance (8090):

    ```output
    06:34:12.526 [-listener-0-C-1] KafkaMessageListenerContainer : orders-api: partitions assigned: [orders-0, orders-1, orders-2]
    06:36:21.623 [-listener-0-C-1] KafkaMessageListenerContainer : orders-api: partitions revoked: [orders-0, orders-1, orders-2]
    06:36:21.636 [-listener-0-C-1] KafkaMessageListenerContainer : orders-api: partitions assigned: [orders-2]
    ```

    Second instance (8091):

    ```output
    06:36:21.658 [-listener-0-C-1] KafkaMessageListenerContainer : orders-api: partitions assigned: [orders-0, orders-1]
    ```

    ```kafka
    kafka-consumer-groups.sh --bootstrap-server kafka1:9092 --describe --group orders-api
    ```

    ```output
    GROUP       TOPIC   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID
    orders-api  orders  0          7               7               0    orders-api-0-4027d0d1-5f1f-4860-a1c5-586cff2cde43
    orders-api  orders  1          5               5               0    orders-api-0-4027d0d1-5f1f-4860-a1c5-586cff2cde43
    orders-api  orders  2          5               5               0    orders-api-0-d8ba3877-0fbe-4846-b567-c821c4d54034
    ```

    That is a **rebalance**. The second instance joined the same group, so the first gave up all its partitions. The group then shared them out again: partitions 0 and 1 to the new member, partition 2 to the old one. Each partition still has **exactly one** reader in the group, so the order within each partition is kept. The two `CONSUMER-ID`s are the two instances.

    No code changed. **Scaling a consumer means starting more copies of it, up to the number of partitions.** A fourth instance on this 3-partition topic would get nothing and wait as a standby.

## Exercise 5.4 · Who receives what?

**Task:** send alice's order 2021 (a mouse pad for 8) **to the first instance, on port 8090**. Which instance's listener receives it?

!!! solution "Solution"
    ```powershell
    curl.exe -s -X POST http://localhost:8090/api/orders -H "Content-Type: application/json" -d '{\"customer\":\"alice\",\"order\":2021,\"item\":\"mouse pad\",\"amount\":8}'
    curl.exe -s http://localhost:8091/api/orders/received
    ```

    ```output
    {"topic":"orders","partition":0,"offset":7,"timestamp":"2026-10-01T01:06:36.888Z","key":"alice","value":{"order":2021,"item":"mouse pad","amount":8}}
    [
      {"topic": "orders", "partition": 0, "offset": 7, "timestamp": "2026-10-01T01:06:36.888Z", "key": "alice", "value": {"order": 2021, "item": "mouse pad", "amount": 8}}
    ]
    ```

    The logs of the two instances:

    ```output
    8090: 06:36:36.919 [nio-8090-exec-7] OrderProducer : sent     key=alice -> orders-0 @ offset 7
    8091: 06:36:37.008 [-listener-0-C-1] OrderListener : received key=alice <- orders-0 @ offset 7
    ```

    Instance 8090 **sent** the order, but instance 8091 **received** it, because 8091 owns partition 0. The producer side and the consumer side of an app are independent clients: who sends a message has nothing to do with who reads it. The partition alone decides.

    Notice also that 8091's `/received` holds one message, while 8090's holds the older ones. With several instances, an in-memory view is only ever part of the picture. That is one more reason to read from the topic, or from a shared store.

## Exercise 5.5 · Scale back in

**Task:** stop the second instance with Ctrl+C and watch the first instance's log.

!!! solution "Solution"
    ```output
    06:39:42.713 [-listener-0-C-1] KafkaMessageListenerContainer : orders-api: partitions revoked: [orders-2]
    06:39:42.727 [-listener-0-C-1] KafkaMessageListenerContainer : orders-api: partitions assigned: [orders-0, orders-1, orders-2]
    ```

    Another rebalance: the survivor takes over all three partitions. It resumes 0 and 1 from the offsets the second instance committed, so nothing is lost and nothing is read twice. With Ctrl+C this happens **at once**, because the leaving instance tells the group coordinator. If an instance crashes, the group waits for `session.timeout.ms`, 45 s, before it moves that instance's partitions. The instance in this capture was killed rather than stopped with Ctrl+C, so the rebalance waited out that timeout.

## Challenges

No solutions this time: the earlier exercises give you everything you need.

1. **Replay the whole topic.** Stop the app. Use `kafka-consumer-groups.sh --reset-offsets --to-earliest --group orders-api --topic orders --execute` (CLI Lab 7), then start the app again. What does `/received` show, and why does it hold at most 50 messages?
2. **A second group.** Start an instance with `--app.listener-group-id=orders-audit --server.port=8092`. Which messages does it receive? Does it change anything for the group `orders-api`?
3. **Asynchronous sending.** Change `OrderProducer` so that it does not wait. Return `202 Accepted` at once, and log the partition and offset in a `whenComplete` callback. What does the caller lose?
4. **More partitions.** Change the `NewTopic` bean to 6 partitions and restart. What does `KafkaAdmin` do to the existing topic? Which partitions do alice's **new** orders go to now, and what does that mean for the order of her messages?
