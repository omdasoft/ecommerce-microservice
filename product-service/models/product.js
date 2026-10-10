const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema({
    reservationId: { type: String, required: true },
    quantity: { type: Number, required: true },
    status: {
        type: String,
        enum: ['active', 'released', 'committed'],
        default: 'active'
    }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    stock: { type: Number, required: true },
    size: { type: String, required: true },
    isAvailable: { type: Boolean, default: true },
    reservations: [reservationSchema]
}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);