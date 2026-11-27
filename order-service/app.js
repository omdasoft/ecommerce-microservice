const express = require('express');
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Order = require('./models/order');
const orderRoutes = require('./routes/order');
const errorHandler = require('./middleware/errorHandler');

dotenv.config();

const port = process.env.PORT || 5003;

const app = express();

app.use(express.json());

app.use('/api/v1/orders', orderRoutes);
app.use(errorHandler);

const mongoURI = process.env.MONGO_URI;

mongoose
.connect(mongoURI)
.then(async () => {
    await Order.init();
    console.log('Connected to MongoDB');
    app.listen(port, () => {
        console.log(`Order service running on port ${port}`);
    });
})
.catch((err) => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
});
