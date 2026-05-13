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
      .prepare(
        `
        SELECT
          id,
          email,
          stripe_customer_id,
          stripe_subscription_id,
          subscription_status,
          plan
        FROM users
        WHERE id = ?
        `,
      )
      .get(req.session.user.id);

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "User not found.",
      });
    }

    if (user.plan === "business") {
      return res.status(400).json({
        ok: false,
        message: "You are already on the highest plan.",
      });
    }

    if (user.plan === "pro" && plan === "pro") {
      return res.status(400).json({
        ok: false,
        message: "You are already on the Pro plan.",
      });
    }

    let customerId = user.stripe_customer_id;

    try {
      if (customerId) {
        await stripe.customers.retrieve(customerId);
      }
    } catch {
      customerId = null;
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
      });

      customerId = customer.id;

      db.prepare(
        `
        UPDATE users
        SET stripe_customer_id = ?
        WHERE id = ?
        `,
      ).run(customerId, user.id);
    }

    // Existing paid user: update their current Stripe subscription
    if (user.stripe_subscription_id && user.subscription_status === "active") {
      const subscription = await stripe.subscriptions.retrieve(
        user.stripe_subscription_id,
      );

      await stripe.subscriptions.update(user.stripe_subscription_id, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: plans[plan].priceId,
          },
        ],
        proration_behavior: "create_prorations",
        metadata: {
          userId: user.id,
          plan,
        },
      });

      return res.json({
        ok: true,
        updated: true,
        message: "Subscription updated successfully.",
      });
    }

    // New paid user: create checkout session
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
