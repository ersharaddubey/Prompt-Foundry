import express from 'express';
import axios from 'axios';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const CF_BASE =
  process.env.CASHFREE_ENV === 'PRODUCTION'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

const CF_CHECKOUT =
  process.env.CASHFREE_ENV === 'PRODUCTION'
    ? 'https://api.cashfree.com/pg/view/sessions/checkout'
    : 'https://sandbox.cashfree.com/pg/view/sessions/checkout';

const PLANS = {
  starter: { price: 999, credits: 4000, name: 'Starter' },
  plus: { price: 2499, credits: 12000, name: 'Plus' },
  pro: { price: 3999, credits: 24000, name: 'Pro' },
  wonder: { price: 14999, credits: 106000, name: 'Wonder' },
};

function cfHeaders() {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-client-id': process.env.CASHFREE_APP_ID,
    'x-client-secret': process.env.CASHFREE_SECRET_KEY,
    'x-api-version': '2023-08-01',
  };
}

// Create Cashfree ORDER (not payment link)
router.post('/create-order', protect, async (req, res) => {
  try {
    const { planId, phone } = req.body;
    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({ message: 'Invalid plan' });
    }

    if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
      return res.status(500).json({ message: 'Cashfree keys missing on server' });
    }

    const orderId = `ord_${String(req.user._id).slice(-8)}_${Date.now()}`;

    const payload = {
      order_id: orderId,
      order_amount: plan.price,
      order_currency: 'INR',
      customer_details: {
        customer_id: String(req.user._id),
        customer_name: req.user.name || 'User',
        customer_email: req.user.email || 'user@example.com',
        customer_phone: phone || '9999999999',
      },
      order_meta: {
        return_url: 'https://www.cashfree.com',
      },
      order_note: `${plan.name} - ${plan.credits} credits`,
      order_tags: {
        planId: String(planId),
        userId: String(req.user._id),
        credits: String(plan.credits),
      },
    };

    const { data } = await axios.post(`${CF_BASE}/orders`, payload, {
      headers: cfHeaders(),
    });

    if (!data.payment_session_id) {
      return res.status(500).json({
        message: 'No payment_session_id from Cashfree',
        details: data,
      });
    }

    // App will open our server checkout page which POSTs to Cashfree
    const host = req.get('host');
    const protocol = req.protocol || 'http';
    // For phone testing, prefer explicit public base if set
    const base =
      process.env.PUBLIC_API_BASE ||
      `${protocol}://${host}`;

    const checkoutPageUrl = `${base}/api/payment/checkout-page?session=${encodeURIComponent(
      data.payment_session_id
    )}&order=${encodeURIComponent(data.order_id)}`;

    res.json({
      orderId: data.order_id,
      paymentSessionId: data.payment_session_id,
      linkUrl: checkoutPageUrl,
      amount: plan.price,
      credits: plan.credits,
      planName: plan.name,
      env: process.env.CASHFREE_ENV || 'SANDBOX',
    });
  } catch (err) {
    console.error('CF create order:', err.response?.data || err.message);
    res.status(500).json({
      message:
        err.response?.data?.message ||
        (Array.isArray(err.response?.data) && err.response.data[0]?.message) ||
        'Order create failed',
      details: err.response?.data || null,
    });
  }
});

// HTML page that auto-submits POST to Cashfree hosted checkout
router.get('/checkout-page', (req, res) => {
  const session = req.query.session || '';
  const order = req.query.order || '';

  if (!session) {
    return res.status(400).send('Missing payment session');
  }

  const action = CF_CHECKOUT;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Redirecting to Cashfree...</title>
  <style>
    body { font-family: system-ui, sans-serif; background:#0f0f12; color:#fff;
           display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
    .box { text-align:center; padding:24px; }
  </style>
</head>
<body>
  <div class="box">
    <p>Opening Cashfree secure checkout...</p>
    <p style="opacity:.6;font-size:12px">Order: ${String(order).replace(/</g, '')}</p>
  </div>
  <form id="cf" method="POST" action="${action}">
    <input type="hidden" name="payment_session_id" value="${String(session).replace(/"/g, '')}" />
  </form>
  <script>document.getElementById('cf').submit();</script>
</body>
</html>`);
});

// Verify order paid + add credits
router.post('/verify', protect, async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: 'orderId required' });
    }

    const { data } = await axios.get(`${CF_BASE}/orders/${orderId}`, {
      headers: cfHeaders(),
    });

    if (data.order_status !== 'PAID') {
      return res.status(400).json({
        message: 'Payment not completed yet',
        status: data.order_status,
      });
    }

    const credits = parseInt(data.order_tags?.credits || '0', 10);
    if (!credits || Number.isNaN(credits)) {
      return res.status(400).json({
        message: 'Could not read credits from order',
        tags: data.order_tags,
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.credits = (user.credits || 0) + credits;
    await user.save();

    res.json({
      success: true,
      credits: user.credits,
      added: credits,
      message: `+${credits} credits added`,
    });
  } catch (err) {
    console.error('CF verify:', err.response?.data || err.message);
    res.status(500).json({
      message: err.response?.data?.message || 'Verify failed',
      details: err.response?.data || null,
    });
  }
});

export default router;
