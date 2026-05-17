import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageTitle } from "./page-title";

describe("PageTitle", () => {
  it("renders the title in an h1", () => {
    render(<PageTitle title="Garlic Naan" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Garlic Naan");
  });

  it("renders the kicker, eyebrow, and subtitle when supplied", () => {
    render(
      <PageTitle
        title="Garlic Naan"
        kicker="Refine"
        eyebrow="Refined just now"
        subtitle="Bake in 6 minutes."
      />
    );
    expect(screen.getByText("Refine")).toBeInTheDocument();
    expect(screen.getByText("Refined just now")).toBeInTheDocument();
    expect(screen.getByText("Bake in 6 minutes.")).toBeInTheDocument();
  });

  it("omits the kicker / eyebrow / subtitle when not supplied", () => {
    render(<PageTitle title="Garlic Naan" />);
    expect(screen.queryByText("Refine")).not.toBeInTheDocument();
    expect(screen.queryByText("Refined just now")).not.toBeInTheDocument();
    expect(screen.queryByText("Bake in 6 minutes.")).not.toBeInTheDocument();
  });

  it.each(["s", "m", "l", "xl"] as const)(
    "renders without crashing at size=%s",
    (size) => {
      render(<PageTitle title={`Size ${size}`} size={size} />);
      expect(
        screen.getByRole("heading", { level: 1, name: `Size ${size}` })
      ).toBeInTheDocument();
    }
  );
});
