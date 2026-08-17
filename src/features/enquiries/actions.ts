"use server";

import { logger } from "@/lib/logger";
import { type EnquiryField, type EnquiryResult, type EnquiryValues, enquirySchema } from "./types";

/**
 * The only untrusted input path in this spec.
 *
 * **Painted door** (docs/process/painted-door.md): this validates exactly like
 * the real thing and then persists nothing. The destination is the back-office
 * inbox, which is Phase 2 of the product (spec 003). The no-op is stated here
 * and in the return value's shape so nobody mistakes a green confirmation for a
 * delivered enquiry.
 */

/** Pull the visitor's text back out of the payload so a failed submit can refill the form. */
function readValues(formData: FormData): EnquiryValues {
  const read = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  return {
    name: read("name"),
    email: read("email"),
    phone: read("phone"),
    message: read("message"),
  };
}

export async function submitEnquiryAction(
  _previous: EnquiryResult | null,
  formData: FormData,
): Promise<EnquiryResult> {
  const values = readValues(formData);

  const parsed = enquirySchema.safeParse({
    ...values,
    reference: formData.get("reference") ?? "",
    subject: formData.get("subject") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Partial<Record<EnquiryField, EnquiryField>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      // The message *is* the error key — see the note in types.ts on why the
      // action does not produce prose.
      if (typeof field === "string" && issue.message) {
        fieldErrors[field as EnquiryField] = issue.message as EnquiryField;
      }
    }

    // Nothing about the visitor is logged: the payload is their name, email and
    // phone number, and this is a failed-validation path, not an incident.
    logger.info("enquiry rejected by validation", { fields: Object.keys(fieldErrors) });

    return { ok: false, fieldErrors, values };
  }

  // ---------------------------------------------------------------------------
  // PAINTED DOOR: nothing is stored and nothing is emailed. Replace this comment
  // with the write to the enquiries table (spec 003) — the signature, the
  // validation and the result shape above are already what the real action needs.
  // ---------------------------------------------------------------------------

  return { ok: true, subject: parsed.data.subject || parsed.data.reference || "" };
}
