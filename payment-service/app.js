const express = require('express');

const dotenv = require("dotenv");

dotenv.config();

const mongoose = require("mongoose");

const paymentRoutes = require("./routes/payment");

const port = process.env.PORT || 5005;

const app = express();

app.use(express.json());

app.use('/api/v1/payments', paymentRoutes);

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
