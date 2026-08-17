import { describe, expect, it } from "vitest";
import { submitEnquiryAction } from "./actions";

/**
 * AC-7 lives here. The failure mode this guards is not "invalid input is
 * accepted" — it is the quieter one where a rejected submit also throws away
 * everything the visitor typed, so they have to start again.
 */

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = {
  name: "Camille Roux",
  email: "camille@example.com",
  phone: "+212 600 000 000",
  message: "I would like to arrange a viewing next month.",
};

describe("submitEnquiryAction", () => {
  it("accepts a complete enquiry and names the subject back", async () => {
    const result = await submitEnquiryAction(null, form({ ...valid, subject: "BL-1101" }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.subject).toBe("BL-1101");
  });

  it("rejects a malformed email and returns no success", async () => {
    const result = await submitEnquiryAction(null, form({ ...valid, email: "camille@example" }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.email).toBe("email");
  });

  it("rejects a missing email", async () => {
    const result = await submitEnquiryAction(null, form({ ...valid, email: "" }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.email).toBe("email");
  });

  it("keeps every other field the visitor typed when one fails", async () => {
    // The regression: a rejected submit that also empties the form. The visitor
    // fixes one character and has to retype everything else.
    const result = await submitEnquiryAction(null, form({ ...valid, email: "nope" }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.values.name).toBe(valid.name);
      expect(result.values.phone).toBe(valid.phone);
      expect(result.values.message).toBe(valid.message);
      // Including the offending value, so they can see and correct it.
      expect(result.values.email).toBe("nope");
    }
  });

  it("names every failing field at once rather than one at a time", async () => {
    const result = await submitEnquiryAction(null, form({ name: "", email: "x", message: "" }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(["email", "message", "name"]);
    }
  });

  it("treats the phone number as optional", async () => {
    const result = await submitEnquiryAction(null, form({ ...valid, phone: "" }));

    expect(result.ok).toBe(true);
  });

  it("rejects a message too short to act on", async () => {
    const result = await submitEnquiryAction(null, form({ ...valid, message: "hi" }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.message).toBe("message");
  });

  it("returns error keys, never prose, so the form can translate them", async () => {
    const result = await submitEnquiryAction(null, form({ name: "", email: "", message: "" }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // A sentence here would hardcode one language into a bilingual site.
      for (const value of Object.values(result.fieldErrors)) {
        expect(["name", "email", "phone", "message"]).toContain(value);
      }
    }
  });

  it("falls back to the reference when no subject is supplied", async () => {
    const result = await submitEnquiryAction(null, form({ ...valid, reference: "BL-1108" }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.subject).toBe("BL-1108");
  });
});
