const AppError = require('../errors/AppError');

const PRODUCT_UNAVAILABLE_MESSAGE = 'One or more products are unavailable or out of stock';

class ProductService {
    constructor({
        getProductServiceUrl = () => process.env.PRODUCT_SERVICE_URL,
        fetchImpl = (...args) => globalThis.fetch(...args)
    } = {}) {
        this.getProductServiceUrl = getProductServiceUrl;
        this.fetch = fetchImpl;
    }

    async getProduct(productId) {
        let response;

        try {
            const productServiceUrl = this.getProductServiceUrl();
            response = await this.fetch(
                `${productServiceUrl}/api/v1/products/${encodeURIComponent(productId)}`
            );
        } catch (error) {
            throw new AppError(
                'PRODUCT_SERVICE_UNAVAILABLE',
                'The product service is temporarily unavailable',
                503,
                { cause: error }
            );
        }

        if (response.status === 404) {
            return null;
        }

        if (response.status === 400) {
            throw new AppError('INVALID_PRODUCT_ID', 'A product ID is invalid', 400);
        }

        if (!response.ok) {
            throw new AppError(
                'PRODUCT_SERVICE_ERROR',
                'The product service could not retrieve product details',
                response.status >= 500 ? 503 : 502
            );
        }

        let product;
        try {
            product = await response.json();
        } catch (error) {
            throw new AppError(
                'PRODUCT_SERVICE_INVALID_RESPONSE',
                'The product service returned an invalid response',
                502,
                { cause: error }
            );
        }

        if (
            !product ||
            typeof product.isAvailable !== 'boolean' ||
            typeof product.stock !== 'number' ||
            !Number.isFinite(product.price) ||
            product.price < 0
        ) {
            throw new AppError(
                'PRODUCT_SERVICE_INVALID_RESPONSE',
                'The product service returned an invalid response',
                502
            );
        }

        return product;
    }

    async reserveStock(item, reservationId) {
        let response;
        try {
            const productServiceUrl = this.getProductServiceUrl();
            response = await this.fetch(
                `${productServiceUrl}/api/v1/products/${encodeURIComponent(item.productId)}/reserve`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        quantity: item.quantity,
                        reservationId
                    })
                }
            );
        } catch (error) {
            throw new AppError(
                'PRODUCT_SERVICE_UNAVAILABLE',
                'The product service is temporarily unavailable',
                503,
                { cause: error }
            );
        }

        if (!response.ok) {
            throw new AppError(
                response.status === 409 ? 'PRODUCT_UNAVAILABLE' : 'PRODUCT_SERVICE_ERROR',
                response.status === 409
                    ? PRODUCT_UNAVAILABLE_MESSAGE
                    : 'The product service could not reserve product stock',
                response.status === 409 ? 409 : response.status >= 500 ? 503 : 502
            );
        }
    }

    async releaseStock(productId, reservationId) {
        let response;
        try {
            const productServiceUrl = this.getProductServiceUrl();
            response = await this.fetch(
                `${productServiceUrl}/api/v1/products/${encodeURIComponent(productId)}/reserve/${encodeURIComponent(reservationId)}/release`,
                { method: 'PUT' }
            );
        } catch (error) {
            throw new AppError(
                'PRODUCT_SERVICE_UNAVAILABLE',
                'The product service is temporarily unavailable',
                503,
                { cause: error }
            );
        }

        if (response.status === 404) {
            return;
        }

        if (!response.ok) {
            throw new AppError(
                'PRODUCT_SERVICE_ERROR',
                'The product service could not release product stock',
                response.status >= 500 ? 503 : 502
            );
        }
    }
}

module.exports = ProductService;
