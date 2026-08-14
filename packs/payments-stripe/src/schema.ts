import { z } from "zod";

/** Input to start a checkout — a Stripe Price id (price_...) from your dashboard. */
export const CheckoutInputSchema = z.object({
  priceId: z.string().startsWith("price_", "Pass a Stripe Price id (price_...)"),
});
export type CheckoutInput = z.infer<typeof CheckoutInputSchema>;

/** The entitlement shape the app reads (from public.subscriptions). */
export const EntitlementSchema = z.object({
  status: z.enum(["active", "inactive", "grace", "expired"]),
  productId: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
});
export type Entitlement = z.infer<typeof EntitlementSchema>;

/** Map a Stripe subscription status onto our entitlement status. */
export function mapStripeStatus(s: string): Entitlement["status"] {
  switch (s) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "grace";
    case "canceled":
    case "incomplete_expired":
      return "expired";
    default:
      return "inactive";
  }
}
