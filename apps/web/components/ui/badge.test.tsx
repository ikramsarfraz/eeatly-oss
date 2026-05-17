import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge (R22 tones)", () => {
  it.each([
    ["sage", /var\(--primary-soft\)/],
    ["wheat", /#EDDFB7/],
    ["terra", /#EFD5C9/],
    ["ghost", /bg-transparent/],
    ["danger", /var\(--destructive\)/]
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
