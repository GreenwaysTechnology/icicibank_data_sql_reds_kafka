# Lab 0 · Setting Up Kafka on Windows

## What you will build

By the end of this lab book you will have run a real **three-broker Apache Kafka 4.3.1 cluster** in Docker on a Windows laptop, and used the command-line tools to manage topics, move data in and out, work with consumer groups, and look inside the files Kafka writes to disk.

| Lab | Topic | What you do |
|-----|-------|-------------|
| 0 | Setup | Choose how to run Kafka on Windows, install Docker Desktop, get the lab files |
| 1 | Start the cluster | Start three brokers, check the KRaft quorum, look inside a broker |
| 2 | Topic management | Create, list, describe, configure, grow and delete topics |
| 3 | Partitions and replication | Where partitions live, broker failure, ISR, `min.insync.replicas`, leader election, reassignment |
| 4 | Segments, retention, compaction | Watch segments roll, get deleted by retention, and get compacted |
| 5 | Producers | Console producer, keys, headers, config files, acks, compression, performance tests |
| 6 | Consumers and offsets | Console consumer, formatting, reading from any offset, consumer properties, offset types |
| 7 | Consumer groups | Partition assignment, rebalancing, lag, resetting offsets, the new consumer protocol |
| 8 | Inside the log files | `kafka-dump-log`: batches, records, compression, internal topics, the metadata log |
| 9 | Index files | `.index` and `.timeindex`: format, lookups, density, verification |
| 10 | Cheat sheet | Every command from the labs on one page, plus troubleshooting |

**Every output in this book is real.** It was captured from the lab cluster exactly as described here. Your IDs, timestamps and a few numbers (throughput, leader placement) will differ; the shape of the output will not. Very long outputs are shortened: `...` marks lines or fields left out, and columns are spaced for readability.

!!! note "How the labs are written"
    Each exercise has a **Task** (what to do, in plain words) followed by a **Solution** (the exact commands, the output you should see, and an explanation of what it means). Try the task first; open the solution when you are stuck or want to check.

## 0.1 Three ways to run Kafka on Windows

| Option | How | Use it for |
|--------|-----|-----------|
| **A. Docker Desktop** (this lab book) | The official `apache/kafka` image, run by Docker Compose | Training, development, anything you want to reset in seconds |
| B. Native Windows | Unzip the Apache Kafka download, run the `bin\windows\*.bat` scripts | Quick experiments only - see the warnings below |
| C. WSL2 (Linux on Windows) | Unzip the download inside Ubuntu on WSL2, run the `bin/*.sh` scripts | Developers who prefer a Linux shell |

**All exercises in this book use option A.** Option B is described in section 0.3 for reference, because trainees often ask about it.

## 0.2 Install Docker Desktop

### Requirements

- Windows 10 (22H2) or Windows 11, 64-bit
- Hardware virtualisation enabled in the BIOS (most laptops have it on)
- At least 8 GB of RAM; the lab cluster itself uses about 2 GB
- About 3 GB of free disk space for the image and data

### Steps

**Step 1 - Turn on WSL2.** Open PowerShell *as Administrator* and run the command below. Restart when asked. (If WSL is already installed, it does nothing harmful.)

```powershell
wsl --install
```

**Step 2 - Install Docker Desktop.** Download *Docker Desktop for Windows* from `https://www.docker.com/products/docker-desktop/` and run the installer. Keep the option **"Use WSL 2 instead of Hyper-V"** ticked.

**Step 3 - Start Docker Desktop** from the Start menu and wait until the status bar says *Engine running*.

**Step 4 - Check it works.** Open a normal (non-admin) PowerShell window:

```powershell
docker version --format 'Client {{.Client.Version}} / Server {{.Server.Version}} ({{.Server.Os}}/{{.Server.Arch}})'
docker compose version
wsl --status
```

```output
Client 29.8.0 / Server 29.8.0 (linux/amd64)
Docker Compose version v5.5.1
Default Distribution: Ubuntu
Default Version: 2
```

`Server ... (linux/amd64)` means Docker is running Linux containers through WSL2 - exactly what the Kafka image needs.

**Step 5 - Download the Kafka image** (about 240 MB compressed, 690 MB on disk):

```powershell
docker pull apache/kafka:4.3.1
docker images apache/kafka
```

```output
IMAGE                 ID             DISK USAGE   CONTENT SIZE
apache/kafka:4.3.1    77e3df905404        686MB          239MB
```

!!! tip "Why pin the version?"
    `apache/kafka:latest` changes whenever Apache releases a new version. Pinning `4.3.1` (the latest release when this book was written) means every trainee runs exactly the same broker, and every output in this book matches.

## 0.3 Reference: running Kafka natively on Windows

!!! warning "Not used in the exercises"
    This section is for reference only. It is not part of the labs and was not run for this book. Apache Kafka does not support Windows as a production platform, and native Windows brokers have a long history of **file-locking problems**: deleting a topic, or retention deleting old segments, can fail with `AccessDeniedException` and stop the broker. Use Docker (or WSL2) for anything beyond a quick try.

If you still want to see it work natively:

**Step 1 - Install Java 17 or newer.** Kafka 4.x brokers need Java 17+ (clients need Java 11+). Check with `java -version`.

**Step 2 - Download** the binary release `kafka_2.13-4.3.1.tgz` from `https://kafka.apache.org/downloads`.

**Step 3 - Extract it to a short path** such as `C:\kafka`. Long paths break the `.bat` scripts, which build a very long classpath.

```powershell
mkdir C:\kafka
tar -xzf kafka_2.13-4.3.1.tgz -C C:\kafka --strip-components 1
```

**Step 4 - Point the data directory somewhere sensible.** In `C:\kafka\config\server.properties` change `log.dirs` to `log.dirs=C:/kafka/data` (forward slashes avoid escaping problems).

**Step 5 - Format the storage once, then start the broker** (KRaft, single node, no ZooKeeper):

```powershell
cd C:\kafka
$id = bin\windows\kafka-storage.bat random-uuid
bin\windows\kafka-storage.bat format --standalone -t $id -c config\server.properties
bin\windows\kafka-server-start.bat config\server.properties
```

!!! warning "Harmless: Reconfiguration failed: No configuration found"
    On Kafka 4.3.1 every Windows tool, `kafka-storage.bat random-uuid` included, prints this line first:

    ```output
    main ERROR Reconfiguration failed: No configuration found for '2c7b84de' at 'null' in 'null'
    ```

    It is a logging message, not a failure. `kafka-run-class.bat` builds the Log4j setting as `file:C:\kafka/config/tools-log4j2.yaml`, and a backslash is not valid in a `file:` URL, so Log4j cannot load its settings file. The command itself still works: `$id` holds a 22-character cluster ID such as `g5WdaYf5Qxmw6NdOt6jf7A` - check with `$id` - and the `format` step can go ahead.

    To silence it, change line 119 of `bin\windows\kafka-run-class.bat` from the first line to the second:

    ```
    set KAFKA_LOG4J_OPTS=-Dlog4j2.configurationFile=file:%BASE_DIR%/config/tools-log4j2.yaml
    set KAFKA_LOG4J_OPTS=-Dlog4j2.configurationFile=%BASE_DIR%\config\tools-log4j2.yaml
    ```

    `kafka-server-start.bat` sets its own Log4j path, which loads correctly, but that makes `kafka-run-class.bat` print three `DEPRECATED: A Log4j 1.x configuration file has been detected` lines. They are also harmless: the check that prints them misfires on Windows. Both messages were reproduced on Kafka 4.3.1 with Java 21.

**Step 6 - Use it** from a second PowerShell window. Every tool in this book exists as a `.bat` file in `bin\windows\` with the same options:

```powershell
bin\windows\kafka-topics.bat --bootstrap-server localhost:9092 --create --topic test
```

## 0.4 The lab files

The lab folder is `Apache_Kafka_Training\labs\kafka_cli_lab`:

```output
kafka_cli_lab\
  docker-compose.yml          the 3-broker cluster (and optional Kafka UI)
  lab\
    config\
      producer.properties     used in Lab 5
      consumer.properties     used in Lab 6
      increase-rf.json        used in Lab 3 (reassignment)
    data\
      orders.txt              10 keyed sample orders (Labs 3, 5)
      payloads.txt            500 JSON orders for the compression test (Lab 5)
    host_client_check.py      optional: talk to the cluster from Windows (Lab 1)
  Kafka_CLI_Lab_Guide.pdf     this book
```

The `lab` folder is mounted into every broker container as **`/lab`**, so files you put there on Windows are visible inside the containers.

### The cluster, explained

`docker-compose.yml` starts three identical containers, `kafka1`, `kafka2` and `kafka3`. The settings that matter:

| Setting | Value | Meaning |
|---------|-------|---------|
| `image` | `apache/kafka:4.3.1` | Official Apache image, Kafka 4.3.1 |
| `KAFKA_PROCESS_ROLES` | `broker,controller` | Each node is a broker **and** a KRaft controller ("combined mode"). Fine for a laptop; production runs separate controllers. |
| `KAFKA_CONTROLLER_QUORUM_VOTERS` | `1@kafka1:9093,2@kafka2:9093,3@kafka3:9093` | The three nodes vote on cluster metadata (Raft). A majority - 2 of 3 - must be up. |
| `CLUSTER_ID` | `mXRdmJ0FRR-s1q-6q0Gqew` | Every node must be formatted with the same cluster ID |
| `KAFKA_LISTENERS` | `PLAINTEXT://:9092, CONTROLLER://:9093, EXTERNAL://:19092` | Three sockets: brokers and containers use 9092, controllers use 9093, Windows uses 19092 / 29092 / 39092 |
| `KAFKA_ADVERTISED_LISTENERS` | `PLAINTEXT://kafka1:9092, EXTERNAL://localhost:19092` | The addresses the broker tells clients to use, per listener |
| `KAFKA_DEFAULT_REPLICATION_FACTOR` | `3` | New topics get 3 copies unless told otherwise |
| `KAFKA_MIN_INSYNC_REPLICAS` | `2` | With `acks=all`, a write needs 2 in-sync copies |
| `KAFKA_NUM_PARTITIONS` | `3` | New topics get 3 partitions unless told otherwise |
| `KAFKA_AUTO_CREATE_TOPICS_ENABLE` | `false` | Producing to an unknown topic fails instead of silently creating it |
| `KAFKA_LOG_RETENTION_CHECK_INTERVAL_MS` | `30000` | **Lab only:** check retention every 30 s instead of every 5 min |
| `KAFKA_HEAP_OPTS` | `-Xms512m -Xmx512m` | Keep each JVM small on a laptop |
| volumes | `kafka1_data:/var/lib/kafka/data` | Each broker's partitions survive a container restart |

!!! note "Why advertised listeners matter"
    A client connects to *any* broker in `bootstrap.servers`, gets back the cluster metadata, and then connects to the **advertised** address of each broker it needs. Inside Docker the brokers advertise `kafka1:9092`; to Windows they advertise `localhost:19092`. Get this wrong and clients connect once, then fail with "connection refused" to an address they cannot reach.

## 0.5 Conventions used in this book

Code blocks are labelled:

```powershell
# PowerShell on Windows - run in the lab folder
docker compose ps
```

```kafka
# inside a broker container - run after:  docker exec -it kafka1 bash
kafka-topics.sh --bootstrap-server kafka1:9092 --list
```

```output
what you should see
```

**Opening a shell in a broker.** Most commands in this book run *inside* the `kafka1` container, where every Kafka tool is on the `PATH`:

```powershell
docker exec -it kafka1 bash
```

Type `exit` to leave. You can also run a single command without opening a shell:

```powershell
docker exec kafka1 kafka-topics.sh --bootstrap-server kafka1:9092 --list
```

!!! warning "Git Bash users"
    Git Bash rewrites paths that start with `/` (it turns `/lab/data` into `C:/Program Files/Git/lab/data`). Use PowerShell, or run `export MSYS_NO_PATHCONV=1` once in your Git Bash window.
