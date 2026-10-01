# Lab 5 · Database to Database with JDBC

**Goal:** build the lesson's own example. A source connector reads the `users` table from PostgreSQL and adds `source_system = users_db` to every message. A sink connector then writes those messages into a table in **another** database. You will see inserts and updates flow through, and the sink create its table by itself.

The JDBC connector is not part of Apache Kafka. It is Confluent's, free to use under the Confluent Community License, and installed from Confluent Hub. It polls tables with SQL queries, so it needs no special setup in the database. (A CDC connector such as Debezium reads the database's transaction log instead, and so also sees deletes. It is free too, but needs more setup.)

## Exercise 5.1 · Install a connector plugin

**Task:** download the JDBC connector into `plugins\`, restart the worker, and check that it now lists the JDBC connectors.

!!! solution "Solution"
    ```powershell
    powershell -ExecutionPolicy Bypass -File .\get-jdbc-connector.ps1
    ```

    ```output
    Downloading https://hub-downloads.confluent.io/api/plugins/confluentinc/kafka-connect-jdbc/versions/10.9.9/confluentinc-kafka-connect-jdbc-10.9.9.zip
    Installed: plugins\confluentinc-kafka-connect-jdbc-10.9.9

    Name                             KB
    ----                             --
    common-utils-7.0.12.jar          17
    kafka-connect-jdbc-10.9.9.jar   359
    mssql-jdbc-12.8.2.jre8.jar     1178
    ojdbc8-19.7.0.0.jar            4296
    postgresql-42.7.12.jar         1116
    sqlite-jdbc-3.41.2.2.jar      12550
    ...                                     (19 jars)
    ```

    The connector, `kafka-connect-jdbc`, comes **with the JDBC drivers** it needs: PostgreSQL, SQL Server, Oracle and SQLite. That is a plugin: a folder of jars that the worker loads in its **own class loader**, isolated from other plugins, so two connectors can use different versions of the same library.

    ```powershell
    docker compose restart connect1
    curl.exe -s localhost:8083/connector-plugins
    ```

    ```output
    [
      {"class": "io.confluent.connect.jdbc.JdbcSinkConnector", "type": "sink", "version": "10.9.9"},
      {"class": "org.apache.kafka.connect.file.FileStreamSinkConnector", "type": "sink", "version": "4.3.1"},
      {"class": "io.confluent.connect.jdbc.JdbcSourceConnector", "type": "source", "version": "10.9.9"},
      {"class": "org.apache.kafka.connect.file.FileStreamSourceConnector", "type": "source", "version": "4.3.1"},
      ... the three Mirror connectors
    ]
    ```

    Workers scan `plugin.path` **only at startup**, so a new plugin needs a restart. Notice that your three connectors carried on after the restart without you doing anything. Their configs and offsets are in Kafka (Lab 1).

## Exercise 5.2 · The source table

**Task:** look at the `users` table in the `shop` database.

!!! solution "Solution"
    ```powershell
    docker exec -it postgres psql -U lab -d shop
    ```

    ```sql
    SELECT * FROM users;
    ```

    ```output
     id | name |      email      | country |       updated_at
    ----+------+-----------------+---------+-------------------------
      1 | ana  | ana@example.com | PT      | 2026-10-01 01:29:51.579
      2 | raj  | raj@example.com | IN      | 2026-10-01 01:29:51.579
      3 | li   | li@example.com  | CN      | 2026-10-01 01:29:51.579
      4 | sam  | sam@example.com | US      | 2026-10-01 01:29:51.579
    (4 rows)
    ```

    `lab\sql\01_shop.sql` created this table when the container first started. Two columns matter to the connector: `id` only ever grows, and a trigger sets **`updated_at`** on every `UPDATE`.

## Exercise 5.3 · The source connector, with the lesson's SMT

**Task:** create `users-db-source` and read the topic it fills. What is the key of each message? Where did `source_system` come from?

<!-- include: lab/connectors/users-db-source.json -->

!!! solution "Solution"
    ```powershell
    curl.exe -s -o NUL -w "HTTP %{http_code}\n" -X PUT localhost:8083/connectors/users-db-source/config -H "Content-Type: application/json" --data "@lab/connectors/users-db-source.json"
    ```

    ```kafka
    kafka-console-consumer.sh --bootstrap-server kafka1:9092 --topic pg-users --from-beginning --max-messages 4 \
      --formatter-property print.key=true --formatter-property print.partition=true
    ```

    One message in full, formatted:

    ```output
    Partition:2	2	{"schema": {"type": "struct", "name": "users", "optional": false,
                         "fields": [{"field": "id",            "type": "int32",  "optional": false},
                                    {"field": "name",          "type": "string", "optional": false},
                                    {"field": "email",         "type": "string", "optional": false},
                                    {"field": "country",       "type": "string", "optional": false},
                                    {"field": "updated_at",    "type": "int64",  "optional": false,
                                     "name": "org.apache.kafka.connect.data.Timestamp", "version": 1},
                                    {"field": "source_system", "type": "string", "optional": true}]},
                      "payload": {"id": 2, "name": "raj", "email": "raj@example.com", "country": "IN",
                                  "updated_at": 1790818191579, "source_system": "users_db"}}
    ```

    The four messages, payload only:

    ```output
    Partition:2  key=2  {"id":2,"name":"raj","email":"raj@example.com","country":"IN","updated_at":1790818191579,"source_system":"users_db"}
    Partition:2  key=3  {"id":3,"name":"li","email":"li@example.com","country":"CN","updated_at":1790818191579,"source_system":"users_db"}
    Partition:0  key=1  {"id":1,"name":"ana","email":"ana@example.com","country":"PT","updated_at":1790818191579,"source_system":"users_db"}
    Partition:1  key=4  {"id":4,"name":"sam","email":"sam@example.com","country":"US","updated_at":1790818191579,"source_system":"users_db"}
    ```

    - **One row, one message**, in topic `topic.prefix` + table name: `pg-users`.
    - **`source_system: "users_db"`** is in every message, though the table has no such column. That is `InsertField`, exactly as in the lesson.
    - **The key is the row's `id`.** `ValueToKey` copied `id` into the key as a small struct, and `ExtractField$Key` reduced that struct to the plain value. Now every version of row 3 goes to the same partition, in order.
    - **The schema travels with every message**, because `schemas.enable=true`. The JDBC **sink** needs it to know the column types. That costs a lot of bytes per message. With **Schema Registry** (Module 8) and Avro, a message carries a 4-byte schema id instead.

## Exercise 5.4 · The sink connector

**Task:** create `users-db-sink`, which writes `pg-users` into the table `users_replica` in the **`analytics`** database. The table does not exist yet. Look at it afterwards.

<!-- include: lab/connectors/users-db-sink.json -->

!!! solution "Solution"
    ```powershell
    curl.exe -s -o NUL -w "HTTP %{http_code}\n" -X PUT localhost:8083/connectors/users-db-sink/config -H "Content-Type: application/json" --data "@lab/connectors/users-db-sink.json"
    docker exec -it postgres psql -U lab -d analytics
    ```

    ```sql
    \d users_replica
    SELECT * FROM users_replica ORDER BY id;
    ```

    ```output
                             Table "public.users_replica"
        Column     |            Type             | Collation | Nullable | Default
    ---------------+-----------------------------+-----------+----------+---------
     id            | integer                     |           | not null |
     name          | text                        |           | not null |
     email         | text                        |           | not null |
     country       | text                        |           | not null |
     updated_at    | timestamp without time zone |           | not null |
     source_system | text                        |           |          |
    Indexes:
        "users_replica_pkey" PRIMARY KEY, btree (id)

     id | name |      email      | country |       updated_at        | source_system
    ----+------+-----------------+---------+-------------------------+---------------
      1 | ana  | ana@example.com | PT      | 2026-10-01 01:29:51.579 | users_db
      2 | raj  | raj@example.com | IN      | 2026-10-01 01:29:51.579 | users_db
      3 | li   | li@example.com  | CN      | 2026-10-01 01:29:51.579 | users_db
      4 | sam  | sam@example.com | US      | 2026-10-01 01:29:51.579 | users_db
    (4 rows)
    ```

    `auto.create=true` built the table **from the schema in the messages**: `int32` became `integer`, the `Timestamp` type became `timestamp`, and `pk.fields=id` became the primary key. The new column `source_system` came along, because to the sink it is just another field.

## Exercise 5.5 · Changes flow through

**Task:** in `shop`, add a user and change li's country. What reaches the replica, and how?

!!! solution "Solution"
    ```sql
    INSERT INTO users (name, email, country) VALUES ('mia', 'mia@example.com', 'DE');
    UPDATE users SET country = 'SG' WHERE name = 'li';
    ```

    A few seconds later, in `analytics`:

    ```sql
    SELECT id, name, country, updated_at, source_system FROM users_replica ORDER BY id;
    ```

    ```output
     id | name | country |       updated_at        | source_system
    ----+------+---------+-------------------------+---------------
      1 | ana  | PT      | 2026-10-01 01:29:51.579 | users_db
      2 | raj  | IN      | 2026-10-01 01:29:51.579 | users_db
      3 | li   | SG      | 2026-10-01 01:38:43.729 | users_db
      4 | sam  | US      | 2026-10-01 01:29:51.579 | users_db
      5 | mia  | DE      | 2026-10-01 01:38:43.725 | users_db
    (5 rows)
    ```

    The topic shows how: every `poll.interval.ms` (2 s), the source asks for rows whose `updated_at` or `id` is past its last offset.

    ```output
    Partition:2 Offset:1 key=3 {"id":3,"name":"li","email":"li@example.com","country":"CN",...}
    Partition:2 Offset:2 key=3 {"id":3,"name":"li","email":"li@example.com","country":"SG",...}
    Partition:0 Offset:1 key=5 {"id":5,"name":"mia","email":"mia@example.com","country":"DE",...}
    ```

    The update became a **new message** with the same key, in the same partition, after the old one. The topic keeps li's history. The sink, with `insert.mode=upsert`, turned it into an `UPDATE` of row 3.

    The source's offset is again a position in **its** world, not Kafka's:

    ```powershell
    curl.exe -s localhost:8083/connectors/users-db-source/offsets
    ```

    ```output
    {"offsets":[{"partition":{"protocol":"1","table":"public.users"},"offset":{"timestamp_nanos":729000000,"incrementing":3,"timestamp":1790818723729}}]}
    ```

!!! warning "What a polling source cannot see"
    A **deleted** row produces no message. The query cannot find a row that is no longer there. An `UPDATE` that does not change `updated_at` is missed too, which is why this table has a trigger. When you need deletes and every change, use log-based CDC: **Debezium**, which reads PostgreSQL's write-ahead log.
