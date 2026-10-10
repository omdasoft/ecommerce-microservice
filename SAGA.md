# Order Creation Saga

This document describes the remaining implementation for reliable order creation across the order service and product service.

The project uses an **orchestrated Saga**. The order service coordinates the workflow, while each service performs only local database operations.

## 1. Goal

An order must not oversell inventory, and a failure in one step must not leave permanently reserved stock or an incorrect order state.

Target workflow:

```text
Create pending order
    -> Reserve every product
    -> If reservation fails: release successful reservations and cancel order
    -> Complete payment and other steps
    -> Commit every reservation
    -> Mark order completed
```

Important distinction:

- `reserve` immediately and atomically decreases available stock.
- `release` restores stock when the Saga fails.
- `commit` confirms that the business workflow succeeded. It changes reservation status only; it does not decrease stock again.

## 2. Current State

The product service currently has:

- `PUT /api/v1/products/:id/reserve`
- `PUT /api/v1/products/:id/reserve/:reservationId/release`
- An atomic stock update using `stock >= quantity` and `$inc: { stock: -quantity }`.
- Product-level reservation records with `active`, `released`, and `committed` statuses.

The order service currently still needs to:

- Validate request items before starting the Saga.
- Stop using separate availability and price reads as the source of truth for reservation.
- Check every reserve response with `response.ok`.
- Track successful reservations.
- Release successful reservations when a later reservation fails.
- Mark the order `cancelled` after compensation.
- Commit reservations after all business steps succeed.
- Mark the order `completed` only after commit succeeds.
- Support idempotency and recovery for timeouts and process crashes.

## 3. Current Order-to-Product Workflow

This sequence shows what the services do today when a client creates an order. It is intentionally separate from the target Saga flow below; the current implementation does not yet compensate failed reservations.

```mermaid
sequenceDiagram
  autonumber
  actor Client
  participant Order as Order Service
  participant Product as Product Service
  participant OrderDB as Order MongoDB
  participant ProductDB as Product MongoDB

  Client->>Order: POST /api/v1/orders (Bearer token, items)
  Order->>Order: Verify JWT and set userId
  alt Token missing, invalid, or expired
    Order-->>Client: 401 Authentication error
  else Authenticated
    Order->>Order: Read items from request
    par Check availability for each item
      Order->>Product: GET /api/v1/products/{productId}
      Product->>Product: Validate product ID
      Product->>ProductDB: Find product
      ProductDB-->>Product: Product fields
      Product-->>Order: Product (including isAvailable and stock)
    and Repeat for remaining items
    end
    alt Any product missing, unavailable, or short on stock
      Order-->>Client: 400 Product unavailable or out of stock
    else All pre-checks pass
      par Fetch price for each item
        Order->>Product: GET /api/v1/products/{productId}
        Product->>ProductDB: Find product
        ProductDB-->>Product: Product fields
        Product-->>Order: Product (including price)
      and Repeat for remaining items
      end
      Order->>Order: Calculate sum(price x quantity)
      Order->>OrderDB: Save order (userId, items, totalAmount, pending)
      OrderDB-->>Order: Saved order with order ID
      par Reserve each item's stock
        Order->>Product: PUT /api/v1/products/{productId}/reserve\n{quantity, reservationId: orderId}
        Product->>Product: Validate quantity and reservationId
        Product->>ProductDB: Atomically require available stock; decrement stock and add active reservation
        ProductDB-->>Product: Updated product / no match
        Product-->>Order: 200 reserved / 400 invalid / 409 unavailable
      and Repeat for remaining items
      end
      Note over Order,Product: Order service currently does not inspect reserve response status or compensate successful reservations if another reserve fails.
      Order-->>Client: 201 Saved order
    end
  end
```

Product lookups return `400` for an invalid product ID and `404` when the product does not exist. The availability pre-check handles either as a failed check. Reserve validates a positive integer quantity and reservation ID, returns the existing active reservation for a retry, and atomically decrements stock only when the product is available and has enough stock. A failed reserve returns `409`; today, that HTTP error alone does not prevent the order service from responding `201`.

## 4. Reservation API Contract

### Reserve

```text
PUT /api/v1/products/:productId/reserve
```

Request:

```json
{
  "quantity": 2,
  "reservationId": "order-id-or-reservation-id"
}
```

Rules:

- `quantity` must be a positive integer.
- `reservationId` is required.
- The update must require `isAvailable: true` and `stock >= quantity`.
- A successful call decreases stock and creates an `active` reservation in one local database operation.
- Retrying the same active reservation must not decrease stock again.
- Reusing a released or committed reservation ID must return a conflict.
- Insufficient stock should return `409 Conflict`.

Successful response should include at least:

```json
{
  "reservationId": "order-id-or-reservation-id",
  "product": {
    "_id": "product-id",
    "price": 25,
    "stock": 8
  },
  "reservation": {
    "quantity": 2,
    "status": "active"
  }
}
```

### Release

```text
PUT /api/v1/products/:productId/reserve/:reservationId/release
```

Rules:

- Only an `active` reservation may be released.
- Release increases stock by the reserved quantity.
- Release changes the reservation from `active` to `released` in the same local operation.
- A repeated release must be harmless and must not restore stock twice.

Recommended repeated-release behavior is an idempotent success response, or a clear `already released` response that the Saga treats as success.

### Commit

```text
PUT /api/v1/products/:productId/reserve/:reservationId/commit
```

Rules:

- Only an `active` reservation may be committed.
- Commit changes the reservation from `active` to `committed`.
- Commit does not modify stock.
- A repeated commit must be harmless.
- A released reservation cannot be committed.

## 5. Product-Service Commit Implementation

Add a `commitStock` controller and route.

The update should be conditional on the reservation still being active:

```text
Find product where:
  _id = productId
  reservationId exists
  reservation.status = active

Update:
  reservation.status = committed
```

Use an atomic positional update. If no document matches, determine whether the reservation is already committed, released, or does not exist. The response must allow the order service to distinguish a successful retry from an invalid transition.

## 6. Order-Service Saga Flow

The order service should use the order ID as the Saga ID, or create a separate Saga ID and store it on the order. Every product reservation must use a stable ID derived from that Saga.

Recommended order states:

```text
pending
reserving
reserved
payment_pending
completed
cancelling
cancelled
failed
```

Basic flow:

1. Validate the authenticated user and item list.
2. Reject empty items, invalid quantities, duplicate items, and invalid product IDs.
3. Create an order with status `pending`.
4. Read product details needed for price snapshots.
5. Set status to `reserving`.
6. Reserve each item, preferably through a product-service bulk reservation endpoint.
7. Check every HTTP response. `fetch` does not throw for HTTP `4xx` or `5xx` responses.
8. Record every successful reservation.
9. If any reservation fails, release all successful reservations.
10. Set the order to `cancelled` and return an appropriate error.
11. When all reservations succeed, set the order to `reserved`.
12. Perform payment or other future Saga steps.
13. Commit every active reservation.
14. Set the order to `completed`.

## 7. Compensation Flow

When one reservation fails, do not simply return an error. Compensate all earlier successful reservations.

Pseudocode:

```js
const successfulReservations = [];

try {
  for (const item of items) {
    const response = await reserve(item);

    if (!response.ok) {
      throw new Error('Inventory reservation failed');
    }

    successfulReservations.push({
      productId: item.productId,
      reservationId: sagaId
    });
  }

  await markOrderReserved(orderId);
} catch (error) {
  await Promise.allSettled(
    successfulReservations.map((reservation) => release(reservation))
  );

  await markOrderCancelled(orderId);
  throw error;
}
```

Use `Promise.allSettled` for compensation so one failed release does not prevent the remaining releases from being attempted. Failed compensation must be recorded and retried by a recovery worker.

## 8. Reservation Granularity

Using the order ID as the reservation ID is acceptable for a learning project when each product has at most one line item.

For a stronger design, create a unique reservation ID per order item:

```text
orderId + productId + itemId
```

Then store the reservation ID and product ID in the order document. This makes reconciliation and partial recovery more precise.

Duplicate product IDs should either be rejected or merged before reservation:

```text
product A quantity 2
product A quantity 3

becomes

product A quantity 5
```

## 9. Price Handling

Availability and price should not be obtained through unrelated reads and then trusted indefinitely.

The reservation response should return the price used for the reservation. The order service should store a price snapshot in each order item:

```json
{
  "productId": "product-id",
  "quantity": 2,
  "unitPrice": 25,
  "subtotal": 50
}
```

The completed order must retain its historical price even if the catalog price changes later.

Prefer a product-service operation that validates availability, reserves stock, and returns the current price in one logical operation.

## 10. Idempotency

The client should send an idempotency key with order creation:

```text
Idempotency-Key: unique-client-request-id
```

The order service should:

- Store the key with the order.
- Add a unique database index for the key.
- Return the existing order when the same request is retried.
- Reject reuse of the key with a different request body.

Inventory reserve, release, and commit operations must also be idempotent because a timeout does not prove that the remote operation failed.

## 11. Crash Recovery

The orchestrator can crash after any remote operation. Store enough state to resume or compensate:

```text
order status
Saga ID
reservation IDs
completed Saga steps
last error
retry count
next retry time
```

Add a worker that periodically finds orders stuck in `reserving`, `reserved`, or `cancelling` and resumes the appropriate action.

Examples:

- `reserving`: retry reservation or compensate known successful reservations.
- `cancelling`: retry releases until all are confirmed.
- `reserved`: continue to payment or apply an expiration policy.
- `completed`: never release inventory because of a normal retry.

## 12. Transactional Outbox

When the order service changes local order state and needs to publish an event:

1. Save the order change and an outbox event in the same order database transaction.
2. A background publisher sends the event.
3. Mark the outbox event as published.
4. Retry unpublished events.

Useful events:

```text
OrderCreated
InventoryReservationStarted
InventoryReserved
InventoryReservationFailed
OrderCancelled
PaymentAuthorized
OrderCompleted
```

Consumers must handle duplicate events safely.

## 13. Failure Matrix

| Failure | Required action |
|---|---|
| Product has insufficient stock | Do not reserve it; release earlier reservations; cancel order |
| Product service returns `500` | Treat as unknown outcome; use idempotency key and retry or reconcile |
| Order database save fails | Do not start reservations |
| Order service crashes after reserve | Recovery worker finds the order and resumes or releases |
| Release request times out | Retry release using the same reservation ID |
| Payment fails | Release all active reservations; cancel order |
| Commit request times out | Retry commit using the same reservation ID; reconcile status before compensating |
| Client repeats order request | Return the existing order using the idempotency key |
| One of several product reservations fails | Release every successful reservation |

## 14. Implementation Order

Implement and test in this order:

1. Add the product-service `commit` endpoint.
2. Add order states and persist reservation IDs.
3. Update order creation to check reserve responses.
4. Add compensation using release for successful reservations.
5. Mark orders `cancelled` after compensation.
6. Commit reservations after all steps succeed.
7. Replace separate product reads with a reservation response containing price.
8. Add idempotency keys and unique indexes.
9. Add timeouts, retries, and `Promise.allSettled` compensation.
10. Add recovery workers.
11. Add an outbox for events.

## 15. Minimum Tests

Concurrency:

- Two requests reserve the last available units.
- Only one request succeeds when stock is insufficient for both.
- Stock never becomes negative.

Idempotency:

- Retrying reserve with the same reservation ID does not decrement twice.
- Retrying release does not increment twice.
- Retrying commit does not create a new state transition.

Compensation:

- The first reservation succeeds and the second fails.
- The first reservation is released.
- The order becomes `cancelled`.
- A failed release is retried.

Workflow:

- All reservations succeed and are committed.
- Payment failure releases all active reservations.
- A process crash after reservation is recoverable.
- A client retry returns the original order.
