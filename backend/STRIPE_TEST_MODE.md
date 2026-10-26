# Stripe Test Mode

Backend reads `STRIPE_SECRET_KEY` from `.env` and rejects live keys. Set `FRONTEND_URL=http://localhost:3001` to the actual frontend origin. No Stripe secret is sent to the frontend.

After creating a booking, POST `/api/bookings/stripe/checkout` with `{ "bookingCode": "BK-..." }` and the user's JWT. Redirect to the returned `url`. Checkout returns to `/booking/payment`; this page calls authenticated GET `/api/bookings/stripe/status/:bookingCode` to verify payment with Stripe.

For confirmation even when the customer closes the browser, forward Stripe events:

```powershell
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded --forward-to localhost:3000/api/bookings/stripe/webhook
```

Set `STRIPE_WEBHOOK_SECRET` in backend `.env` to the `whsec_...` printed by Stripe CLI and restart backend. Do not use the API key as the webhook secret. Webhooks require raw request bodies and signature validation. Until forwarding is configured, the return page's server-side reconciliation still works.

Use Stripe's test Visa `4242 4242 4242 4242`, a future expiration (e.g. `12/34`) and any 3-digit CVC. Complete payment before the original five-minute seat hold expires. Stripe Checkout sessions can remain open longer; a payment received after the booking deadline is refunded and never issues tickets for reassigned seats.

POST `/api/tickets/:bookingCode/cancel` refunds the saved PaymentIntent, with Stripe idempotency keys. Refunds may be pending; GET the Stripe status endpoint to refresh pending refunds. Cancellation is allowed at least 60 minutes before showtime. Mock payment is disabled except when both `NODE_ENV=test` and `ALLOW_MOCK_PAYMENTS=true` are explicitly set for legacy tests.

Checks:

```powershell
npm test -- --runInBand
npm run test:e2e -- --runInBand
# Optional interactive Checkout test: open test/stripe-checkout-ui.json URL and pay with a test card within 220 seconds.
$env:RUN_STRIPE_UI='1'; npm run test:e2e -- --runInBand
```

The integration tests create their own fixture records and remove only those records. The optional test uses real Stripe sandbox Checkout, verifies application confirmation, refunds through the cancellation API and verifies the refund at Stripe.

References: https://docs.stripe.com/testing , https://docs.stripe.com/api/checkout/sessions/create , https://docs.stripe.com/api/refunds/create
