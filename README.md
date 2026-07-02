# Server - regar

Local setup

1. Copy `.env.example` to `.env` and fill values.
2. Install deps:
   ```bash
   cd server-regar
   npm install
   ```
3. Start server:
   ```bash
   npm run dev
   ```

Stripe webhooks (development)

Install and run stripe CLI and forward webhooks:
```
stripe listen --forward-to localhost:5002/api/payments/webhook
```

Endpoints
- `POST /api/payments/manual` (auth) - submit manual payments with `proof` file (multipart/form-data)
- `POST /api/payments/stripe/session` (auth) - create Stripe checkout session
- `POST /api/payments/webhook` - Stripe webhook (raw body)
- `GET /api/payments` (admin) - list payments
