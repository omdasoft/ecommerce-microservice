const AppError = require('../errors/AppError');

class PaymentService {
  async createPayment(order){
    try {
        const paymentRespone = await fetch(`${process.env.PAYMENT_SERVICE_URL}/api/v1/payments/orders/${order._id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                orderId: order._id,
                amount: order.totalAmount * 100, // Convert to cents
                paymentMethodId: 'pm_card_visa' // Assuming you have a payment method ID
            })
        });

        if (!paymentRespone.ok) {
            throw new AppError(
                'PAYMENT_SERVICE_ERROR',    
                'Failed to create payment',
                paymentRespone.status
            );
        }

        return await paymentRespone.json();
    } catch (error) {   
      console.error('Error creating payment:', error);
      throw new AppError('PAYMENT_CREATION_FAILED', 'Failed to create payment', 500, { cause: error });
    }
  }
}

module.exports = PaymentService;