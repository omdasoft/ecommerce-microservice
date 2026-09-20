const order = require('../models/order');

const getOrders = async (req, res) => {
  try {
    const orders = await order.find();
    res.json(orders);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

const createOrder = async (req, res) => {
    try {
        const userId = req.userId;

        const { items } = req.body;

        const checkProductAvailability = await Promise.all(
            items.map(async (item) => {
                const response = await fetch(`${process.env.PRODUCT_SERVICE_URL}/api/v1/products/${item.productId}`);
                const product = await response.json();
            return response.ok && product.isAvailable && product.stock >= item.quantity;
            })
        );

        if (checkProductAvailability.includes(false)) {
          return res.status(400).json({ error: 'One or more products are not available or out of stock' });
        }

        const calculatedTotalAmount = await Promise.all(
            items.map(async (item) => {
                const response = await fetch(`${process.env.PRODUCT_SERVICE_URL}/api/v1/products/${item.productId}`);
                const product = await response.json();
                return product.price * item.quantity;
            })
        );

        const totalAmountFromProducts = calculatedTotalAmount.reduce((sum, amount) => sum + amount, 0);

        const newOrder = new order({ userId, items, totalAmount: totalAmountFromProducts });

        const savedOrder = await newOrder.save();
        
       await Promise.all(
          items.map(async (item) => {
            await fetch(`${process.env.PRODUCT_SERVICE_URL}/api/v1/products/${item.productId}/reserve`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ quantity: item.quantity })
            });
          })
        );

        res.status(201).json(savedOrder);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

module.exports = {
  getOrders,
  createOrder
};