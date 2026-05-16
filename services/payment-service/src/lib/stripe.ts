import Stripe from "stripe";

// Use a dummy key if not configured — real API calls will fail gracefully at runtime
const key = process.env["STRIPE_SECRET_KEY"] ?? "";
export const stripe = new Stripe(key || "sk_test_placeholder_not_configured", {
  apiVersion: "2024-12-18.acacia",
});
