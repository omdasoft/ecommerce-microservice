const express = require('express');
const router = express.Router();
const createPaymentRequest = require("../requests/createPaymentRequest"); 
const paymentController = require('../controllers/paymentController');

router.get('/orders/:orderId', paymentController.orderPayment);
router.post('/orders/:orderId', createPaymentRequest, paymentController.createPayment);
router.get('/:id', paymentController.getPayment);

module.exports = router;