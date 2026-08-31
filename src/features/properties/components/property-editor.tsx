"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { currencies } from "@/core/currency";
import { type Locale, defaultLocale, locales } from "@/core/i18n";
import { createListingAction, saveListingAction } from "../admin-actions";
import type { ListingActionResult } from "../admin-actions";
import type { EditorListing } from "../admin-repository";
import { districtOrder, districts } from "../districts";
import { amenities, listingKinds, listingStatuses, propertyTypes } from "../types";

/**
 * The listing editor.
 *
 * **French copy written here rather than passed in.** The back-office is
 * French-only for three people at one agency (spec 011); threading labels
 * through props to support a language nobody will read would be ceremony, and
 * the day there is a second language this is the smallest file to revisit.
 *
 * A real `<form action>` on a Server Action, so it submits before hydration —
 * the same standard the enquiry form is held to, and it matters more here: this
 * form is long, and the moment before hydration is exactly when somebody who
 * has been typing for ten minutes presses save.
 */

const FRENCH_NAMES: Record<string, string> = {
  villa: "Villa",
  riad: "Riad",
  apartment: "Appartement",
  penthouse: "Penthouse",
  townhouse: "Maison de ville",
  land: "Terrain",
  chalet: "Chalet",
  estate: "Domaine",
  sale: "Vente",
  rent: "Location",
  available: "Disponible",
  underOffer: "Sous offre",
  sold: "Vendu",
  rented: "Loué",
  pool: "Piscine",
  garden: "Jardin",
  terrace: "Terrasse",
  hammam: "Hammam",
  gym: "Salle de sport",
  garage: "Garage",
  airConditioning: "Climatisation",
  underfloorHeating: "Chauffage au sol",
  staffQuarters: "Logement de personnel",
  security: "Gardiennage",
  elevator: "Ascenseur",
  golfAccess: "Accès golf",
  atlasView: "Vue Atlas",
  furnished: "Meublé",
};

const label = (value: string) => FRENCH_NAMES[value] ?? value;
const options = (values: readonly string[]) =>
  values.map((value) => ({ value, label: label(value) }));

const districtOptions = districtOrder.map((id) => ({
  value: id,
  // The neighbourhood's own French name, not its id — she knows Guéliz, not
  // `gueliz`.
  label: districts[id].copy.fr.name,
}));

/**
 * What each failure means, in the language of the person reading it.
 *
 * The actions return keys; the sentences live here. That is the same rule the
 * enquiry form follows, and it is what lets `admin-actions.test.ts` assert two
 * outcomes are identical by comparing values rather than prose.
 */
const MESSAGES: Record<string, string> = {
  conflict:
    "Quelqu’un a enregistré ce bien pendant que vous le modifiiez. Rechargez la page pour voir la version à jour — vos modifications ne sont pas enregistrées.",
  referenceTaken: "Cette référence est déjà utilisée par un autre bien.",
  slugTaken: "Cette adresse est déjà utilisée par un autre bien.",
  missing: "Ce bien n’existe plus.",
  unavailable: "La base de données n’a pas répondu. Réessayez dans un instant.",
  invalid: "Certains champs sont incomplets ou incorrects.",
};

/** French names for the field keys an action can name as missing. */
const FIELD_NAMES: Record<string, string> = {
  reference: "la référence",
  price: "le prix",
  builtArea: "la surface habitable",
  "fr.title": "le titre en français",
  "fr.description": "la description en français",
  "fr.slug": "l’adresse en français",
  "fr.district": "le quartier en français",
  "fr.city": "la ville en français",
};

function SaveButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : children}
    </Button>
  );
}

function NumberField({
  id,
  name,
  label: text,
  value,
  optional,
}: {
  id: string;
  name: string;
  label: string;
  value: number | undefined;
  optional?: boolean;
}) {
  return (
    <Field id={id} label={text}>
      {(wiring) => (
        <Input
          {...wiring}
          name={name}
          type="number"
          min={0}
          // `?? ""` and not `?? 0`: an unknown year is not the year zero, and a
          // form that prints 0 into every empty box teaches her to leave zeros
          // behind — which then reach the public page as "0 m²".
          defaultValue={value ?? ""}
          required={!optional}
        />
      )}
    </Field>
  );
}

/**
 * One language's boxes.
 *
 * **The English group being left entirely empty means no translation row is
 * written at all** — not a row of empty strings (AC-3b). The action decides
 * that from what arrives here, and what makes it decidable is that this group
 * renders the same five names in both languages, prefixed by the locale, with
 * nothing pre-filled when the translation is absent.
 *
 * The alternative — writing empty strings — puts the listing on the English
 * site with a blank heading and *no* untranslated note, because as far as the
 * public site is concerned a translation exists. The note is the honest
 * outcome, and it only appears when the row is missing.
 */
function TextGroup({
  locale,
  listing,
  problems,
}: {
  locale: Locale;
  listing?: EditorListing;
  problems: string[];
}) {
  const text = listing?.translations[locale];
  const required = locale === defaultLocale;

  return (
    <fieldset className="border-border/60 flex flex-col gap-4 rounded-lg border p-5">
      <legend className="px-2 text-sm font-medium">
        {required ? "Français — obligatoire" : "English — optionnel"}
      </legend>

      {!required ? (
        <p className="text-muted-foreground text-sm">
          Laissez ce bloc entièrement vide et le bien restera en français sur le site anglais, avec
          une note. Vous pourrez traduire plus tard sans republier.
        </p>
      ) : null}

      <Field
        id={`${locale}-title`}
        label="Titre"
        error={problems.includes(`${locale}.title`) ? "Ce champ est obligatoire." : undefined}
      >
        {(wiring) => (
          <Input {...wiring} name={`${locale}.title`} defaultValue={text?.title ?? ""} />
        )}
      </Field>

      <Field
        id={`${locale}-description`}
        label="Description"
        error={problems.includes(`${locale}.description`) ? "Ce champ est obligatoire." : undefined}
      >
        {(wiring) => (
          <Textarea
            {...wiring}
            name={`${locale}.description`}
            rows={6}
            defaultValue={text?.description ?? ""}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${locale}-district`} label="Quartier (texte affiché)">
          {(wiring) => (
            <Input {...wiring} name={`${locale}.district`} defaultValue={text?.district ?? ""} />
          )}
        </Field>
        <Field id={`${locale}-city`} label="Ville">
          {(wiring) => (
            <Input {...wiring} name={`${locale}.city`} defaultValue={text?.city ?? ""} />
          )}
        </Field>
      </div>

      <Field
        id={`${locale}-slug`}
        label="Adresse de la page"
        hint={
          text?.slug
            ? "Modifier cette adresse redirige automatiquement l’ancienne vers la nouvelle."
            : "Laissez vide pour la déduire du titre."
        }
      >
        {(wiring) => <Input {...wiring} name={`${locale}.slug`} defaultValue={text?.slug ?? ""} />}
      </Field>
    </fieldset>
  );
}

export function PropertyEditor({ listing }: { listing?: EditorListing }) {
  const [result, formAction] = useActionState<ListingActionResult | null, FormData>(
    listing ? saveListingAction : createListingAction,
    null,
  );

  const failed = result && !result.ok ? result : null;
  const problems = failed?.fields ?? [];
  const named = problems.map((key) => FIELD_NAMES[key]).filter(Boolean);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {listing ? (
        <>
          <input type="hidden" name="id" value={listing.id} />
          {/*
           * The version the form was loaded at. Carried through the round trip
           * and checked against the stored one, which is how the second person
           * to save is told rather than silently winning (AC-10).
           */}
          <input type="hidden" name="version" value={listing.version} />
        </>
      ) : null}

      {failed ? (
        <p role="alert" className="text-destructive text-sm">
          {MESSAGES[failed.error] ?? MESSAGES.invalid}
          {named.length > 0 ? ` Il manque ${named.join(", ")}.` : ""}
        </p>
      ) : null}

      <fieldset className="border-border/60 flex flex-col gap-4 rounded-lg border p-5">
        <legend className="px-2 text-sm font-medium">Le bien</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="reference"
            label="Référence"
            error={problems.includes("reference") ? "Ce champ est obligatoire." : undefined}
          >
            {(wiring) => (
              <Input
                {...wiring}
                name="reference"
                defaultValue={listing?.reference ?? ""}
                required
              />
            )}
          </Field>

          <Field id="districtId" label="Quartier">
            {(wiring) => (
              <Select
                {...wiring}
                name="districtId"
                options={districtOptions}
                defaultValue={listing?.districtId ?? districtOrder[0]}
              />
            )}
          </Field>

          <Field id="kind" label="Type d’offre">
            {(wiring) => (
              <Select
                {...wiring}
                name="kind"
                options={options(listingKinds)}
                defaultValue={listing?.kind ?? "sale"}
              />
            )}
          </Field>

          <Field id="type" label="Nature du bien">
            {(wiring) => (
              <Select
                {...wiring}
                name="type"
                options={options(propertyTypes)}
                defaultValue={listing?.type ?? "villa"}
              />
            )}
          </Field>

          <Field id="status" label="Disponibilité">
            {(wiring) => (
              <Select
                {...wiring}
                name="status"
                options={options(listingStatuses)}
                defaultValue={listing?.status ?? "available"}
              />
            )}
          </Field>

          <Field id="listedAt" label="Date de mise en vente">
            {(wiring) => (
              <Input
                {...wiring}
                name="listedAt"
                type="date"
                defaultValue={listing?.listedAt ?? new Date().toISOString().slice(0, 10)}
                required
              />
            )}
          </Field>

          <Field
            id="price"
            label="Prix"
            error={problems.includes("price") ? "Indiquez un montant." : undefined}
          >
            {/*
             * `type="text"`, not `type="number"`. A number input silently
             * discards a value it cannot parse — a price typed with spaces as
             * thousand separators, which is how it is written in French — and
             * the field simply empties itself as she leaves it. The action
             * normalises spaces and the comma instead.
             */}
            {(wiring) => (
              <Input
                {...wiring}
                name="price"
                inputMode="decimal"
                defaultValue={listing?.price ?? ""}
                required
              />
            )}
          </Field>

          <Field id="currency" label="Devise">
            {(wiring) => (
              <Select
                {...wiring}
                name="currency"
                options={currencies.map((value) => ({ value, label: value }))}
                defaultValue={listing?.currency ?? "MAD"}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="bedrooms" name="bedrooms" label="Chambres" value={listing?.bedrooms} />
          <NumberField
            id="bathrooms"
            name="bathrooms"
            label="Salles de bain"
            value={listing?.bathrooms}
          />
          <NumberField
            id="parking"
            name="parking"
            label="Stationnements"
            value={listing?.parking}
          />
          <NumberField
            id="builtArea"
            name="builtArea"
            label="Surface habitable (m²)"
            value={listing?.builtArea}
          />
          <NumberField
            id="landArea"
            name="landArea"
            label="Terrain (m²)"
            value={listing?.landArea}
            optional
          />
          <NumberField
            id="builtYear"
            name="builtYear"
            label="Année de construction"
            value={listing?.builtYear}
            optional
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Prestations</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {amenities.map((amenity) => (
              <label key={amenity} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="amenities"
                  value={amenity}
                  defaultChecked={listing?.amenities.includes(amenity)}
                  className="accent-foreground"
                />
                {label(amenity)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="lat"
            label="Latitude"
            hint="Laissez vide et le bien sera placé au centre de son quartier, avec la mention « emplacement approximatif »."
          >
            {(wiring) => (
              <Input
                {...wiring}
                name="lat"
                inputMode="decimal"
                defaultValue={listing?.coordinates?.lat ?? ""}
              />
            )}
          </Field>
          <Field id="lng" label="Longitude">
            {(wiring) => (
              <Input
                {...wiring}
                name="lng"
                inputMode="decimal"
                defaultValue={listing?.coordinates?.lng ?? ""}
              />
            )}
          </Field>
        </div>
      </fieldset>

      {locales.map((locale) => (
        <TextGroup key={locale} locale={locale} listing={listing} problems={problems} />
      ))}

      <div className="flex items-center gap-3">
        <SaveButton>{listing ? "Enregistrer" : "Créer le brouillon"}</SaveButton>
        {result?.ok ? (
          <span role="status" className="text-muted-foreground text-sm">
            Enregistré.
          </span>
        ) : null}
      </div>
    </form>
  );
}
