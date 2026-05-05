const express = require("express");
const db = require("../config/db");
const env = require("../config/env");
const stripe = require("../config/stripe");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const plans = {
  pro: {
    priceId: env.stripePricePro,
  },
  business: {
    priceId: env.stripePriceBusiness,
  },
};

router.post("/create-checkout-session", requireAuth, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!plans[plan]) {
      return res.status(400).json({
        ok: false,
        message: "Invalid plan selected.",
      });
    }

    const user = db
      .prepare("SELECT id, email, stripe_customer_id FROM users WHERE id = ?")
      .get(req.session.user.id);

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "User not found.",
      });
    }

    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });

      customerId = customer.id;

      db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(
        customerId,
        user.id,
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: plans[plan].priceId,
          quantity: 1,
        },
      ],
      success_url: `${env.appUrl}/dashboard.html?payment=success`,
      cancel_url: `${env.appUrl}/dashboard.html?payment=cancelled`,
      metadata: {
        userId: user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          plan,
        },
      },
    });

    return res.json({
      ok: true,
      url: session.url,
    });
  } catch (error) {
    console.error("Create checkout session error:", error);
    return res.status(500).json({
      ok: false,
      message: "Could not start checkout.",
    });
  }
});

module.exports = router;
