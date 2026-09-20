const express = require('express');
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const orderRoutes = require('./routes/order');

dotenv.config();

const port = process.env.PORT || 5003;

const app = express();

app.use(express.json());

app.use('/api/v1/orders', orderRoutes);

const mongoURI = process.env.MONGO_URI;

mongoose
.connect(mongoURI)
.then(() => {
    console.log('Connected to MongoDB');
})
.catch((err) => {
    console.error('Error connecting to MongoDB:', err);
});

app.listen(port, () => {
    console.log(`Order service running on port ${port}`);
});