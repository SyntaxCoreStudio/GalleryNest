const Stripe = require("stripe");
const env = require("./env");

if (!env.stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY in .env");
}

const stripe = new Stripe(env.stripeSecretKey);

module.exports = stripe;
