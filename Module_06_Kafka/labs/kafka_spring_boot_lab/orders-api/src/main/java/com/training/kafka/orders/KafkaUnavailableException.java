package com.training.kafka.orders;

/** Kafka could not be reached, or refused the request. Mapped to HTTP 503. */
public class KafkaUnavailableException extends RuntimeException {

    public KafkaUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
