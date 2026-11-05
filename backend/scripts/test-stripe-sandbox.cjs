// Direct Stripe sandbox smoke test. This does not exercise the booking API.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('dotenv').config({ quiet: true });
const key = process.env.STRIPE_SECRET_KEY;
if (!/^(sk|rk)_test_/.test(key || '') || /mock/i.test(key)) {
  throw new Error('A real Stripe test key is required; live keys are rejected.');
}
const run = randomUUID();
const results = { run, scope: 'Direct Stripe sandbox API, not application integration', startedAt: new Date().toISOString(), checks: [] };
async function stripe(endpoint, fields, idempotency) {
  const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: fields ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key}`, ...(fields ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `${run}-${idempotency}` } : {}) },
    body: fields ? new URLSearchParams(fields) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(`Stripe HTTP ${response.status}: ${data.error?.code || data.error?.type || 'unknown'}`);
    error.stripeCode = data.error?.code;
    throw error;
  }
  if ('livemode' in data) assert.equal(data.livemode, false);
  return data;
}
(async () => {
  let intent;
  try {
    intent = await stripe('payment_intents', { amount: '100000', currency: 'vnd', payment_method: 'pm_card_visa', return_url: 'http://localhost:3000/stripe-test-return', confirm: 'true', 'metadata[test_run]': run, description: 'Movie backend sandbox payment/refund smoke test' }, 'pay');
    results.paymentIntentId = intent.id;
    assert.equal(intent.status, 'succeeded');
    assert.equal(intent.amount_received, 100000);
    results.checks.push({ name: 'payment', status: intent.status, amount: intent.amount_received, currency: intent.currency });
  } finally {
    // Refund this run's successful payment even if an assertion fails.
    if (intent?.status === 'succeeded') {
      const fields = { payment_intent: intent.id, 'metadata[test_run]': run };
      const refund = await stripe('refunds', fields, 'refund');
      results.refundId = refund.id;
      assert.equal(refund.status, 'succeeded');
      assert.equal(refund.amount, intent.amount);
      results.checks.push({ name: 'full_refund', status: refund.status, amount: refund.amount });
      const retry = await stripe('refunds', fields, 'refund');
      assert.equal(retry.id, refund.id);
      results.checks.push({ name: 'refund_idempotency', passed: true });
      const charge = await stripe(`charges/${intent.latest_charge}`);
      assert.equal(charge.refunded, true);
      assert.equal(charge.amount_refunded, intent.amount);
      results.checks.push({ name: 'charge_fully_refunded', passed: true });
    }
  }
  try {
    await stripe('payment_intents', { amount: '100000', currency: 'vnd', payment_method: 'pm_card_visa_chargeDeclined', return_url: 'http://localhost:3000/stripe-test-return', confirm: 'true', 'metadata[test_run]': run }, 'decline');
    throw new Error('Expected a declined card');
  } catch (error) {
    assert.equal(error.stripeCode, 'card_declined');
    results.checks.push({ name: 'declined_card', passed: true });
  }
})().catch(error => { results.error = error.message; process.exitCode = 1; }).finally(() => {
  results.finishedAt = new Date().toISOString();
  const output = path.join(__dirname, '../test/stripe-sandbox-result.json');
  fs.writeFileSync(output, JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
});


