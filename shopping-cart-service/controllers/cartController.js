const Cart = require('../models/cart');

const axios = require('axios');

const CartList = async (req, res) => {
    const userId = req.userId;

    const userCarts = await Cart.findOne({ userId });

    if (!userCarts) {
        res
            .status(404)
            .json({
                message: "User Cart is Empty"
            })
    }

    res.json(userCarts);
}

const CartStore = async (req, res) => {
    const userId = req.userId;

    const { productId, quantity } = req.body

    const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL;

    try {
        await axios.get(`${PRODUCT_SERVICE_URL}/api/v1/products/${productId}`);

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            cart = new Cart({ userId, items: [{ productId, quantity }] });
        } else {
            const itemIndex = cart.items.findIndex(
                (item) => item.productId === productId
            )
            if (itemIndex > -1) {
                cart.items[itemIndex].quantity += quantity
            } else {
                cart.items.push({ productId, quantity })
            }
        }

        await cart.save();

        res.status(201).json({ cart });
    } catch (error) {
        if (error.response) {
            const statusCode = error.response.status;
            const message = error.response.data.error;

            if (statusCode === 400) {
                res.status(400).json({ error: message });
            }

            if (statusCode === 404) {
                res.status(404).json({ error: message });
            }
        } else {
            console.log(error);
            res.status(500).json({ error: "server error" });
        }
    }
}

const DeleteItem = async (req, res) => {
    const userId = req.userId;

    const { id } = req.params;

    try {
        const cart = await Cart.findOne({ userId });

        if (!cart) {
            res.status(404).json({ error: "Cart not found" });
        }

        cart.items = cart.items.filter(item => item.productId !== id);

        await cart.save();

        res.json(cart);

    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'Server Error' });
    }
}

const UpdateQuantity = async (req, res) => {
    const userId = req.userId;
    const {id} = req.params;
    const {quantity} = req.body;
    try {
        const cart = await Cart.findOne({userId});

        if (!cart) {
            res.status(404).json({ error: "Cart not found" });
        }

        const itemIndex = cart.items.findIndex(item => item.productId === id);

        if (itemIndex > -1) {
            cart.items[itemIndex].quantity = quantity;
        } else {
            res.status(404).json({ error: "Product not found in cart" });
        }

        await cart.save();

        res.json(cart);

    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'Server Error' });
    }
}

module.exports = {
    CartList,
    CartStore,
    DeleteItem,
    UpdateQuantity
};