# Lab 4 · Single Message Transforms

**Goal:** clean the orders on their way out of Kafka with a chain of built-in SMTs: mask the card number, drop the email, rename a field, and tag each message with where it came from. Then drop test messages with a `Filter` and a predicate. You write no code, only configuration.

## Exercise 4.1 · A chain of transforms

**Task:** create `orders-clean-sink`. It reads `shop-orders` again, parses each message as JSON, transforms it, and writes it to `lab\data\out\shop-orders-clean.txt`. Read the config first: what will a line look like?

<!-- include: lab/connectors/orders-clean-sink.json -->

!!! solution "Solution"
    ```powershell
    curl.exe -s -o NUL -w "HTTP %{http_code}\n" -X PUT localhost:8083/connectors/orders-clean-sink/config -H "Content-Type: application/json" --data "@lab/connectors/orders-clean-sink.json"
    Get-Content lab\data\out\shop-orders-clean.txt
    ```

    ```output
    HTTP 201
    {item=keyboard, total=45, kafka_offset=0, kafka_partition=2, source_system=orders_feed, card=****, order=3001, customer=alice}
    {item=monitor, total=210, kafka_offset=1, kafka_partition=2, source_system=orders_feed, card=****, order=3002, customer=dave}
    {item=mouse, total=18, kafka_offset=2, kafka_partition=2, source_system=orders_feed, card=****, order=3003, customer=carol}
    {item=headset, total=60, kafka_offset=3, kafka_partition=2, source_system=orders_feed, card=****, order=3004, customer=alice}
    {item=webcam, total=75, kafka_offset=4, kafka_partition=2, source_system=orders_feed, card=****, order=3005, customer=erin}
    {item=dock, total=140, kafka_offset=5, kafka_partition=2, source_system=orders_feed, card=****, order=3006, customer=frank}
    {item=cable, total=9, kafka_offset=6, kafka_partition=2, source_system=orders_feed, card=****, order=3007, customer=bob}
    {item=chair, total=320, kafka_offset=7, kafka_partition=2, source_system=orders_feed, card=****, order=3008, customer=dave}
    {item=desk lamp, total=35, kafka_offset=0, kafka_partition=0, source_system=orders_feed, card=****, order=3009, customer=carol}
    ```

    What happened to every record, step by step:

    | Step | What it did to `{"order":3001, ..., "amount":45, "email":"alice@...", "card":"4111..."}` |
    |---|---|
    | `JsonConverter` (`schemas.enable=false`) | Parsed the bytes into a map of fields. **SMTs need structure**: they cannot change a field inside a plain string |
    | `mask` - `MaskField$Value` | `card` became `****` |
    | `rename` - `ReplaceField$Value` | `email` removed, `amount` renamed to `total` |
    | `tag` - `InsertField$Value` | Added `source_system=orders_feed` (a fixed value), plus `kafka_partition` and `kafka_offset` (where the record came from) |
    | `FileStreamSink` | Wrote the result as text |

    The transforms run **in the order listed in `transforms`**, each one on the previous one's output. The `{key=value, ...}` format is how a Java map prints itself, which is all the FileStream sink knows how to do. A real sink, such as the JDBC sink in Lab 5, writes proper columns.

    Order 3009 is in partition **0**: the source's producer had moved on to a new batch, and so to another partition. `shop-orders` itself is unchanged. The SMTs only shaped what this one sink wrote. `orders-file-sink` and any consumer still see the full data, card numbers included.

!!! warning "Masking on the way out is too late for real PII"
    Here the card numbers are masked only in one output file. They are still stored in the topic, in clear text. To keep personal data out of Kafka completely, mask it in the **source** connector, before it is ever written. Lab 5 puts SMTs on a source.

## Exercise 4.2 · Filter out test messages

**Task:** a QA tool marks its test orders with a header named `test`. Change `orders-clean-sink` so that it drops every message that has this header, and only those. Then send one test order and one real order.

!!! solution "Solution"
    `Filter` drops every record, so on its own it is useless. Combined with a **predicate**, it drops only the records the predicate matches. `lab\connectors\orders-clean-sink-filter.json` puts it first in the chain:

    ```json
    "transforms": "dropTests,mask,rename,tag",

    "transforms.dropTests.type": "org.apache.kafka.connect.transforms.Filter",
    "transforms.dropTests.predicate": "isTest",
    "predicates": "isTest",
    "predicates.isTest.type": "org.apache.kafka.connect.transforms.predicates.HasHeaderKey",
    "predicates.isTest.name": "test",
    ```

    `PUT` the new config to the **same** connector name. That updates it, and the task restarts with the new chain:

    ```powershell
    curl.exe -s -o NUL -w "HTTP %{http_code}\n" -X PUT localhost:8083/connectors/orders-clean-sink/config -H "Content-Type: application/json" --data "@lab/connectors/orders-clean-sink-filter.json"
    ```

    ```output
    HTTP 200
    ```

    Send a test order with a header, then a real one. The console producer reads a header from the start of the line, up to a tab:

    ```kafka
    kafka-console-producer.sh --bootstrap-server kafka1:9092 --topic shop-orders --reader-property parse.headers=true
    >test:yes	{"order":9999,"customer":"qa-bot","item":"test item","amount":1,"email":"qa@example.com","card":"0000000000000000"}
    >^C
    ```

    ```powershell
    docker exec connect1 bash /lab/add-order.sh 3010 erin "usb hub" 22
    Get-Content lab\data\out\shop-orders.txt -Tail 2
    Get-Content lab\data\out\shop-orders-clean.txt -Tail 2
    ```

    ```output
    {"order":9999,"customer":"qa-bot","item":"test item","amount":1,"email":"qa@example.com","card":"0000000000000000"}
    {"order":3010,"customer":"erin","item":"usb hub","amount":22,"email":"erin@example.com","card":"4111111111111111"}

    {item=desk lamp, total=35, kafka_offset=0, kafka_partition=0, source_system=orders_feed, card=****, order=3009, customer=carol}
    {item=usb hub, total=22, kafka_offset=2, kafka_partition=0, source_system=orders_feed, card=****, order=3010, customer=erin}
    ```

    The plain sink wrote both messages. The clean sink jumped from offset 0 to offset **2**: offset 1, the test order, was dropped. Check with the headers shown:

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic shop-orders --partition 0 --offset 0 --max-messages 3 \
      --formatter-property print.headers=true --formatter-property print.offset=true
    ```

    ```output
    Offset:0	NO_HEADERS	{"order":3009,"customer":"carol","item":"desk lamp","amount":35,...}
    Offset:1	test:yes	{"order":9999,"customer":"qa-bot","item":"test item","amount":1,...}
    Offset:2	NO_HEADERS	{"order":3010,"customer":"erin","item":"usb hub","amount":22,...}
    ```

    (Values shortened.) Kafka ships three predicates: `HasHeaderKey`, `TopicNameMatches` and `RecordIsTombstone`. They test the record's envelope, not the contents of its fields. To filter on a field value, such as "orders over 100", you need either an SMT from another project or **stream processing** (Module 10).

## Exercise 4.3 · Think about it

1. Why can no SMT turn `{"amount":45}` and `{"amount":60}` into a running total for alice? *(SMTs see one message at a time and remember nothing. That is the "stateless" rule from the lesson.)*
2. You add `ValueToKey` with `fields=customer` to `orders-file-source`. Why does it fail? *(The source produces a plain string. Like every SMT that works on fields, `ValueToKey` needs structured data, which a JSON-parsing converter on a sink, or a structured source such as JDBC, provides.)*
3. `ReplaceField` used to be configured with `blacklist` and `whitelist`. Which settings replaced them? *(`exclude` and `include`.)*
