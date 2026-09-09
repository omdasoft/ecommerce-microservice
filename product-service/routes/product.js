const express = require('express');
const Product = require('../models/product');
const router = express.Router();
const productController = require('../controllers/productController');
const mongoose = require('mongoose');

router.post('/', productController.createProduct);

router.get('/', productController.getProducts);

router.get('/:id', productController.getProduct);

router.put('/:id', productController.updateProduct);

router.delete('/:id', productController.deleteProduct);

module.exports = router;