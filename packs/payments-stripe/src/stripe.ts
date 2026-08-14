import "server-only";
import Stripe from "stripe";
import { env } from "@/core/env";

/**
 * The Stripe client — SERVER ONLY. `server-only` makes importing this from a
 * client component a build error, so the secret key can never reach the browser.
 * Use the TEST secret key (sk_test_...) in dev. Returns null if unconfigured so
 * callers can degrade gracefully instead of crashing the build.
 */
export function getStripe(): Stripe | null {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}
