const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY))
});

const db = admin.firestore();
const app = express();

app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch(err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'customer.subscription.created' || event.type === 'invoice.payment_succeeded') {
    const email = event.data.object.customer_email || event.data.object.billing_details?.email;
    if (email) {
      const users = await db.collection('users').where('email', '==', email).get();
      users.forEach(async u => {
        await db.collection('users').doc(u.id).update({ pro: true, proSince: new Date() });
      });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const email = event.data.object.customer_email;
    if (email) {
      const users = await db.collection('users').where('email', '==', email).get();
      users.forEach(async u => {
        await db.collection('users').doc(u.id).update({ pro: false });
      });
    }
  }

  res.json({received: true});
});

app.get('/', (req, res) => res.send('MyError server running ✓'));
app.listen(3000, () => console.log('Server running on port 3000'));
