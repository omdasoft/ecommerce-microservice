const mongoose = require('mongoose');

const orderItemsSchema = new mongoose.Schema({
    productId: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    }
});

const orderSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    items: [orderItemsSchema],
    idempotencyKey: String,
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'awaiting_payment', 'completed', 'cancelled', 'compensation_required'],
        default: 'pending'
    },
    compensationPendingProductIds: {
        type: [String],
        default: []
    }
}, {
    timestamps: true
});

orderSchema.index({ userId: 1, idempotencyKey: 1 }, {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } }
});

module.exports = mongoose.model('Order', orderSchema);
