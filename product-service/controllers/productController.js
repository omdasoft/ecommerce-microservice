const Product = require('../models/product');

const mongoose = require('mongoose');

const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock, size } = req.body;  
    const product = new Product({ name, description, price, category, stock, size });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}

const getProducts = async (req, res) => {
  try{
    const products = await Product.find()
      .select('_id name description price category stock size isAvailable');
    res.json(products);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}

const getProduct =  async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const product = await Product.findById(id)
      .select('_id name description price category stock size isAvailable');

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const { name, description, price, category, stock, size, isAvailable } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { name, description, price, category, stock, size, isAvailable },
      { new: true }
    ).select('_id name description price category stock size isAvailable');

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}

const reserveStock = async (req, res) => {
  const { id: productId } = req.params;
  
  const { quantity } = req.body;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive integer' });
  }

  try {
    const product = await Product.findOneAndUpdate(
      {
        _id: productId,
        isAvailable: true,
        stock: { $gte: quantity }
      },
      { $inc: { stock: -quantity } },
      { new: true, runValidators: true }
    ).select('_id name price stock isAvailable');

    if (!product) {
      return res.status(409).json({ error: 'Product is unavailable or has insufficient stock' });
    }

    res.json({ product });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
}

module.exports = {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  reserveStock
};