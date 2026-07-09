require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const ensureAdminUser = require('./utils/ensureAdminUser');

const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:3003',
  'http://localhost:3100',
  'https://regar.ch',
  'https://www.regar.ch',
  'https://regar-client.vercel.app',
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
]
  .filter(Boolean)
  .flatMap((origin) => origin.split(','))
  .map((origin) => origin.trim().replace(/\/$/, ''));

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Stripe webhook must receive raw body for signature verification.
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), require('./controllers/paymentController').handleStripeWebhook);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/raffles', require('./routes/raffles'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/content', require('./routes/content'));
app.use('/api/newsletters', require('./routes/newsletters'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/notifications', require('./routes/notifications'));

app.use('/api/payments', require('./routes/payments'));

app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

app.use("/", (req, res) => {
    res.send("Welcome to the API");
});

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  await connectDB();
  await ensureAdminUser();
  app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
