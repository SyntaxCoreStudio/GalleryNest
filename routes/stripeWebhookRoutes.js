const express = require("express");
const db = require("../config/db");
const env = require("../config/env");
const stripe = require("../config/stripe");

const router = express.Router();

const storageLimits = {
  free: 2147483648,
  pro: 21474836480,
  business: 107374182400,
};

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        env.stripeWebhookSecret,
      );
    } catch (error) {
      console.error("Stripe webhook signature error:", error.message);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        const userId = session.metadata.userId;
        const plan = session.metadata.plan;

        db.prepare(
          `
                    UPDATE users
                    SET plan = ?,
                    stripe_limit = ?,
                    subscription_status = ?
                    WHERE id = ?
                    `,
        ).run(
          plan,
          storageLimits[plan] || storageLimits.free,
          session.subscription,
          "active",
          userId,
        );
      }

      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;

        db.prepare(
          `
                    UPDATE users
                    SET plan = 'free',
                    storage_limit = ?,
                    stripeSubscription_id = NULL,
                    subscription_status = 'cancelled'
                    WHERE stripe_subscription_id = ?
                    `,
        ).run(storageLimits.free, subscription.id);
      }

      if (event.type === "customer.subscription.updated") {
        const subscription = event.data.object;
        const plan = subscription.metadata.plan || "free";

        db.prepare(
          `
                    UPDATE users
                    SET plan = ?,
                    storage_limit = ?,
                    subscription_status = ?
                    WHERE stripe_subscription_is = ?
                    `,
        ).run(
          plan,
          storageLimits[plan] || storageLimits.free,
          subscription.status,
          subscription.id,
        );
      }

      return res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook handling error:", error);
      return res.status(500).json({ ok: false });
    }
  },
);

module.exports = router;
