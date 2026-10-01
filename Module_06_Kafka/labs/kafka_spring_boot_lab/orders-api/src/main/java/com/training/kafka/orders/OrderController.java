package com.training.kafka.orders;

import java.util.List;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderProducer producer;
    private final OrderListener listener;
    private final OrderReader reader;
    private final TopicInspector inspector;

    public OrderController(OrderProducer producer, OrderListener listener, OrderReader reader,
                           TopicInspector inspector) {
        this.producer = producer;
        this.listener = listener;
        this.reader = reader;
        this.inspector = inspector;
    }

    /** Send one order to the topic. Returns the partition and offset Kafka stored it at. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SendReceipt send(@Valid @RequestBody OrderRequest request) {
        return producer.send(request);
    }

    /** The messages the @KafkaListener has received, newest first. */
    @GetMapping("/received")
    public List<OrderMessage> received() {
        return listener.latest();
    }

    /** Read the topic itself, from any offset - nothing is removed by reading. */
    @GetMapping
    public List<OrderMessage> read(@RequestParam(required = false) Integer partition,
                                   @RequestParam(defaultValue = "0") long offset,
                                   @RequestParam(defaultValue = "20") int limit,
                                   @RequestParam(required = false) String customer) {
        return reader.read(partition, offset, Math.clamp(limit, 1, 500), customer);
    }

    /** Partitions, leaders, replicas, ISR and offsets - like kafka-topics.sh --describe. */
    @GetMapping("/topic")
    public TopicInfo topic() {
        return inspector.describe();
    }
}
