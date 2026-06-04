import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepCard } from "./step-card";

describe("StepCard", () => {
  it("renders title, time eyebrow, body, and ingredient pills when all fields are present", () => {
    render(
      <StepCard
        step={{
          number: 1,
          title: "Rinse the rice",
          time: "5 min",
          body: "Cold water until clear.",
          ingredients: ["basmati rice", "salt"]
        }}
      />
    );
    expect(screen.getByText("Rinse the rice")).toBeInTheDocument();
    expect(screen.getByText("5 min")).toBeInTheDocument();
    expect(screen.getByText("Cold water until clear.")).toBeInTheDocument();
    expect(screen.getByText("basmati rice")).toBeInTheDocument();
    expect(screen.getByText("salt")).toBeInTheDocument();
    // Numeral is in the DOM (aria-hidden span, queryable by text).
    expect(screen.getByText("1.")).toBeInTheDocument();
  });

  it("renders minimally with only numeral + title when optional fields are absent", () => {
    render(
      <StepCard
        step={{
          number: 2,
          title: "Set aside",
          time: null,
          body: "",
          ingredients: []
        }}
      />
    );
    expect(screen.getByText("Set aside")).toBeInTheDocument();
    expect(screen.getByText("2.")).toBeInTheDocument();
    // No time eyebrow.
    expect(screen.queryByText(/min$/)).not.toBeInTheDocument();
    // No ingredient list rendered.
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
