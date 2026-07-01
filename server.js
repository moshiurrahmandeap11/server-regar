require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
connectDB();

// Middleware
// need to add cors options for production
app.use(cors({
  origin: ['http://localhost:3000', 'https://regar-client.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/raffles', require('./routes/raffles'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/content', require('./routes/content'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/paypal', require('./routes/paypal'));

app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

app.use("/", (req, res) => {
    res.send("Welcome to the API");
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));
