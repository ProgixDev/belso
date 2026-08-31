import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_PREFIX } from "@/core/session-cookie";
import { PropertyEditor } from "@/features/properties";

export const metadata: Metadata = { title: "Nouveau bien" };

/**
 * Creating a listing.
 *
 * It arrives as a **draft**, always — publishing is a separate, deliberate act
 * from the listing's own page. That is what makes AC-2 hold without anyone
 * being careful: a half-written listing cannot reach the public catalogue by
 * pressing the wrong button, because the button does not exist here.
 */
export default function NewListingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`${ADMIN_PREFIX}/listings`}
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          ← Tous les biens
        </Link>
        <h1 className="font-serif text-3xl">Nouveau bien</h1>
        <p className="text-muted-foreground text-sm">
          Le bien est enregistré en brouillon. Vous le publierez depuis sa page, quand il sera prêt.
        </p>
      </div>

      <PropertyEditor />
    </div>
  );
}
