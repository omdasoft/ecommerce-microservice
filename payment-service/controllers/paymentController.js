
const Payment = require('../models/payment');

const dotenv = require("dotenv");

dotenv.config();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const orderPayment = async (req, res) => {
    const { orderId } = req.params;

    const payments = await Payment.find({ orderId });

    return res.json(payments);
}

const createPayment = async (req, res) => {
    const { orderId } = req.params;

    const { amount, paymentMethodId } = req.body;

    try {
        const idempotencyKey = `order:${orderId}:payment-intent`;

        const existingPayment = await Payment.findOne({ idempotencyKey: idempotencyKey });

        if (existingPayment) {
            return res.status(200).json({
                paymentId: existingPayment._id,
                status: existingPayment.status,
            });
        }

        //create a charge using stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method: paymentMethodId,
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never'
            },
            confirm: true,
        }, {
            idempotencyKey
        });


        const needsClientAction = paymentIntent.status === 'requires_action';

        //save the payment record
        const payment = new Payment({
            orderId,
            amount,
            status: paymentIntent.status,
            paymentMethod: "stripe",
            idempotencyKey: idempotencyKey
        });

        await payment.save();

        res.status(201).json({
            paymentId: payment._id,
            status: payment.status,
            ...(needsClientAction && {
                clientSecret: paymentIntent.client_secret,
            })
        });

    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(error.status || 500).json({ 
            status: "fail",
            error: error.message 
        });
    }
}

const getPayment = async (req, res) => {
    const { id } = req.params;

    try {
        const payment = await Payment.findOne({ _id: id });

        if (!payment) {
            res.status(404).json({error: "Payment not found"});
        }

        res.json(payment);
    } catch (error) {
        res.status(500).json({error: "Get payment failed"});
    }
}

module.exports = {
    orderPayment,
    createPayment,
    getPayment
}
