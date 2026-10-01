# Kafka Spring Boot Lab

A Spring Boot 4 REST API, **`orders-api`**, that sends messages to the `orders` topic of the [Kafka CLI Lab](../kafka_cli_lab) cluster and gets them back. It uses the same key (the customer) and the same JSON value as `lab/data/orders.txt`.

**The book:** [`Kafka_Spring_Boot_Lab_Guide.pdf`](Kafka_Spring_Boot_Lab_Guide.pdf) (32 pages). Every output in it was captured from this app running against the lab's three-broker Kafka 4.3.1 cluster.

| Lab | Topic |
|-----|-------|
| 0 | Overview: architecture, endpoints, prerequisites, files, CLI-to-Java mapping |
| 1 | Build and run: Maven wrapper, startup log, the topic the app creates |
| 2 | The code, file by file: `application.yml`, `KafkaTemplate`, `@KafkaListener`, `assign()`/`seek()`, Admin API |
| 3 | Send messages over REST: `curl.exe`, PowerShell, the 5.1 quoting trap, keys -> partitions, validation |
| 4 | Get messages over REST: the listener's group and lag, catching up after a restart, reading from any offset |
| 5 | Failures and scaling: a broker stops, a second instance joins the group, rebalancing |
| 6 | API reference, settings, troubleshooting |

## Run it

```powershell
cd ..\kafka_cli_lab
docker compose up -d                       # the three brokers - wait for (healthy)

cd ..\kafka_spring_boot_lab\orders-api
.\mvnw.cmd -DskipTests package             # first run downloads Maven and the libraries
java -jar target\orders-api-1.0.0.jar      # http://localhost:8090
```

```powershell
# send an order (key = customer)
curl.exe -X POST http://localhost:8090/api/orders -H "Content-Type: application/json" --data "@samples/order.json"

# load all of the CLI lab's orders
powershell -ExecutionPolicy Bypass -File ..\send-orders.ps1

# get them back
curl.exe http://localhost:8090/api/orders/received                      # what the @KafkaListener received
curl.exe "http://localhost:8090/api/orders?partition=0&offset=0&limit=10" # read the log from any offset
curl.exe "http://localhost:8090/api/orders?customer=alice"              # one customer's orders
curl.exe http://localhost:8090/api/orders/topic                         # leaders, ISR, offsets
```

## Endpoints

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/orders` | Body `{"customer","order","item","amount"}`. Sends it (key = customer). Returns `201` with partition and offset |
| `GET` | `/api/orders/received` | The last 50 messages the `@KafkaListener` (group `orders-api`) received, newest first |
| `GET` | `/api/orders` | Reads the topic: `partition`, `offset` (default 0), `limit` (default 20, max 500), `customer` |
| `GET` | `/api/orders/topic` | Leader, replicas, ISR, start and end offset per partition |

## Files

| Path | What it is |
|------|------------|
| `orders-api/` | The Maven project: Spring Boot 4.1.1, Spring for Apache Kafka 4.1.1, Java 21. `mvnw.cmd` means no Maven install is needed |
| `orders-api/src/main/resources/application.yml` | Bootstrap servers (`localhost:19092/29092/39092`) and the producer/consumer settings from the CLI lab's property files |
| `orders-api/requests.http` | Every request, for the VS Code REST Client extension or IntelliJ |
| `orders-api/samples/order.json` | A request body for `curl.exe --data "@..."` |
| `send-orders.ps1` | Posts every line of `kafka_cli_lab/lab/data/orders.txt` to the API |
| `guide/*.md` | The chapters of the book - edit these, not the PDF. `<!-- include: path -->` pulls source files in |
| `build_pdf.py` | Builds the PDF: Markdown -> HTML -> headless Chrome/Edge (`pip install markdown`) |

## Rebuild the PDF

```powershell
python build_pdf.py
```
