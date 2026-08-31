"use client";

import { Button } from "@/components/ui/button";

/**
 * Almost always the database being unreachable — the back-office has no
 * fallback to fixtures, deliberately: showing her invented listings in the
 * screen she edits from would be worse than showing nothing.
 */
export default function ListingsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="font-serif text-2xl">Les biens ne se chargent pas.</h1>
      <p className="text-muted-foreground text-sm">
        La base de données n’a pas répondu. Rien n’est perdu — réessayez dans un instant.
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  );
}
