"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  type ListingActionResult,
  archiveListingAction,
  publishListingAction,
  unpublishListingAction,
} from "../admin-actions";
import type { EditorListing } from "../admin-repository";

/**
 * Publish, unpublish, archive — the three buttons that decide whether a listing
 * is on the website.
 *
 * Separate from the editor form, and not nested inside it, because HTML forbids
 * a form inside a form: putting a publish button in the editor would either
 * submit the editor or need JavaScript to work at all. Two sibling forms is the
 * shape the platform actually supports.
 *
 * It carries the same `version` the editor does, so publishing a listing
 * somebody else has since edited is refused rather than done blind (AC-10).
 */

const MESSAGES: Record<string, string> = {
  conflict: "Ce bien a été modifié entre-temps. Rechargez la page.",
  missing: "Ce bien n’existe plus.",
  invalid: "Le bien n’est pas assez complet pour être publié.",
  unavailable: "La base de données n’a pas répondu.",
};

const FIELD_NAMES: Record<string, string> = {
  reference: "la référence",
  price: "le prix",
  builtArea: "la surface habitable",
  "fr.title": "le titre",
  "fr.description": "la description",
  "fr.slug": "l’adresse",
  "fr.district": "le quartier",
  "fr.city": "la ville",
};

function ActionButton({
  children,
  variant = "default",
}: {
  children: string;
  variant?: "default" | "secondary" | "ghost";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending}>
      {pending ? "…" : children}
    </Button>
  );
}

export function PublicationControls({ listing }: { listing: EditorListing }) {
  const action =
    listing.publication === "published" ? unpublishListingAction : publishListingAction;

  const [result, publishOrUnpublish] = useActionState<ListingActionResult | null, FormData>(
    action,
    null,
  );
  const [archived, archive] = useActionState<ListingActionResult | null, FormData>(
    archiveListingAction,
    null,
  );

  const failure = [result, archived].find((r) => r && !r.ok);
  const named = (failure && !failure.ok ? (failure.fields ?? []) : [])
    .map((key) => FIELD_NAMES[key])
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={publishOrUnpublish}>
          <input type="hidden" name="id" value={listing.id} />
          <input type="hidden" name="version" value={listing.version} />
          <ActionButton>
            {listing.publication === "published" ? "Repasser en brouillon" : "Publier"}
          </ActionButton>
        </form>

        {listing.publication !== "archived" ? (
          <form action={archive}>
            <input type="hidden" name="id" value={listing.id} />
            <input type="hidden" name="version" value={listing.version} />
            {/*
             * Archiving keeps everything — the record, its translations, its
             * photographs and the addresses it has held (AC-4). It reads as the
             * destructive button and is not one, which is the whole reason
             * there is no delete button anywhere in this back-office.
             */}
            <ActionButton variant="secondary">Retirer du site</ActionButton>
          </form>
        ) : null}
      </div>

      {failure && !failure.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {MESSAGES[failure.error] ?? MESSAGES.invalid}
          {named.length > 0 ? ` Il manque ${named.join(", ")}.` : ""}
        </p>
      ) : null}
    </div>
  );
}
