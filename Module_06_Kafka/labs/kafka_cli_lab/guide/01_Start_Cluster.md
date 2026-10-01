# Lab 1 · Start the Kafka Cluster

**Goal:** start the three brokers, prove they formed one cluster, and see what a broker keeps on disk.

## Exercise 1.1 · Start the cluster

**Task:** start all three brokers in the background and wait until every container reports *healthy*.

!!! solution "Solution"
    ```powershell
    cd D:\trainings\Apache_Kafka_Training\labs\kafka_cli_lab
    docker compose up -d
    docker compose ps
    ```

    ```output
    NAME      IMAGE                STATUS                    PORTS
    kafka1    apache/kafka:4.3.1   Up 22 seconds (healthy)   0.0.0.0:19092->19092/tcp
    kafka2    apache/kafka:4.3.1   Up 22 seconds (healthy)   0.0.0.0:29092->29092/tcp
    kafka3    apache/kafka:4.3.1   Up 22 seconds (healthy)   0.0.0.0:39092->39092/tcp
    ```

    The first start takes 15-30 seconds. `(health: starting)` becomes `(healthy)` once the health check - `kafka-broker-api-versions.sh` against the broker - succeeds. Each broker publishes one port to Windows.

    To see a broker's own log, and the line that says it is ready:

    ```powershell
    docker compose logs kafka1 | Select-String "Kafka Server started"
    ```

    ```output
    [2026-09-27 11:50:34,672] INFO [KafkaRaftServer nodeId=1] Kafka Server started (kafka.server.KafkaRaftServer)
    ```

    `KafkaRaftServer` confirms KRaft mode - there is no ZooKeeper anywhere in this cluster.

## Exercise 1.2 · Prove it is one cluster

**Task:** from inside `kafka1`, find the Kafka version, the cluster ID, which node leads the KRaft quorum, and the list of brokers.

!!! solution "Solution"
    Open a shell in the first broker:

    ```powershell
    docker exec -it kafka1 bash
    ```

    **Version and cluster ID:**

    ```kafka
    kafka-topics.sh --version
    kafka-cluster.sh cluster-id --bootstrap-server kafka1:9092
    ```

    ```output
    4.3.1
    Cluster ID: mXRdmJ0FRR-s1q-6q0Gqew
    ```

    **The KRaft quorum** - the three controllers that keep the cluster's metadata:

    ```kafka
    kafka-metadata-quorum.sh --bootstrap-server kafka1:9092 describe --status
    ```

    ```output
    ClusterId:              mXRdmJ0FRR-s1q-6q0Gqew
    LeaderId:               2
    LeaderEpoch:            1
    HighWatermark:          88
    MaxFollowerLag:         0
    MaxFollowerLagTimeMs:   434
    CurrentVoters:          [{"id": 1, "endpoints": ["CONTROLLER://kafka1:9093"]}, {"id": 2, "endpoints": ["CONTROLLER://kafka2:9093"]}, {"id": 3, "endpoints": ["CONTROLLER://kafka3:9093"]}]
    CurrentObservers:       []
    ```

    | Field | Meaning |
    |-------|---------|
    | `LeaderId` | The **active controller** - here node 2. Any node can win the election. |
    | `LeaderEpoch` | Goes up by one every time a new controller leader is elected |
    | `HighWatermark` | How many metadata records all voters have agreed on |
    | `CurrentVoters` | The Raft voters - all three nodes |

    ```kafka
    kafka-metadata-quorum.sh --bootstrap-server kafka1:9092 describe --replication
    ```

    ```output
    NodeId  DirectoryId             LogEndOffset  Lag  LastFetchTimestamp  LastCaughtUpTimestamp  Status
    2       AAAAAAAAAAAAAAAAAAAAAA  94            0    1790509870079       1790509870079          Leader
    1       AAAAAAAAAAAAAAAAAAAAAA  94            0    1790509869709       1790509869709          Follower
    3       AAAAAAAAAAAAAAAAAAAAAA  94            0    1790509869709       1790509869709          Follower
    ```

    All three have the same `LogEndOffset` and `Lag 0`: the followers have copied every metadata record.

    **The brokers** - every broker answers this with its supported API versions; we only keep the first line of each:

    ```kafka
    kafka-broker-api-versions.sh --bootstrap-server kafka1:9092 | grep -E '^kafka'
    ```

    ```output
    kafka3:9092 (id: 3 rack: null isFenced: false) -> (
    kafka1:9092 (id: 1 rack: null isFenced: false) -> (
    kafka2:9092 (id: 2 rack: null isFenced: false) -> (
    ```

    `isFenced: false` means the controller has accepted the broker and it can lead partitions.

## Exercise 1.3 · Look inside a broker

**Task:** list the broker's data directory and read the file that identifies it.

!!! solution "Solution"
    ```kafka
    ls -l /var/lib/kafka/data
    cat /var/lib/kafka/data/meta.properties
    ```

    ```output
    drwxr-xr-x 2 appuser appuser 4096 Sep 27 11:50 __cluster_metadata-0
    -rw-r--r-- 1 appuser appuser  411 Sep 27 11:50 bootstrap.checkpoint
    -rw-r--r-- 1 appuser appuser    0 Sep 27 11:50 cleaner-offset-checkpoint
    -rw-r--r-- 1 appuser appuser    4 Sep 27 11:51 log-start-offset-checkpoint
    -rw-r--r-- 1 appuser appuser  122 Sep 27 11:50 meta.properties
    -rw-r--r-- 1 appuser appuser    4 Sep 27 11:51 recovery-point-offset-checkpoint
    -rw-r--r-- 1 appuser appuser    0 Sep 27 11:50 replication-offset-checkpoint
    #
    #Sun Sep 27 11:50:28 GMT 2026
    cluster.id=mXRdmJ0FRR-s1q-6q0Gqew
    directory.id=W6ZXRWs45VFCVyxnSoUExg
    node.id=1
    version=1
    ```

    | Entry | What it is |
    |-------|-----------|
    | `meta.properties` | Written by `kafka-storage.sh format`. A broker refuses to start if its `cluster.id` does not match the cluster's. |
    | `__cluster_metadata-0/` | The KRaft **metadata log**: every topic, partition, config and broker registration, as records. Lab 8 decodes it. |
    | `bootstrap.checkpoint` | The metadata the cluster was formatted with (feature versions) |
    | `*-checkpoint` files | Per-partition bookkeeping: where each log starts, how far it is safely flushed, how far each replica has replicated, how far compaction got |

    Once you create topics, each partition gets its own directory here, named `<topic>-<partition>`.

## Exercise 1.4 · (Optional) Connect from Windows

**Task:** prove the cluster is reachable from programs running on Windows, not only from inside Docker.

!!! solution "Solution"
    `lab\host_client_check.py` lists the brokers and topics, writes one message and reads three back, using `localhost:19092,localhost:29092,localhost:39092`. It needs Python and the `confluent-kafka` package. Run it after Lab 3, when the `orders` topic has data:

    ```powershell
    pip install confluent-kafka
    python lab\host_client_check.py
    ```

    ```output
    brokers : ['1=localhost:19092', '2=localhost:29092', '3=localhost:39092']
    topics  : ['audit-log', 'customer-profile', 'orders', 'payments', ...]
    written : orders-0 @ offset 6
    read    : 2 0 carol {"order":2003,"item":"mouse","amount":18
    read    : 2 1 erin {"order":2005,"item":"webcam","amount":7
    read    : 2 2 carol {"order":2009,"item":"desk lamp","amount
    ```

    The brokers are listed with their **advertised** EXTERNAL addresses - `localhost:19092` and so on - which is why a Windows program can follow them.

## Exercise 1.5 · Stop, start and reset

**Task:** learn the three ways to stop the lab.

!!! solution "Solution"
    | Command (PowerShell, lab folder) | Effect |
    |---------|--------|
    | `docker compose stop` | Stops the containers; `docker compose start` brings them back as they were |
    | `docker compose down` | Removes the containers but **keeps** the data volumes; `up -d` restores all topics and messages |
    | `docker compose down -v` | Removes containers **and** volumes - every topic and message is gone. Use it to start the labs again from scratch. |
    | `docker compose --profile ui up -d` | Also starts **Kafka UI** at `http://localhost:8080` - a web view of the same cluster, handy for checking your CLI work |
