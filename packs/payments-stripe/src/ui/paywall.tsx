"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { startCheckout, openBillingPortal } from "../actions";
import { type Entitlement } from "../schema";

/**
 * DESIGN: replace after the Claude Design pass. Functional placeholder paywall.
 * Shows the current entitlement and a subscribe/manage button wired to the
 * Server Actions. Pass the active priceId for your test-mode Price.
 */
export function Paywall({
  entitlement,
  priceId,
}: {
  entitlement: Entitlement;
  priceId: string;
}) {
  const [pending, start] = useTransition();
  const isActive = entitlement.status === "active";

  return (
    <Card className="mx-auto max-w-sm space-y-4 p-6">
      <h2 className="text-lg font-semibold">{isActive ? "You're subscribed" : "Go Pro"}</h2>
      <p className="text-sm text-muted-foreground">
        Status: <span data-testid="entitlement-status">{entitlement.status}</span>
      </p>
      {isActive ? (
        <Button
          className="w-full"
          disabled={pending}
          onClick={() => start(() => void openBillingPortal())}
        >
          Manage subscription
        </Button>
      ) : (
        <Button
          className="w-full"
          disabled={pending}
          onClick={() => start(() => void startCheckout({ priceId }))}
        >
          {pending ? "Redirecting…" : "Subscribe"}
        </Button>
      )}
    </Card>
  );
}
