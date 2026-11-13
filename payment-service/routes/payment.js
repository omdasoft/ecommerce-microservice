const express = require('express');
const router = express.Router();
const createPaymentRequest = require("../requests/createPaymentRequest"); 
const paymentController = require('../controllers/paymentController');

router.get('/:orderId', paymentController.orderPayment);
router.post('/:orderId', createPaymentRequest, paymentController.createPayment);
router.get('/:id', paymentController.getPayment);

module.exports = router;