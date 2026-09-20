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
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled'],
        default: 'pending'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);