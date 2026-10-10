const AppError = require('../errors/AppError');
const Order = require('../models/order');

class OrderService {
    constructor({ orderModel = Order } = {}) {
        this.orderModel = orderModel;
    }

    prepareOrder(orderDetails) {
        if (
            !orderDetails ||
            !Array.isArray(orderDetails.items) ||
            orderDetails.items.length === 0
        ) {
            throw new AppError(
                'INVALID_ORDER',
                'An order must contain at least one item',
                400
            );
        }

        const hasInvalidItem = orderDetails.items.some((item) =>
            !item ||
            typeof item.productId !== 'string' ||
            item.productId.trim().length === 0 ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity <= 0
        );

        if (hasInvalidItem) {
            throw new AppError(
                'INVALID_ORDER_ITEM',
                'Each order item must have a product ID and a positive integer quantity',
                400
            );
        }

        const quantitiesByProduct = new Map();
        for (const item of orderDetails.items) {
            const productId = item.productId.trim();
            const quantity = (quantitiesByProduct.get(productId) || 0) + item.quantity;

            if (!Number.isSafeInteger(quantity)) {
                throw new AppError(
                    'INVALID_ORDER_ITEM',
                    'The combined quantity for a product is too large',
                    400
                );
            }

            quantitiesByProduct.set(productId, quantity);
        }

        const items = Array.from(quantitiesByProduct, ([productId, quantity]) => ({
            productId,
            quantity
        }));

        return { userId: orderDetails.userId, items };
    }

    calculateTotalAmount(items, products) {
        const totalAmount = products.reduce(
            (total, product, index) => total + product.price * items[index].quantity,
            0
        );

        if (!Number.isFinite(totalAmount)) {
            throw new AppError(
                'INVALID_ORDER_TOTAL',
                'The order total is outside the supported range',
                400
            );
        }

        return totalAmount;
    }

    async createPendingOrder({ userId, items, totalAmount }) {
        return new this.orderModel({
            userId,
            items,
            totalAmount,
            status: 'pending'
        }).save();
    }

    async markAwaitingPayment(order) {
        order.status = 'awaiting_payment';
        order.compensationPendingProductIds = [];
        await order.save();
        return order;
    }

    async findById(orderId) {
        return this.orderModel.findById(orderId);
    }

    async findAll() {
        return this.orderModel.find();
    }

    async beginCompensation(order, productIds) {
        order.status = 'compensation_required';
        order.compensationPendingProductIds = [...new Set(productIds)];

        try {
            await order.save();
        } catch (error) {
            console.error(
                `Could not persist compensation state for order ${order._id}:`,
                error
            );
        }
    }

    async finishCompensation(order, pendingProductIds) {
        order.compensationPendingProductIds = pendingProductIds;
        order.status = pendingProductIds.length > 0 ? 'compensation_required' : 'cancelled';

        try {
            await order.save();
        } catch (error) {
            console.error(
                `Could not persist compensation results for order ${order._id}:`,
                error
            );
            throw new AppError(
                'ORDER_COMPENSATION_STATE_SAVE_FAILED',
                'The order failed and its compensation status could not be saved',
                500,
                { cause: error }
            );
        }
    }
}

module.exports = OrderService;
