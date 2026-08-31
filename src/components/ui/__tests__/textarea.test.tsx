import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Field } from "../field";
import { Textarea } from "../textarea";

describe("Textarea", () => {
  it("takes the wiring a Field hands it, so the label reaches it", () => {
    render(
      <Field id="description" label="Description">
        {(wiring) => <Textarea {...wiring} />}
      </Field>,
    );

    // Only passes if `id`/`htmlFor` actually connect — which is the whole point
    // of spreading the wiring rather than setting an id by hand.
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("carries the invalid state through to assistive technology", () => {
    render(
      <Field id="description" label="Description" error="Il manque la description.">
        {(wiring) => <Textarea {...wiring} />}
      </Field>,
    );

    const box = screen.getByLabelText("Description");
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("Il manque la description.");
  });

  it("accepts multi-line text", async () => {
    render(<Textarea aria-label="Description" />);
    const box = screen.getByLabelText("Description");

    await userEvent.type(box, "Première ligne{Enter}Seconde ligne");

    // The reason this is a textarea and not an Input: Enter has to insert a
    // newline rather than submit the form around it.
    expect(box).toHaveValue("Première ligne\nSeconde ligne");
  });

  it("forwards name and defaultValue so it works in an uncontrolled form", () => {
    render(<Textarea aria-label="Description" name="fr.description" defaultValue="Déjà écrit" />);

    const box = screen.getByLabelText("Description");
    expect(box).toHaveAttribute("name", "fr.description");
    expect(box).toHaveValue("Déjà écrit");
  });
});
