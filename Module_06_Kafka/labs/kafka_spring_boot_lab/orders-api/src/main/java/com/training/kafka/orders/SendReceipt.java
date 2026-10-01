package com.training.kafka.orders;

import java.time.Instant;

/** Where Kafka stored a message - taken from the RecordMetadata the leader broker sent back. */
public record SendReceipt(String topic, int partition, long offset, Instant timestamp, String key,
                          Order value) {
}
