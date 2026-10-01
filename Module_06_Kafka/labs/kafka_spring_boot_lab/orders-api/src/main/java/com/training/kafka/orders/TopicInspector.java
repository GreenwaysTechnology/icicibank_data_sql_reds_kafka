package com.training.kafka.orders;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.ListOffsetsResult.ListOffsetsResultInfo;
import org.apache.kafka.clients.admin.OffsetSpec;
import org.apache.kafka.clients.admin.TopicDescription;
import org.apache.kafka.common.Node;
import org.apache.kafka.common.TopicPartition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.stereotype.Service;

/** The Admin API view of the topic: leaders, replicas, ISR and offsets per partition. */
@Service
public class TopicInspector {

    private final KafkaAdmin kafkaAdmin;
    private final String topic;

    public TopicInspector(KafkaAdmin kafkaAdmin, @Value("${app.topic}") String topic) {
        this.kafkaAdmin = kafkaAdmin;
        this.topic = topic;
    }

    public TopicInfo describe() {
        try (Admin admin = Admin.create(kafkaAdmin.getConfigurationProperties())) {
            TopicDescription description = admin.describeTopics(List.of(topic))
                    .allTopicNames().get(10, TimeUnit.SECONDS).get(topic);
            List<TopicPartition> partitions = description.partitions().stream()
                    .map(p -> new TopicPartition(topic, p.partition())).toList();
            Map<TopicPartition, ListOffsetsResultInfo> first = offsets(admin, partitions, OffsetSpec.earliest());
            Map<TopicPartition, ListOffsetsResultInfo> end = offsets(admin, partitions, OffsetSpec.latest());

            return new TopicInfo(topic, description.partitions().stream().map(p -> {
                TopicPartition tp = new TopicPartition(topic, p.partition());
                return new TopicInfo.Partition(p.partition(), p.leader() == null ? -1 : p.leader().id(),
                        ids(p.replicas()), ids(p.isr()), first.get(tp).offset(), end.get(tp).offset());
            }).toList());
        } catch (ExecutionException | TimeoutException e) {
            throw new KafkaUnavailableException("Could not describe topic " + topic + ": "
                    + NestedExceptionUtils.getMostSpecificCause(e).getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new KafkaUnavailableException("Interrupted while describing " + topic, e);
        }
    }

    private static Map<TopicPartition, ListOffsetsResultInfo> offsets(Admin admin, List<TopicPartition> partitions,
            OffsetSpec spec) throws ExecutionException, InterruptedException, TimeoutException {
        Map<TopicPartition, OffsetSpec> request = partitions.stream()
                .collect(Collectors.toMap(Function.identity(), tp -> spec));
        return admin.listOffsets(request).all().get(10, TimeUnit.SECONDS);
    }

    private static List<Integer> ids(List<Node> nodes) {
        return nodes.stream().map(Node::id).toList();
    }
}
