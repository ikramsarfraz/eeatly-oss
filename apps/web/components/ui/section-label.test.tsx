import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionLabel } from "./section-label";

describe("SectionLabel", () => {
  it("renders the children with the mono-caps treatment", () => {
    render(<SectionLabel>Ingredients</SectionLabel>);
    const label = screen.getByText("Ingredients");
    expect(label).toBeInTheDocument();
    // Mono + uppercase classes applied (key visual contract — if these
    // change, the surface stops reading as a section header).
    expect(label.className).toMatch(/font-mono/);
    expect(label.className).toMatch(/uppercase/);
  });

  it("forwards the `id` prop so a section can `aria-labelledby` it", () => {
    render(<SectionLabel id="ingredients-heading">Ingredients</SectionLabel>);
    expect(screen.getByText("Ingredients")).toHaveAttribute(
      "id",
      "ingredients-heading"
    );
  });
});
