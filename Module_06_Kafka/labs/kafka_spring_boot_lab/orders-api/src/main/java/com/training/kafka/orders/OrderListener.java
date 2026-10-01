package com.training.kafka.orders;

import java.util.Deque;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * A consumer that runs for as long as the app does: Spring calls poll() in a loop on its
 * own thread and hands every record to onMessage(). It is a member of the consumer group
 * app.listener-group-id, and Spring commits the group's offsets after each batch.
 */
@Component
public class OrderListener {

    private static final Logger log = LoggerFactory.getLogger(OrderListener.class);

    private final Deque<OrderMessage> received = new ConcurrentLinkedDeque<>();
    private final JsonMapper json;
    private final int keepLast;

    public OrderListener(JsonMapper json, @Value("${app.keep-last}") int keepLast) {
        this.json = json;
        this.keepLast = keepLast;
    }

    @KafkaListener(id = "orders-listener", topics = "${app.topic}", groupId = "${app.listener-group-id}")
    public void onMessage(ConsumerRecord<String, String> record) {
        log.info("received key={} <- {}-{} @ offset {}", record.key(), record.topic(),
                record.partition(), record.offset());
        received.addFirst(OrderMessage.from(record, json));
        while (received.size() > keepLast) {
            received.pollLast();
        }
    }

    /** The most recently received messages, newest first. */
    public List<OrderMessage> latest() {
        return List.copyOf(received);
    }
}
