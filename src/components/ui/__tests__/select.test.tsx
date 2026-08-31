import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Field } from "../field";
import { Select } from "../select";

const districts = [
  { value: "palmeraie", label: "Palmeraie" },
  { value: "gueliz", label: "Guéliz" },
] as const;

describe("Select", () => {
  it("renders an option per choice, labelled for a person", () => {
    render(<Select aria-label="Quartier" options={districts} />);

    expect(screen.getByRole("option", { name: "Palmeraie" })).toHaveValue("palmeraie");
    expect(screen.getByRole("option", { name: "Guéliz" })).toHaveValue("gueliz");
  });

  it("can be chosen from by name", async () => {
    render(<Select aria-label="Quartier" options={districts} defaultValue="palmeraie" />);
    const control = screen.getByLabelText("Quartier");

    await userEvent.selectOptions(control, "gueliz");

    expect(control).toHaveValue("gueliz");
  });

  it("offers a placeholder that cannot be chosen", () => {
    render(<Select aria-label="Quartier" options={districts} placeholder="Choisir un quartier" />);

    const placeholder = screen.getByRole("option", { name: "Choisir un quartier" });
    /*
     * Disabled, and valued `""` rather than absent: a required field has to be
     * able to tell "she has not chosen" from "she chose the first one", and a
     * placeholder that can be selected makes those the same state.
     */
    expect(placeholder).toBeDisabled();
    expect(placeholder).toHaveValue("");
  });

  it("takes the wiring a Field hands it", () => {
    render(
      <Field id="district" label="Quartier" error="Choisissez un quartier.">
        {(wiring) => <Select {...wiring} options={districts} />}
      </Field>,
    );

    const control = screen.getByLabelText("Quartier");
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAccessibleDescription("Choisissez un quartier.");
  });

  it("forwards name so it works in an uncontrolled form", () => {
    render(<Select aria-label="Quartier" options={districts} name="districtId" />);
    expect(screen.getByLabelText("Quartier")).toHaveAttribute("name", "districtId");
  });
});
