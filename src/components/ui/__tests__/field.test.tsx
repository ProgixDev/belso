import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "../badge";
import { Field } from "../field";
import { Input } from "../input";

const renderField = (props: Partial<React.ComponentProps<typeof Field>> = {}) =>
  render(
    <Field id="email" label="Email" {...props}>
      {(wiring) => <Input {...wiring} />}
    </Field>,
  );

describe("Field", () => {
  it("associates the label with the control", () => {
    renderField();
    // getByLabelText only passes if htmlFor/id actually connect.
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("is not marked invalid when there is no error", () => {
    renderField();
    const input = screen.getByLabelText("Email");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("announces an error and points the control at it", () => {
    renderField({ error: "Enter a valid email address." });
    const input = screen.getByLabelText("Email");
    const error = screen.getByRole("alert");

    expect(error).toHaveTextContent("Enter a valid email address.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
  });

  it("describes the control with a hint when there is no error", () => {
    renderField({ hint: "We only use this to reply." });
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-describedby")).toBe("email-hint");
  });

  it("replaces the hint with the error rather than showing both", () => {
    renderField({ hint: "We only use this to reply.", error: "Enter a valid email address." });
    expect(screen.queryByText("We only use this to reply.")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("Badge", () => {
  it("renders every variant with the label as the meaning, not the colour", () => {
    const variants = ["default", "accent", "outline", "muted"] as const;
    render(
      <>
        {variants.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </>,
    );
    for (const variant of variants) {
      expect(screen.getByText(variant)).toBeInTheDocument();
    }
  });
});
