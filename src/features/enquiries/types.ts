import { z } from "zod";

/**
 * What a visitor sends, and what comes back.
 *
 * Error messages are **field keys, not sentences**. The action runs on the
 * server and has no idea which language the page is in; returning "Indiquez
 * votre nom." would hardcode French into a slice that must serve both locales
 * (AC-7 requires the problem explained *in the language they are reading*). The
 * form maps these keys onto its dictionary.
 */

export const enquiryFieldErrors = ["name", "email", "phone", "message"] as const;
export type EnquiryField = (typeof enquiryFieldErrors)[number];

export const enquirySchema = z.object({
  name: z.string().trim().min(1, "name").max(120, "name"),
  // `z.email()` accepts `a@b`, which is technically valid and practically a
  // typo. Requiring a dot in the domain rejects the mistake people actually
  // make without pretending to validate deliverability.
  email: z
    .string()
    .trim()
    .min(1, "email")
    .max(200, "email")
    .regex(/^[^@\s]+@[^@\s.]+\.[^@\s]+$/, "email"),
  /** Optional — asking for a phone number to see a property is a barrier, not a requirement. */
  phone: z.string().trim().max(40, "phone").optional().or(z.literal("")),
  message: z.string().trim().min(10, "message").max(4000, "message"),
  /** The listing being asked about. Absent on the general contact page. */
  reference: z.string().trim().max(40).optional().or(z.literal("")),
  /** What the confirmation names back to the visitor (AC-6). */
  subject: z.string().trim().max(200).optional().or(z.literal("")),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;

/** What the visitor typed, echoed back so a failed submit never empties the form (AC-7). */
export type EnquiryValues = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

export type EnquiryResult =
  | { ok: true; subject: string }
  | {
      ok: false;
      /** Field key → error key. Both are looked up in the page's dictionary. */
      fieldErrors: Partial<Record<EnquiryField, EnquiryField>>;
      /** Set when the failure is not attributable to a field. */
      formError?: "generic";
      /** Everything typed, returned verbatim so the form can refill itself. */
      values: EnquiryValues;
    };
