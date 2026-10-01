package com.training.kafka.orders;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaTopicConfig {

    /**
     * The orders topic exactly as Lab 2 creates it: 3 partitions, replication factor 3.
     * Spring's KafkaAdmin creates it at startup if it is missing and leaves an existing
     * topic alone - the cluster has auto.create.topics.enable=false.
     */
    @Bean
    NewTopic ordersTopic(@Value("${app.topic}") String topic) {
        return TopicBuilder.name(topic).partitions(3).replicas(3).build();
    }
}
