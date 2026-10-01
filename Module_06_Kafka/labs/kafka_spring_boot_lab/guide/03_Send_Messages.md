# Lab 3 · Send Messages over REST

**Goal:** send orders through `POST /api/orders` with `curl.exe`, PowerShell and a script, then confirm with the CLI that they are in the topic, in the partitions their keys chose.

The app must be running (Lab 1). Run the commands in the `orders-api` folder.

## Exercise 3.1 · Your first order, with curl.exe

**Task:** send alice's order 2001 from `samples\order.json` and read the response. Which partition and offset did Kafka give it?

!!! solution "Solution"
    ```powershell
    type samples\order.json
    curl.exe -i -X POST http://localhost:8090/api/orders -H "Content-Type: application/json" --data "@samples/order.json"
    ```

    ```output
    {"customer": "alice", "order": 2001, "item": "keyboard", "amount": 45}

    HTTP/1.1 201
    Content-Type: application/json

    {"topic":"orders","partition":0,"offset":0,"timestamp":"2026-10-01T01:00:31.397Z","key":"alice","value":{"order":2001,"item":"keyboard","amount":45}}
    ```

    **201 Created**, and the body is the receipt: partition **0**, offset **0**, the first message ever written to that partition. The `timestamp` was set by the producer when it sent the record. It is UTC, which is why it reads 01:00 for a send made at 06:30 IST.

!!! warning "Type curl.exe, not curl"
    In Windows PowerShell, `curl` is an **alias for `Invoke-WebRequest`**, which takes different options, so `curl -X POST ...` fails with a confusing error. `curl.exe` runs the real curl that ships with Windows.

## Exercise 3.2 · JSON on the command line - the PowerShell trap

**Task:** pass the JSON directly with `-d` instead of from a file. Try it with plain single quotes first.

!!! solution "Solution"
    To keep the topic clean, these tries send an **invalid** order, so even a request that gets through is rejected before it reaches Kafka:

    ```powershell
    curl.exe -s -X POST http://localhost:8090/api/orders -H "Content-Type: application/json" -d '{"customer":"","order":0,"item":"pen","amount":-5}'
    curl.exe -s -X POST http://localhost:8090/api/orders -H "Content-Type: application/json" -d '{\"customer\":\"\",\"order\":0,\"item\":\"pen\",\"amount\":-5}'
    ```

    ```output
    {"title":"Bad Request","status":400,"detail":"Failed to read request","instance":"/api/orders"}
    {"title":"Bad Request","status":400,"detail":"The order is not valid - nothing was sent to Kafka","instance":"/api/orders","errors":{"amount":"must be greater than 0","customer":"must not be blank","order":"must be greater than 0"}}
    ```

    The first request never arrived as JSON. **Windows PowerShell 5.1 removes the inner double quotes** when it passes an argument to a program such as `curl.exe`, so the server received `{customer:,order:0,...}` and could not parse it: *Failed to read request*. With the quotes escaped as `\"`, the JSON arrives intact and the server's validation answers instead.

    Three ways to avoid the trap: a file with `--data "@file.json"` (Exercise 3.1), `Invoke-RestMethod` (next exercise), or PowerShell 7, which passes the quotes through correctly.

## Exercise 3.3 · Send with PowerShell

**Task:** send bob's order 2000 (a pen drive for 12) with `Invoke-RestMethod`.

!!! solution "Solution"
    ```powershell
    $body = @{ customer = "bob"; order = 2000; item = "pen drive"; amount = 12 } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri http://localhost:8090/api/orders -ContentType 'application/json' -Body $body
    ```

    ```output
    topic     : orders
    partition : 0
    offset    : 1
    timestamp : 2026-10-01T01:02:25.827Z
    key       : bob
    value     : @{order=2000; item=pen drive; amount=12}
    ```

    `Invoke-RestMethod` builds the JSON itself with `ConvertTo-Json`, so there is no quoting to get wrong. It also parses the response into an object you can use: `$r.partition`, `$r.value.item`. Bob also landed in partition 0, at the next offset, 1.

## Exercise 3.4 · Load the CLI lab's orders

**Task:** run `send-orders.ps1` from the lab folder. It posts every line of `kafka_cli_lab\lab\data\orders.txt`. Which partition does each customer get? Do all of one customer's orders land in the same place?

!!! solution "Solution"
    ```powershell
    cd ..
    powershell -ExecutionPolicy Bypass -File .\send-orders.ps1
    ```

    ```output
    alice  order 2001  ->  orders-0 @ offset 2
    dave   order 2002  ->  orders-1 @ offset 0
    carol  order 2003  ->  orders-2 @ offset 0
    alice  order 2004  ->  orders-0 @ offset 3
    erin   order 2005  ->  orders-2 @ offset 1
    frank  order 2006  ->  orders-1 @ offset 1
    bob    order 2007  ->  orders-0 @ offset 4
    dave   order 2008  ->  orders-1 @ offset 2
    carol  order 2009  ->  orders-2 @ offset 2
    alice  order 2010  ->  orders-0 @ offset 5
    ```

    | Partition | Customers |
    |---|---|
    | 0 | alice, bob |
    | 1 | dave, frank |
    | 2 | carol, erin |

    **The key decides the partition**: `murmur2(key) % 3`, exactly as with the console producer in the CLI lab. All of alice's orders went to partition 0, at offsets 0, 2, 3 and 5, so they are stored, and will be read, in the order she placed them. Offsets count **per partition**: partition 1 starts again at 0.

    `-ExecutionPolicy Bypass` lets this one script run even when Windows blocks unsigned scripts. It changes no setting.

!!! note "Order 2001 is in the topic twice"
    `orders.txt` starts with alice's order 2001, the same one you sent in Exercise 3.1. Kafka stored it again, at offset 2. **Idempotence only protects against duplicates caused by the producer's own retries.** Two separate sends of the same data are two messages. Removing duplicates of that kind is the application's job, for example a consumer that remembers which order numbers it has already handled.

## Exercise 3.5 · Check with the CLI

**Task:** read the whole topic with `kafka-console-consumer.sh` and show the partition, offset and key of every message. Is it what the API reported?

!!! solution "Solution"
    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic orders --from-beginning --max-messages 12 \
      --formatter-property print.key=true --formatter-property print.partition=true --formatter-property print.offset=true
    ```

    ```output
    Partition:0	Offset:0	alice	{"order":2001,"item":"keyboard","amount":45}
    Partition:0	Offset:1	bob	{"order":2000,"item":"pen drive","amount":12}
    Partition:0	Offset:2	alice	{"order":2001,"item":"keyboard","amount":45}
    Partition:0	Offset:3	alice	{"order":2004,"item":"headset","amount":60}
    Partition:0	Offset:4	bob	{"order":2007,"item":"cable","amount":9}
    Partition:0	Offset:5	alice	{"order":2010,"item":"laptop stand","amount":55}
    Partition:1	Offset:0	dave	{"order":2002,"item":"monitor","amount":210}
    Partition:1	Offset:1	frank	{"order":2006,"item":"dock","amount":140}
    Partition:1	Offset:2	dave	{"order":2008,"item":"chair","amount":320}
    Partition:2	Offset:0	carol	{"order":2003,"item":"mouse","amount":18}
    Partition:2	Offset:1	erin	{"order":2005,"item":"webcam","amount":75}
    Partition:2	Offset:2	carol	{"order":2009,"item":"desk lamp","amount":35}
    Processed a total of 12 messages
    ```

    Every message is where the API said it would be. To Kafka, the app is just another producer: the CLI consumer reads its messages like any others. The values are plain JSON text, because the app sent them through a `StringSerializer`.

## Exercise 3.6 · A bad order

**Task:** send an order with an empty customer, order number 0 and a negative amount, and look at the status code and the body.

!!! solution "Solution"
    ```powershell
    curl.exe -i -X POST http://localhost:8090/api/orders -H "Content-Type: application/json" -d '{\"customer\":\"\",\"order\":0,\"item\":\"pen\",\"amount\":-5}'
    ```

    ```output
    HTTP/1.1 400
    Content-Type: application/problem+json

    {
      "title": "Bad Request",
      "status": 400,
      "detail": "The order is not valid - nothing was sent to Kafka",
      "instance": "/api/orders",
      "errors": {
        "amount": "must be greater than 0",
        "customer": "must not be blank",
        "order": "must be greater than 0"
      }
    }
    ```

    (Body formatted for reading.) `@Valid` checked the `OrderRequest` before the controller method ran, so `OrderProducer` was never called. Check with the CLI consumer: the topic still has 12 messages. Validate at the edge. A message in Kafka cannot be taken back, and every consumer will have to deal with it.
