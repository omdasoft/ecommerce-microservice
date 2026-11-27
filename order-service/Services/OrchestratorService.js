const AppError = require('../errors/AppError');
const OrderService = require('./OrderService');
const ProductService = require('./ProductService');
const PaymentService = require('./PaymentService');
const PRODUCT_UNAVAILABLE_MESSAGE = 'One or more products are unavailable or out of stock';

class OrchestratorService {
    constructor({
        orderService = new OrderService(),
        productService = new ProductService(),
        paymentService = new PaymentService()
    } = {}) {
        this.orderService = orderService;
        this.productService = productService;
        this.paymentService = paymentService;
    }

    async compensateReservations(order, productIds) {
        const uniqueProductIds = [...new Set(productIds)];
        await this.orderService.beginCompensation(order, uniqueProductIds);

        const results = await Promise.allSettled(
            uniqueProductIds.map((productId) =>
                this.productService.releaseStock(productId, order._id.toString())
            )
        );
        const pendingProductIds = results
            .map((result, index) => result.status === 'rejected' ? uniqueProductIds[index] : null)
            .filter((productId) => productId !== null);

        await this.orderService.finishCompensation(order, pendingProductIds);

        if (pendingProductIds.length > 0) {
            const compensationErrors = results
                .filter((result) => result.status === 'rejected')
                .map((result) => result.reason);
            throw new AppError(
                'ORDER_COMPENSATION_FAILED',
                'The order failed and some stock reservations could not be released',
                500,
                { cause: new AggregateError(compensationErrors, 'Stock compensation failed') }
            );
        }
    }

    async retryCompensation(orderId) {
        const order = await this.orderService.findById(orderId);

        if (!order) {
            throw new AppError('ORDER_NOT_FOUND', 'The order was not found', 404);
        }

        if (order.status !== 'compensation_required') {
            throw new AppError(
                'COMPENSATION_NOT_REQUIRED',
                'This order does not have pending compensation',
                409
            );
        }

        if (
            !Array.isArray(order.compensationPendingProductIds) ||
            order.compensationPendingProductIds.length === 0
        ) {
            throw new AppError(
                'INVALID_COMPENSATION_STATE',
                'The order has no recorded stock compensation to retry',
                500
            );
        }

        await this.compensateReservations(order, order.compensationPendingProductIds);
        return order;
    }

    replayOrder(order, items) {
        const quantities = new Map(order.items.map(item => [item.productId, item.quantity]));
        if (items.length !== quantities.size || items.some(item => quantities.get(item.productId) !== item.quantity)) {
            throw new AppError('IDEMPOTENCY_KEY_CONFLICT', 'This checkout key was used for different items', 409);
        }
        const inProgress = ['pending', 'awaiting_payment'].includes(order.status);
        return { statusCode: inProgress ? 202 : 200, body: { orderId: order._id, status: order.status } };
    }

    async placeOrder(orderDetails, idempotencyKey) {

        if (!idempotencyKey?.trim()) {
            throw new AppError('MISSING_IDEMPOTENCY_KEY', 'Provide an Idempotency-Key header for checkout', 400);
        }
        
        const preparedOrder = this.orderService.prepareOrder(orderDetails);
        const findExisting = () => this.orderService.findByCheckoutKey(preparedOrder.userId, idempotencyKey);
        const existing = await findExisting();
        if (existing) return this.replayOrder(existing, preparedOrder.items);
        const products = await Promise.all(
            preparedOrder.items.map((item) =>
                this.productService.getProduct(item.productId)
            )
        );

        const unavailable = products.some((product, index) =>
            !product ||
            !product.isAvailable ||
            product.stock < preparedOrder.items[index].quantity
        );

        if (unavailable) {
            const concurrentOrder = await findExisting();
            if (concurrentOrder) return this.replayOrder(concurrentOrder, preparedOrder.items);
            throw new AppError(
                'PRODUCT_UNAVAILABLE',
                PRODUCT_UNAVAILABLE_MESSAGE,
                409
            );
        }

        const totalAmount = this.orderService.calculateTotalAmount(
            preparedOrder.items,
            products
        );
        let order;
        try {
            order = await this.orderService.createPendingOrder({ ...preparedOrder, totalAmount, idempotencyKey });
        } catch (error) {
            if (error.code !== 11000 || !error.keyPattern?.idempotencyKey) throw error;
            const concurrentOrder = await findExisting();
            if (!concurrentOrder) throw error;
            return this.replayOrder(concurrentOrder, preparedOrder.items);
        }

        const attemptedProductIds = [];
        try {
            for (const item of preparedOrder.items) {
                attemptedProductIds.push(item.productId);
                await this.productService.reserveStock(item, order._id.toString());
            }

            await this.orderService.markAwaitingPayment(order);
            const payment = await this.paymentService.createPayment(order);
            return { statusCode: 201, body: { ...payment, orderId: order._id } };
        } catch (error) {
            if (attemptedProductIds.length === 0) {
                throw error;
            }

            await this.compensateReservations(order, attemptedProductIds);
            throw error;
        }
    }
}

module.exports = OrchestratorService;
