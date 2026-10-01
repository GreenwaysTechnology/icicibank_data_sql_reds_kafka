package com.training.kafka.orders;

import java.util.List;

/** What kafka-topics.sh --describe shows, plus each partition's first and next offset. */
public record TopicInfo(String topic, List<Partition> partitions) {

    public record Partition(int partition, int leader, List<Integer> replicas, List<Integer> isr,
                            long startOffset, long endOffset) {
    }
}
