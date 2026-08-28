// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import pg from "pg";

vi.mock("server-only", () => ({}));

/**
 * AC-4 — an enquiry is stored, and the excess is refused.
 *
 * Runs under `vitest.db.config.mts` (`pnpm test:db`), for the same reason the
 * repository's database tests do: this **writes**, and it must not race a
 * reader. Skipped with no `DATABASE_URL`.
 *
 * `next/headers` is stubbed. The action reads `x-forwarded-for` to key the
 * throttle, and outside a request there is no header store to read — the point
 * under test is what the action does with a sender, not how Next hands it one.
 */
const url = process.env.DATABASE_URL;
const describeDb = url ? describe : describe.skip;

let sender = "203.0.113.10";
vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", sender]]) as unknown as Headers,
}));

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const VALID = {
  name: "Camille Rey",
  email: "camille@example.com",
  phone: "+212600000000",
  message: "Bonjour, je souhaite visiter ce bien la semaine prochaine si possible.",
};

describeDb("enquiries against Postgres (spec 010 AC-4)", () => {
  let sql: pg.Client;

  beforeAll(async () => {
    sql = new pg.Client({ connectionString: url });
    await sql.connect();
  });

  afterAll(async () => {
    // Leave nothing behind: this table is personal data, and these are fakes.
    await sql.query("delete from enquiries where email = $1", [VALID.email]);
    await sql.end();
  });

  beforeEach(async () => {
    await sql.query("delete from enquiries where email = $1", [VALID.email]);
    await sql.query("delete from enquiry_throttle");
    // A fresh sender per test, so one test's allowance never limits the next.
    sender = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
  });

  it("stores a valid enquiry, linked to the listing it names", async () => {
    const { submitEnquiryAction } = await import("./actions");

    const result = await submitEnquiryAction(
      null,
      form({ ...VALID, reference: "BL-1101", subject: "Villa vue Atlas" }),
    );

    expect(result.ok).toBe(true);

    const { rows } = await sql.query(
      `select e.name, e.email, e.reference, e.subject, e.message,
              p.reference as linked, e.expires_at > now() as unexpired
       from enquiries e left join properties p on p.id = e.property_id
       where e.email = $1`,
      [VALID.email],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: VALID.name,
      reference: "BL-1101",
      // Resolved to the actual listing, not merely stored as text — that link
      // is what lets the back-office show an enquiry beside its property.
      linked: "BL-1101",
      unexpired: true,
    });
  });

  it("accepts an enquiry with no listing — the contact page has none", async () => {
    const { submitEnquiryAction } = await import("./actions");

    const result = await submitEnquiryAction(null, form({ ...VALID, reference: "", subject: "" }));
    expect(result.ok).toBe(true);

    const { rows } = await sql.query(
      "select property_id, reference from enquiries where email = $1",
      [VALID.email],
    );
    // Empty strings become null rather than being stored as "", so "no listing"
    // is one value in the column instead of two.
    expect(rows[0]).toMatchObject({ property_id: null, reference: null });
  });

  it("refuses the sixth enquiry in the window, and stores nothing for it", async () => {
    const { submitEnquiryAction } = await import("./actions");

    for (let i = 0; i < 5; i++) {
      const result = await submitEnquiryAction(
        null,
        form({ ...VALID, reference: "", subject: "" }),
      );
      expect(result.ok, `submission ${i + 1} should be accepted`).toBe(true);
    }

    const sixth = await submitEnquiryAction(null, form({ ...VALID, reference: "", subject: "" }));

    expect(sixth.ok).toBe(false);
    if (sixth.ok) throw new Error("unreachable");

    // Told the truth about *why*, not "something went wrong" — a visitor sent
    // that message retries immediately, which is what the limit exists to stop.
    expect(sixth.formError).toBe("throttled");
    // And their words come back, so a refusal never empties the form.
    expect(sixth.values.message).toBe(VALID.message);

    const { rows } = await sql.query("select count(*)::int as n from enquiries where email = $1", [
      VALID.email,
    ]);
    expect(rows[0].n, "the refused enquiry must not have been written").toBe(5);
  });

  it("counts each sender separately", async () => {
    const { submitEnquiryAction } = await import("./actions");

    for (let i = 0; i < 5; i++) {
      await submitEnquiryAction(null, form({ ...VALID, reference: "", subject: "" }));
    }
    expect((await submitEnquiryAction(null, form({ ...VALID }))).ok).toBe(false);

    // A different visitor is not punished for the first one's volume.
    sender = "192.0.2.77";
    expect((await submitEnquiryAction(null, form({ ...VALID }))).ok).toBe(true);
  });

  it("throttles invalid submissions too, so malformed spam is not free", async () => {
    const { submitEnquiryAction } = await import("./actions");
    const bad = () => form({ ...VALID, email: "not-an-address" });

    // Below the attempt limit these are ordinary validation failures.
    for (let i = 0; i < 20; i++) {
      const result = await submitEnquiryAction(null, bad());
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.fieldErrors.email, `attempt ${i + 1} should be a field error`).toBe("email");
    }

    // Past it, the action stops parsing and refuses outright — the point being
    // that an attacker sending garbage no longer gets unlimited free work.
    const past = await submitEnquiryAction(null, bad());
    expect(past.ok).toBe(false);
    if (past.ok) throw new Error("unreachable");
    expect(past.formError).toBe("throttled");

    // And nothing invalid was ever written.
    const { rows } = await sql.query("select count(*)::int as n from enquiries where email = $1", [
      "not-an-address",
    ]);
    expect(rows[0].n).toBe(0);
  });

  it("still rejects invalid input before it reaches the throttle or the table", async () => {
    const { submitEnquiryAction } = await import("./actions");

    const result = await submitEnquiryAction(null, form({ ...VALID, email: "not-an-address" }));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.fieldErrors.email).toBe("email");

    const { rows } = await sql.query("select count(*)::int as n from enquiries where email = $1", [
      "not-an-address",
    ]);
    expect(rows[0].n).toBe(0);
  });
});
