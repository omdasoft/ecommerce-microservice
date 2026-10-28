const express = require('express');

const dotenv = require("dotenv");

const mongoose = require("mongoose");

const cartRoutes = require("./routes/cart");

dotenv.config();

const port = process.env.PORT || 5004;

const app = express();

app.use(express.json());

app.use('/api/v1/carts', cartRoutes);


mongoose
.connect(process.env.MONGO_URI)
.then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});


app.listen(port, () => {
  console.log(`Shopping cart Service listening on port ${port}`);
});