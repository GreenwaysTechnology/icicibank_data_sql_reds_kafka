package com.training.kafka.orders;

/** The message value - the same JSON as lab/data/orders.txt: {"order":2001,"item":"keyboard","amount":45} */
public record Order(int order, String item, int amount) {
}
