# Lab 1 · Build and Run the App

**Goal:** start the cluster, build `orders-api` with the Maven wrapper, run it, and check that it found the `orders` topic, or created it.

## Exercise 1.1 · Start the cluster

**Task:** start the three brokers from the CLI lab and wait until all three are healthy.

!!! solution "Solution"
    ```powershell
    cd D:\trainings\Apache_Kafka_Training\labs\kafka_cli_lab
    docker compose up -d
    docker compose ps
    ```

    ```output
    NAME      IMAGE                STATUS                   PORTS
    kafka1    apache/kafka:4.3.1   Up 2 hours (healthy)     0.0.0.0:19092->19092/tcp
    kafka2    apache/kafka:4.3.1   Up 5 minutes (healthy)   0.0.0.0:29092->29092/tcp
    kafka3    apache/kafka:4.3.1   Up 2 hours (healthy)     0.0.0.0:39092->39092/tcp
    ```

    (Columns trimmed.) The `PORTS` column matters for the app. Each broker publishes its **EXTERNAL** listener on the Windows host: `localhost:19092`, `29092` and `39092`. Code running on Windows has to use those addresses. Inside Docker, the brokers call each other `kafka1:9092` and so on, and those names mean nothing to Windows.

## Exercise 1.2 · Build

**Task:** build the application jar with the Maven wrapper.

!!! solution "Solution"
    ```powershell
    cd D:\trainings\Apache_Kafka_Training\labs\kafka_spring_boot_lab\orders-api
    .\mvnw.cmd -DskipTests package
    ```

    The first run downloads Maven itself and then all the libraries into `%USERPROFILE%\.m2`, which takes a minute or two. Later builds take seconds:

    ```output
    [INFO] --- jar:3.5.1:jar (default-jar) @ orders-api ---
    [INFO]
    [INFO] --- spring-boot:4.1.1:repackage (repackage) @ orders-api ---
    [INFO] Replacing main artifact ...\orders-api\target\orders-api-1.0.0.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
    [INFO] ------------------------------------------------------------------------
    [INFO] BUILD SUCCESS
    [INFO] ------------------------------------------------------------------------
    [INFO] Total time:  4.452 s
    ```

    `target\orders-api-1.0.0.jar` is a **fat jar**: your classes plus every library they need, Tomcat and the Kafka client included. You can copy that one file to any machine with Java 21 and run it.

## Exercise 1.3 · Run

**Task:** start the app and find the log lines that show it is connected to Kafka.

!!! solution "Solution"
    ```powershell
    java -jar target\orders-api-1.0.0.jar
    ```

    `.\mvnw.cmd spring-boot:run` works too: it builds and starts the app in one step. Abridged log, columns trimmed:

    ```output
     :: Spring Boot ::                (v4.1.1)

    06:30:17.564 [main] OrdersApiApplication : Starting OrdersApiApplication v1.0.0 using Java 21.0.12
    06:30:21.138 [main] TomcatWebServer      : Tomcat initialized with port 8090 (http)
    06:30:24.501 [main] TomcatWebServer      : Tomcat started on port 8090 (http) with context path '/'
    06:30:24.969 [main] OrdersApiApplication : Started OrdersApiApplication in 8.886 seconds
    06:30:25.300 [-listener-0-C-1] KafkaMessageListenerContainer : orders-api: partitions assigned: [orders-0, orders-1, orders-2]
    ```

    The last line is the one that matters. The `@KafkaListener` joined the consumer group **`orders-api`**. It is the group's only member, so the group coordinator gave it **all three partitions** of `orders`. That consumer runs on its own thread (`...-listener-0-C-1`), separate from the web requests.

    Leave the app running. Stop it with **Ctrl+C** when you are done.

!!! tip "The Kafka clients are quiet on purpose"
    `application.yml` sets `logging.level.org.apache.kafka: WARN`. At `INFO`, the clients print every config value at startup: about 150 lines for the producer and the same again for each consumer. To see them, start with `java -jar target\orders-api-1.0.0.jar --logging.level.org.apache.kafka=INFO`.

## Exercise 1.4 · Is the topic there?

**Task:** check the `orders` topic from the CLI. If it did not exist before, who created it, and with which settings?

!!! solution "Solution"
    ```kafka
    kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic orders
    ```

    ```output
    Topic: orders	TopicId: Gpz6jYWrS1eRMUNaMO36tw	PartitionCount: 3	ReplicationFactor: 3	Configs: min.insync.replicas=2
    	Topic: orders	Partition: 0	Leader: 1	Replicas: 1,2,3	Isr: 1,2,3	Elr: 	LastKnownElr:
    	Topic: orders	Partition: 1	Leader: 2	Replicas: 2,3,1	Isr: 2,3,1	Elr: 	LastKnownElr:
    	Topic: orders	Partition: 2	Leader: 3	Replicas: 3,1,2	Isr: 3,1,2	Elr: 	LastKnownElr:
    ```

    The cluster has `auto.create.topics.enable=false`, so producing to a missing topic would fail. The app declares the topic it needs as a `NewTopic` bean (Lab 2). At startup, Spring's `KafkaAdmin` creates any declared topic that is missing, here with 3 partitions and replication factor 3, the same as Lab 2 of the CLI lab. `min.insync.replicas=2` is the cluster default from `docker-compose.yml`.

    If `orders` already exists, for example from the CLI lab, `KafkaAdmin` leaves it alone. The listener then starts by reading every message already in the topic: a **new** group has no committed offsets, and the app sets `auto-offset-reset: earliest`.

!!! warning "Running the app somewhere else"
    `localhost:19092` only works on the Windows host that runs Docker. For any other location, override the bootstrap servers when you start the app. For example, for a container on the lab's Docker network:

    ```powershell
    java -jar target\orders-api-1.0.0.jar --spring.kafka.bootstrap-servers=kafka1:9092,kafka2:9092,kafka3:9092
    ```

    Any property in `application.yml` can be overridden like this, or with an environment variable such as `SPRING_KAFKA_BOOTSTRAP_SERVERS`.
