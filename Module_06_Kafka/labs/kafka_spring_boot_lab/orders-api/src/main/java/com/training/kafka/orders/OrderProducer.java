package com.training.kafka.orders;

import java.time.Instant;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.apache.kafka.clients.producer.RecordMetadata;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

@Service
public class OrderProducer {

    private static final Logger log = LoggerFactory.getLogger(OrderProducer.class);

    private final KafkaTemplate<String, String> kafka;
    private final JsonMapper json;
    private final String topic;

    public OrderProducer(KafkaTemplate<String, String> kafka, JsonMapper json,
                         @Value("${app.topic}") String topic) {
        this.kafka = kafka;
        this.json = json;
        this.topic = topic;
    }

    /**
     * Sends one order and waits for the broker's answer, so the caller learns the
     * partition and offset. Key = customer: all of a customer's orders go to the same
     * partition, so they stay in order.
     */
    public SendReceipt send(OrderRequest request) {
        Order order = request.toOrder();
        String value = json.writeValueAsString(order);
        try {
            SendResult<String, String> result =
                    kafka.send(topic, request.customer(), value).get(30, TimeUnit.SECONDS);
            RecordMetadata meta = result.getRecordMetadata();
            log.info("sent     key={} -> {}-{} @ offset {}", request.customer(), meta.topic(),
                    meta.partition(), meta.offset());
            return new SendReceipt(meta.topic(), meta.partition(), meta.offset(),
                    Instant.ofEpochMilli(meta.timestamp()), request.customer(), order);
        } catch (ExecutionException e) {
            throw new KafkaUnavailableException("Kafka did not accept the message: "
                    + NestedExceptionUtils.getMostSpecificCause(e).getMessage(), e);
        } catch (TimeoutException e) {
            throw new KafkaUnavailableException("No answer from Kafka within 30 seconds", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new KafkaUnavailableException("Interrupted while sending", e);
        }
    }
}
