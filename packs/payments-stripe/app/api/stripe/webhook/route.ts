import { NextResponse, type NextRequest } from "next/server";
import { handleStripeWebhook } from "@/features/billing";

/**
 * Stripe webhook — the ONLY place entitlement is granted. All logic lives in the
 * feature (`handleStripeWebhook`) so this route stays thin and imports only the
 * feature's public API. The handler verifies the Stripe signature and writes
 * entitlement with the service_role client; the browser can never reach it.
 *
 * Local dev: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
 */
export async function POST(req: NextRequest) {
  // Raw body is required for signature verification — do not JSON-parse first.
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  const result = await handleStripeWebhook(rawBody, signature);
  return NextResponse.json(result.body, { status: result.status });
}
