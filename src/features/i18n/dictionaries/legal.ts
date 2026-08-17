import type { Locale } from "@/core/i18n";

/**
 * The three legal documents.
 *
 * **The body text is a marked placeholder.** Real legal copy is out of scope
 * (spec 004) and nobody has been named to supply it — the open question is
 * still on the spec. What is *not* placeholder is the structure: the headings
 * below are the sections a GDPR-compliant privacy notice and a cookie notice
 * are expected to carry, so when the real copy arrives it drops into sections
 * that already exist rather than arriving as one undifferentiated wall.
 *
 * Every section renders its heading and a visible "being written" note, so a
 * visitor is never shown an empty page, and nobody can mistake this for
 * published legal text.
 */

export const legalDocs = ["privacy", "cookies", "terms"] as const;
export type LegalDoc = (typeof legalDocs)[number];

export function isLegalDoc(value: unknown): value is LegalDoc {
  return typeof value === "string" && (legalDocs as readonly string[]).includes(value);
}

type Section = { id: string; heading: Record<Locale, string> };

/** Section skeletons per document, in the order they should be read. */
export const legalSections: Record<LegalDoc, Section[]> = {
  privacy: [
    { id: "controller", heading: { fr: "Responsable du traitement", en: "Data controller" } },
    { id: "data", heading: { fr: "Données collectées", en: "Data we collect" } },
    { id: "purpose", heading: { fr: "Finalités et base légale", en: "Purposes and legal basis" } },
    { id: "sharing", heading: { fr: "Destinataires des données", en: "Who receives your data" } },
    { id: "retention", heading: { fr: "Durée de conservation", en: "How long we keep it" } },
    { id: "rights", heading: { fr: "Vos droits", en: "Your rights" } },
    { id: "transfers", heading: { fr: "Transferts hors UE", en: "Transfers outside the EU" } },
    { id: "contact", heading: { fr: "Nous contacter", en: "Contacting us" } },
  ],
  cookies: [
    { id: "what", heading: { fr: "Ce qu’est un cookie", en: "What a cookie is" } },
    { id: "used", heading: { fr: "Cookies que nous utilisons", en: "Cookies we use" } },
    { id: "consent", heading: { fr: "Votre consentement", en: "Your consent" } },
    { id: "manage", heading: { fr: "Gérer vos préférences", en: "Managing your preferences" } },
  ],
  terms: [
    { id: "scope", heading: { fr: "Objet", en: "Scope" } },
    { id: "listings", heading: { fr: "Informations sur les biens", en: "Property information" } },
    { id: "liability", heading: { fr: "Responsabilité", en: "Liability" } },
    { id: "ip", heading: { fr: "Propriété intellectuelle", en: "Intellectual property" } },
    { id: "law", heading: { fr: "Droit applicable", en: "Governing law" } },
  ],
};
