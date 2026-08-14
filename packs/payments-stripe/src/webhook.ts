import "server-only";
import type Stripe from "stripe";
import { env } from "@/core/env";
import { logger } from "@/lib/logger";
import { getStripe } from "./stripe";
import { mapStripeStatus } from "./schema";
import { upsertEntitlement, userIdForCustomer } from "./data";

type WebhookResult = { status: number; body: Record<string, unknown> };

/**
 * The whole webhook, behind one public function so the route handler stays thin
 * and boundary-clean (it imports only the feature's index). Verifies the Stripe
 * signature, then writes entitlement with the service_role client.
 */
export async function handleStripeWebhook(rawBody: string, signature: string | null): Promise<WebhookResult> {
  const stripe = getStripe();
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return { status: 503, body: { error: "Stripe not configured" } };
  if (!signature) return { status: 400, body: { error: "Missing signature" } };

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    logger.warn("stripe webhook: signature verification failed", { err });
    return { status: 400, body: { error: "Invalid signature" } };
  }

  try {
    await handleEvent(event);
  } catch (err) {
    logger.error("stripe webhook: handler error", { type: event.type, err });
    // 500 tells Stripe to retry — better than dropping an entitlement change.
    return { status: 500, body: { error: "Handler error" } };
  }

  return { status: 200, body: { received: true } };
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const userId = await userIdForCustomer(customerId);
      if (!userId) {
        logger.warn("stripe webhook: no user for customer", { customerId });
        return;
      }
      await upsertEntitlement(userId, {
        status: mapStripeStatus(sub.status),
        productId: sub.items.data[0]?.price.product?.toString() ?? null,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
      });
      return;
    }
    default:
      // Ignore unrelated events; acknowledge so Stripe stops retrying.
      return;
  }
}
