package com.training.kafka.orders;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/** The body of POST /api/orders. The customer becomes the message key, the rest the value. */
public record OrderRequest(
        @NotBlank String customer,
        @Positive int order,
        @NotBlank String item,
        @Positive int amount) {

    Order toOrder() {
        return new Order(order, item, amount);
    }
}
