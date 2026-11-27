const OrderService = require('../Services/OrderService');
const OrchestratorService = require('../Services/OrchestratorService');
const orderService = new OrderService();
const orchestratorService = new OrchestratorService();

const getOrders = async (req, res, next) => {
  try {
    const orders = await orderService.findAll();
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

const createOrder = async (req, res, next) => {
    try {
      const orderDetails = {
        ...req.body,
        userId: req.userId
      };

      const result = await orchestratorService.placeOrder(orderDetails, req.get('Idempotency-Key'));
      res.status(result.statusCode).json(result.body);
    } catch (error) {
      next(error);
    }
};

module.exports = {
  getOrders,
  createOrder
};
