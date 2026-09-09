const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    stock: { type: Number, required: true },
    size: { type: String, required: true },
    isAvailable: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);