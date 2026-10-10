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
      .select('_id name description price category stock size isAvailable reservations');
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

  const { quantity, reservationId } = req.body;

  if (!reservationId || !Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'reservationId and a positive integer quantity are required' });
  }

  try {
    const existingReservation = await Product.findOne({
      _id: productId,
      'reservations.reservationId': reservationId
    }).select('_id name price stock isAvailable reservations');

    if (existingReservation) {
      const reservation = existingReservation.reservations.find(
        (entry) => entry.reservationId === reservationId
      );

      if (reservation.status !== 'active') {
        return res.status(409).json({ error: 'Reservation ID has already been completed or released' });
      }

      return res.json({ product: existingReservation, reservation });
    }

    const product = await Product.findOneAndUpdate(
      {
        _id: productId,
        isAvailable: true,
        stock: { $gte: quantity },
        'reservations.reservationId': { $ne: reservationId }
      },
      {
        $inc: { stock: -quantity },
        $push: { reservations: { reservationId, quantity, status: 'active' } }
      },
      { new: true, runValidators: true }
    ).select('_id name price stock isAvailable reservations');

    if (!product) {
      return res.status(409).json({ error: 'Product is unavailable or has insufficient stock' });
    }

    res.json({ product, reservationId });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
}

const releaseStock = async (req, res) => {
  const { id: productId, reservationId } = req.params;

  try {
    const productWithReservation = await Product.findOne({
      _id: productId,
      reservations: { $elemMatch: { reservationId, status: 'active' } }
    }).select('reservations');

    if (!productWithReservation) {
      return res.status(404).json({ error: 'Active reservation not found' });
    }

    const reservation = productWithReservation.reservations.find(
      (entry) => entry.reservationId === reservationId && entry.status === 'active'
    );

    const product = await Product.findOneAndUpdate(
      {
        _id: productId,
        reservations: { $elemMatch: { reservationId, status: 'active' } }
      },
      {
        $inc: { stock: reservation.quantity },
        $set: { 'reservations.$.status': 'released' }
      },
      { new: true }
    ).select('_id name price stock isAvailable reservations');

    if (!product) {
      return res.status(404).json({ error: 'Active reservation not found' });
    }

    res.json({ product, reservationId });
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
  reserveStock,
  releaseStock
};