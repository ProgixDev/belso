import { getMyEntitlement, Paywall } from "@/features/billing";

/**
 * DESIGN: replace after the Claude Design pass. Thin Server Component route:
 * reads entitlement on the server (RLS) and renders the paywall. Set the price id
 * to one of your test-mode Stripe Prices (price_...).
 */
export default async function BillingPage() {
  const entitlement = await getMyEntitlement();
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID ?? "price_set_me";
  return (
    <main className="container mx-auto py-12">
      <Paywall entitlement={entitlement} priceId={priceId} />
    </main>
  );
}
