"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "./stripe";
import { getStripeCustomerId, saveStripeCustomerId } from "./data";
import { CheckoutInputSchema } from "./schema";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Get the user's Stripe customer, creating + persisting one on first use. */
async function ensureCustomer(userId: string, email: string | undefined): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured.");
  const existing = await getStripeCustomerId(userId);
  if (existing) return existing;
  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId },
  });
  await saveStripeCustomerId(userId, customer.id);
  return customer.id;
}

/**
 * Start a subscription Checkout for the given price. Auth is the caller's cookie
 * session; we redirect to Stripe's hosted page. Entitlement is NOT granted here —
 * it's written by the webhook after payment succeeds (server-owned).
 */
export async function startCheckout(input: { priceId: string }) {
  const { priceId } = CheckoutInputSchema.parse(input);
  const stripe = getStripe();
  if (!stripe) return { error: "Payments are not configured yet." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const customerId = await ensureCustomer(user.id, user.email);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl()}/billing?status=success`,
    cancel_url: `${siteUrl()}/billing?status=cancelled`,
    client_reference_id: user.id,
  });

  if (!session.url) return { error: "Could not start checkout. Try again." };
  redirect(session.url);
}

/** Open the Stripe billing portal so the user can manage/cancel their plan. */
export async function openBillingPortal() {
  const stripe = getStripe();
  if (!stripe) return { error: "Payments are not configured yet." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const customerId = await getStripeCustomerId(user.id);
  if (!customerId) return { error: "No billing account yet — subscribe first." };

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl()}/billing`,
  });
  redirect(session.url);
}
