const { body, param, validationResult, matchedData } = require('express-validator');

module.exports = [
    param('orderId')
        .trim()
        .notEmpty()
        .withMessage('Order ID is required'),

    body('amount')
        .custom(value => Number.isSafeInteger(value) && value > 0)
        .withMessage('Amount must be a positive integer in cents'),

    body('paymentMethodId')
        .isString()
        .bail()
        .trim()
        .notEmpty()
        .withMessage('Payment method ID is required'),

    (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(422).json({
                status: 'fail',
                errors: errors.array(),
            });
        }

        req.validated = matchedData(req);
        next();
    },
];