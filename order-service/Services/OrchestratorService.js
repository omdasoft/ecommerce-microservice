const AppError = require('../errors/AppError');
const OrderService = require('./OrderService');
const ProductService = require('./ProductService');

const PRODUCT_UNAVAILABLE_MESSAGE = 'One or more products are unavailable or out of stock';

class OrchestratorService {
    constructor({
        orderService = new OrderService(),
        productService = new ProductService()
    } = {}) {
        this.orderService = orderService;
        this.productService = productService;
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

    async placeOrder(orderDetails) {
        const preparedOrder = this.orderService.prepareOrder(orderDetails);
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
        const order = await this.orderService.createPendingOrder({
            ...preparedOrder,
            totalAmount
        });

        const attemptedProductIds = [];
        try {
            for (const item of preparedOrder.items) {
                attemptedProductIds.push(item.productId);
                await this.productService.reserveStock(item, order._id.toString());
            }

            return await this.orderService.markAwaitingPayment(order);
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
