const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const orderController = require('../controllers/orderController');

router.get('/', orderController.getOrders);
router.post('/', authenticate, orderController.createOrder);

module.exports = router;