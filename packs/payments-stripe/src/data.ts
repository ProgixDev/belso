import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { type Entitlement } from "./schema";

/**
 * The current user's entitlement, read via RLS (own row only). Call this in a
 * Server Component to gate premium UI. Defaults to inactive if there's no row.
 */
export async function getMyEntitlement(): Promise<Entitlement> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "inactive", productId: null, currentPeriodEnd: null };

  const { data } = await supabase
    .from("subscriptions")
    .select("status, product_id, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return { status: "inactive", productId: null, currentPeriodEnd: null };
  return {
    status: data.status as Entitlement["status"],
    productId: data.product_id,
    currentPeriodEnd: data.current_period_end,
  };
}

/** Resolve this user's stored Stripe customer id, if any (RLS: own mapping). */
export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.stripe_customer_id ?? null;
}

/** Store the user <-> Stripe customer mapping (service_role write). */
export async function saveStripeCustomerId(userId: string, customerId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("stripe_customers")
    .upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: "user_id" });
  if (error) logger.error("stripe: failed to save customer mapping", { error: error.message });
}

/**
 * Write entitlement for a user (service_role — bypasses the SELECT-only RLS on
 * subscriptions). Called ONLY from the verified webhook. The client can never
 * reach this path, so entitlement stays server-owned.
 */
export async function upsertEntitlement(
  userId: string,
  fields: { status: Entitlement["status"]; productId: string | null; currentPeriodEnd: string | null },
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      status: fields.status,
      product_id: fields.productId,
      current_period_end: fields.currentPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) logger.error("stripe: failed to upsert entitlement", { error: error.message });
}

/** Map a Stripe customer id back to our user id (webhook resolution). */
export async function userIdForCustomer(customerId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}
