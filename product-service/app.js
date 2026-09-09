const express = require('express');

const dotenv = require("dotenv");

const mongoose = require("mongoose");

const productRoutes = require('./routes/product');

dotenv.config();

const port = process.env.PORT || 5002;

const app = express();

app.use(express.json());

app.use('/api/v1/products', productRoutes);

mongoose
.connect(process.env.MONGO_URI)
.then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});


app.listen(port, () => {
  console.log(`Product Service listening on port ${port}`);
});