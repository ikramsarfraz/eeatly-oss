import { describe, expect, it } from "vitest";
import {
  effortLevelSchema,
  mealLogInputSchema,
  presignedUploadInputSchema
} from "./meals";

describe("effortLevelSchema", () => {
  it.each(["quick", "easy", "medium", "high_effort"] as const)("accepts %s", (value) => {
    expect(effortLevelSchema.parse(value)).toBe(value);
  });

  it("rejects unknown values", () => {
    expect(() => effortLevelSchema.parse("trivial")).toThrow();
  });
});

describe("mealLogInputSchema", () => {
  const valid = {
    mealName: "Soy ginger noodles",
    effortLevel: "easy" as const,
    notes: "with extra chili crisp",
    cookedDate: "2026-05-13",
    photoUrl: "",
    recipeText: "",
    recipeSourceUrl: ""
  };

  it("accepts a minimal valid payload", () => {
    const parsed = mealLogInputSchema.parse(valid);
    expect(parsed.mealName).toBe("Soy ginger noodles");
    expect(parsed.effortLevel).toBe("easy");
  });

  it("trims and rejects too-short meal names", () => {
    expect(() =>
      mealLogInputSchema.parse({ ...valid, mealName: "  a  " })
    ).toThrow(/Add a meal name/);
  });

  it("rejects too-long meal names", () => {
    expect(() =>
      mealLogInputSchema.parse({ ...valid, mealName: "x".repeat(121) })
    ).toThrow(/under 120 characters/);
  });

  it("rejects invalid cookedDate format", () => {
    expect(() => mealLogInputSchema.parse({ ...valid, cookedDate: "May 13" })).toThrow();
    expect(() => mealLogInputSchema.parse({ ...valid, cookedDate: "2026-5-13" })).toThrow();
    expect(() => mealLogInputSchema.parse({ ...valid, cookedDate: "" })).toThrow();
  });

  it("accepts empty notes via .or(z.literal(''))", () => {
    expect(mealLogInputSchema.parse({ ...valid, notes: "" }).notes).toBe("");
  });

  it("caps notes length", () => {
    expect(() =>
      mealLogInputSchema.parse({ ...valid, notes: "x".repeat(1001) })
    ).toThrow(/under 1000 characters/);
  });

  it("rejects malformed photoUrl", () => {
    expect(() => mealLogInputSchema.parse({ ...valid, photoUrl: "not a url" })).toThrow();
  });

  it("accepts empty photoUrl", () => {
    expect(mealLogInputSchema.parse({ ...valid, photoUrl: "" }).photoUrl).toBe("");
  });

  it("rejects malformed recipeSourceUrl", () => {
    expect(() =>
      mealLogInputSchema.parse({ ...valid, recipeSourceUrl: "javascript:alert(1)" })
    ).toThrow();
  });

  it("caps recipeText length at 10,000", () => {
    expect(() =>
      mealLogInputSchema.parse({ ...valid, recipeText: "x".repeat(10001) })
    ).toThrow(/under 10,000 characters/);
  });
});

describe("presignedUploadInputSchema", () => {
  it("accepts image content types", () => {
    expect(() =>
      presignedUploadInputSchema.parse({ filename: "a.jpg", contentType: "image/jpeg" })
    ).not.toThrow();
    expect(() =>
      presignedUploadInputSchema.parse({ filename: "a.png", contentType: "image/png" })
    ).not.toThrow();
  });

  it("rejects non-image content types", () => {
    expect(() =>
      presignedUploadInputSchema.parse({ filename: "evil.sh", contentType: "application/x-sh" })
    ).toThrow(/Only image uploads/);
    expect(() =>
      presignedUploadInputSchema.parse({ filename: "doc.pdf", contentType: "application/pdf" })
    ).toThrow(/Only image uploads/);
  });

  it("caps filename length at 180", () => {
    expect(() =>
      presignedUploadInputSchema.parse({
        filename: "a".repeat(181),
        contentType: "image/jpeg"
      })
    ).toThrow();
  });

  it("rejects empty filename", () => {
    expect(() =>
      presignedUploadInputSchema.parse({ filename: "", contentType: "image/jpeg" })
    ).toThrow();
  });
});
