package com.training.kafka.orders;

import java.time.Instant;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * A message read from the topic, with its coordinates. The value is returned as JSON
 * when it is JSON (everything this app writes), or as the raw text otherwise - anyone
 * can write to the topic with kafka-console-producer.sh.
 */
public record OrderMessage(String topic, int partition, long offset, Instant timestamp, String key,
                           Object value) {

    static OrderMessage from(ConsumerRecord<String, String> record, JsonMapper json) {
        return new OrderMessage(record.topic(), record.partition(), record.offset(),
                Instant.ofEpochMilli(record.timestamp()), record.key(), parse(record.value(), json));
    }

    private static Object parse(String value, JsonMapper json) {
        if (value == null || value.isBlank()) {
            return value;
        }
        try {
            return json.readTree(value);
        } catch (JacksonException notJson) {
            return value;
        }
    }
}
