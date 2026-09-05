const express = require('express');

const dotenv = require("dotenv");

const mongoose = require("mongoose");

dotenv.config();

const authRoutes = require('./routes/auth');

const app = express();

const port = process.env.PORT || 5001;

const mongoURI = process.env.MONGO_URI;

// Middleware to parse JSON requests
app.use(express.json());

app.use('/api/v1/auth', authRoutes);

mongoose
.connect(mongoURI).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});

// Start the server
app.listen(port, () => {
  console.log(`User Service is listening on port ${port}`);
});