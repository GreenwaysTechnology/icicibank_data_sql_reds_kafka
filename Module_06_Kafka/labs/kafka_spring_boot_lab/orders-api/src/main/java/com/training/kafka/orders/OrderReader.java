package com.training.kafka.orders;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.KafkaException;
import org.apache.kafka.common.TopicPartition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reads the topic on request, from any offset - like kafka-console-consumer.sh with
 * --partition and --offset. It uses assign() and seek() instead of a consumer group, so it
 * commits nothing and does not disturb the listener's group.
 */
@Service
public class OrderReader {

    private static final Duration MAX_WAIT = Duration.ofSeconds(5);

    private final ConsumerFactory<String, String> consumers;
    private final JsonMapper json;
    private final String topic;
    private final AtomicInteger readerNo = new AtomicInteger();

    public OrderReader(ConsumerFactory<String, String> consumers, JsonMapper json,
                       @Value("${app.topic}") String topic) {
        this.consumers = consumers;
        this.json = json;
        this.topic = topic;
    }

    /**
     * Up to {@code limit} messages from one partition (or all of them), starting at
     * {@code fromOffset} in each, optionally only those whose key is {@code customer}.
     */
    public List<OrderMessage> read(Integer partition, long fromOffset, int limit, String customer) {
        try (Consumer<String, String> consumer =
                     consumers.createConsumer(null, "orders-reader-", String.valueOf(readerNo.incrementAndGet()))) {

            List<TopicPartition> partitions = consumer.partitionsFor(topic).stream()
                    .map(p -> new TopicPartition(topic, p.partition()))
                    .filter(tp -> partition == null || tp.partition() == partition)
                    .toList();
            if (partitions.isEmpty()) {
                throw new IllegalArgumentException("Topic " + topic + " has no partition " + partition);
            }

            consumer.assign(partitions);
            Map<TopicPartition, Long> first = consumer.beginningOffsets(partitions);
            Map<TopicPartition, Long> end = consumer.endOffsets(partitions);
            for (TopicPartition tp : partitions) {
                // stay inside [first, end] - an offset past the end would trigger auto.offset.reset
                consumer.seek(tp, Math.min(Math.max(fromOffset, first.get(tp)), end.get(tp)));
            }

            List<OrderMessage> out = new ArrayList<>();
            long deadline = System.nanoTime() + MAX_WAIT.toNanos();
            while (out.size() < limit && !reachedEnd(consumer, end) && System.nanoTime() < deadline) {
                for (ConsumerRecord<String, String> record : consumer.poll(Duration.ofMillis(500))) {
                    if (customer == null || customer.equals(record.key())) {
                        out.add(OrderMessage.from(record, json));
                    }
                    if (out.size() == limit) {
                        break;
                    }
                }
            }
            out.sort(Comparator.comparingInt(OrderMessage::partition).thenComparingLong(OrderMessage::offset));
            return out;
        } catch (KafkaException e) {
            throw new KafkaUnavailableException("Could not read from Kafka: " + e.getMessage(), e);
        }
    }

    private static boolean reachedEnd(Consumer<String, String> consumer, Map<TopicPartition, Long> end) {
        return end.entrySet().stream().allMatch(e -> consumer.position(e.getKey()) >= e.getValue());
    }
}
