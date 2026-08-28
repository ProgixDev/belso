"use server";

import { headers } from "next/headers";
import { isDatabaseConfigured, query } from "@/core/db";
import { logger } from "@/lib/logger";
import { consumeEnquiryAllowance } from "./rate-limit";
import { type EnquiryField, type EnquiryResult, type EnquiryValues, enquirySchema } from "./types";

/**
 * The only untrusted input path on the site, and now the only one that writes.
 *
 * It was a painted door until spec 010 — it validated exactly like the real
 * thing and persisted nothing, so every lead the site produced was lost. The
 * signature, the validation and the result shape below are unchanged; what was
 * a comment saying "nothing is stored" is now the insert.
 *
 * Three properties this path has to hold, none of them optional:
 *
 * - **Throttled before it writes.** No account, no CSRF token beyond the Server
 *   Action's own, and a table of personal data at the end of it.
 * - **The visitor's words survive a failure.** A refused submit returns
 *   everything they typed, because retyping a considered enquiry is how a lead
 *   is lost to a rate limit.
 * - **Nothing about them reaches the logs.** The payload is a name, an email
 *   and a phone number. It was already true here and stays true.
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

  /*
   * Counted before anything is parsed.
   *
   * Validation used to run first, which meant a malformed payload cost an
   * attacker nothing — the throttle was never reached, so they could hammer
   * this action indefinitely for free. This counter is looser than the one
   * guarding the table precisely so that a person mistyping their email three
   * times is unaffected by it.
   */
  if (isDatabaseConfigured()) {
    const attempt = await consumeEnquiryAllowance(await senderKey(), "form", "attempt");
    if (!attempt.allowed) {
      logger.info("enquiry attempt throttled before validation");
      return { ok: false, fieldErrors: {}, formError: "throttled", values };
    }
  }

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

  const subject = parsed.data.subject || parsed.data.reference || "";

  /*
   * With no database configured this stays a painted door.
   *
   * That is the state of a fresh clone and of `pnpm verify`, and it is the same
   * branch the catalogue takes — see `repository.ts`. It is deliberately not
   * the outage path: a real failure to store an enquiry must tell the visitor,
   * because they are owed the truth about whether their message was sent.
   */
  if (!isDatabaseConfigured()) {
    logger.info("enquiry accepted without persistence (no database configured)");
    return { ok: true, subject };
  }

  try {
    const allowance = await consumeEnquiryAllowance(
      await senderKey(),
      parsed.data.reference || "",
      "store",
    );

    if (!allowance.allowed) {
      logger.info("enquiry throttled");
      return { ok: false, fieldErrors: {}, formError: "throttled", values };
    }

    await query(
      `insert into enquiries (property_id, reference, subject, name, email, phone, message)
       values (
         (select id from properties where reference = $1),
         nullif($1, ''), nullif($2, ''), $3, $4, nullif($5, ''), $6
       )`,
      [
        parsed.data.reference ?? "",
        parsed.data.subject ?? "",
        parsed.data.name,
        parsed.data.email,
        parsed.data.phone ?? "",
        parsed.data.message,
      ],
    );
  } catch (error) {
    /*
     * Deliberately not `ok: true`.
     *
     * A green confirmation over a failed write is the worst outcome available
     * here: the visitor believes an agent has their message and stops chasing,
     * and nobody ever learns the enquiry existed. Telling them it did not send
     * costs one retry; the alternative costs the lead.
     *
     * The error is logged without the payload — it is their name, email and
     * phone number, and an incident is not a reason to write those to a file.
     */
    logger.error("enquiry could not be stored", {
      cause: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, fieldErrors: {}, formError: "generic", values };
  }

  return { ok: true, subject };
}

/**
 * Who is sending, for throttling only — never stored raw (see `rate-limit.ts`).
 *
 * `x-forwarded-for` is set by whatever proxy sits in front of us, and its first
 * entry is the client as that proxy saw it. It is trivially forged by a client
 * talking to the origin directly, so this is a limiter against volume, not an
 * identity: the honest framing is that it raises the cost of flooding, and the
 * database constraints and the nightly retention job are what actually bound
 * the damage.
 *
 * With no forwarded header — a direct connection, or a proxy that strips it —
 * every sender collapses onto one bucket. That is deliberately the strict
 * direction: shared throttling is an inconvenience, unthrottled is an open
 * table.
 */
async function senderKey(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip")?.trim() || "unknown";
}
