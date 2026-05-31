import { describe, expect, it } from "vitest";
import {
  asMeasurementSystem,
  inferMeasurementSystem
} from "@/lib/units/detect";

describe("inferMeasurementSystem", () => {
  it("uses geo country first — US is imperial", () => {
    expect(
      inferMeasurementSystem({ country: "US", acceptLanguage: "fr-FR" })
    ).toBe("imperial");
  });

  it("treats non-imperial countries as metric even with an en-US header", () => {
    // Geo wins over locale: a US-locale browser physically in Germany.
    expect(
      inferMeasurementSystem({ country: "DE", acceptLanguage: "en-US,en;q=0.9" })
    ).toBe("metric");
  });

  it("recognises the imperial holdouts Liberia and Myanmar", () => {
    expect(inferMeasurementSystem({ country: "LR" })).toBe("imperial");
    expect(inferMeasurementSystem({ country: "mm" })).toBe("imperial");
  });

  it("falls back to Accept-Language region when there's no geo", () => {
    expect(
      inferMeasurementSystem({ acceptLanguage: "en-US,en;q=0.9" })
    ).toBe("imperial");
    expect(
      inferMeasurementSystem({ acceptLanguage: "en-GB,en;q=0.8" })
    ).toBe("metric");
  });

  it("parses a region out of a script-tagged language", () => {
    expect(inferMeasurementSystem({ acceptLanguage: "zh-Hant-TW" })).toBe(
      "metric"
    );
  });

  it("defaults to metric when nothing is conclusive", () => {
    expect(inferMeasurementSystem({})).toBe("metric");
    expect(inferMeasurementSystem({ country: "", acceptLanguage: "en" })).toBe(
      "metric"
    );
    expect(
      inferMeasurementSystem({ country: null, acceptLanguage: null })
    ).toBe("metric");
  });

  it("ignores malformed country codes and falls through to locale", () => {
    expect(
      inferMeasurementSystem({ country: "USA", acceptLanguage: "en-US" })
    ).toBe("imperial");
  });
});

describe("asMeasurementSystem", () => {
  it("passes valid systems and rejects everything else", () => {
    expect(asMeasurementSystem("metric")).toBe("metric");
    expect(asMeasurementSystem("imperial")).toBe("imperial");
    expect(asMeasurementSystem("us")).toBeNull();
    expect(asMeasurementSystem(null)).toBeNull();
    expect(asMeasurementSystem(undefined)).toBeNull();
  });
});
