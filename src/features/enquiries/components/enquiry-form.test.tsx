import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * The action is stubbed, not loaded.
 *
 * Since spec 010 `actions.ts` reaches `@/core/db` — and so `pg`, `env` and
 * `server-only` — which Next compiles away for the client but vitest resolves
 * for real. This test renders a form; the action is exercised in
 * `actions.test.ts` and, against a live database, in `enquiries.db.test.ts`.
 */
vi.mock("../actions", () => ({ submitEnquiryAction: vi.fn() }));
import { EnquiryForm, type EnquiryLabels } from "./enquiry-form";

/**
 * The action's own tests prove the validation. These prove the wiring that is
 * invisible when it is missing: that every control is reachable by its label,
 * and that the property reference travels with the enquiry without the visitor
 * typing it (AC-6).
 */

const labels: EnquiryLabels = {
  title: "Ask about this property",
  name: "Name",
  email: "Email",
  phoneOptional: "Phone (optional)",
  message: "Message",
  submit: "Send enquiry",
  sending: "Sending…",
  successTitle: "Your enquiry is on its way",
  successBody: "We’ll come back to you within 24 hours.",
  referenceNote: "Your enquiry will quote reference BL-1101.",
  errors: {
    name: "Enter your name.",
    email: "Enter a valid email address.",
    phone: "That phone number is too long.",
    message: "Write a few words about what you’re looking for.",
  },
  errorGeneric: "The enquiry couldn’t be sent.",
  errorThrottled: "You’ve already sent us several messages.",
};

describe("EnquiryForm", () => {
  it("exposes every control by its visible label", () => {
    render(<EnquiryForm labels={labels} />);

    // Queried by label rather than by test id: if these pass, the field is
    // reachable to a screen reader too.
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send enquiry" })).toBeInTheDocument();
  });

  it("carries the property reference without the visitor typing it (AC-6)", () => {
    const { container } = render(
      <EnquiryForm labels={labels} reference="BL-1101" subject="Atlas view villa" />,
    );

    expect(container.querySelector('input[name="reference"]')).toHaveValue("BL-1101");
    expect(container.querySelector('input[name="subject"]')).toHaveValue("Atlas view villa");
    expect(screen.getByText(/BL-1101/)).toBeInTheDocument();
  });

  it("omits the reference entirely on the general contact form", () => {
    const { container } = render(<EnquiryForm labels={labels} />);

    // An empty hidden field would submit "" and read as a listing that vanished.
    expect(container.querySelector('input[name="reference"]')).toBeNull();
    expect(container.querySelector('input[name="subject"]')).toBeNull();
  });

  it("starts with no error messages showing", () => {
    render(<EnquiryForm labels={labels} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Enter a valid email address.")).not.toBeInTheDocument();
  });
});
