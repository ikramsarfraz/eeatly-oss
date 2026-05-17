import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge (R22 tones)", () => {
  it.each([
    // R23 promoted the R22 inline hex values to CSS variables in
    // globals.css. Each tone now resolves via a Tailwind utility that
    // maps through `@theme inline` (e.g. `bg-sage` → `--color-sage` →
    // `--sage`), so the assertions key off the utility name rather
    // than the underlying hex.
    ["sage", /bg-sage/],
    ["wheat", /bg-wheat/],
    ["terra", /bg-terra/],
    ["ghost", /bg-transparent/],
    ["danger", /bg-danger-soft/]
  ] as const)("renders the %s tone with the right class signature", (tone, pattern) => {
    render(<Badge variant={tone}>{tone}</Badge>);
    const node = screen.getByText(tone);
    expect(node.className).toMatch(pattern);
  });

  it("keeps the default variant working (regression)", () => {
    render(<Badge variant="default">default</Badge>);
    const node = screen.getByText("default");
    expect(node.className).toMatch(/bg-primary/);
  });
});
