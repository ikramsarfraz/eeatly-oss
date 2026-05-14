import { describe, expect, it } from "vitest";
import {
  addDishToPlanSchema,
  clonePlanSchema,
  createPlanSchema,
  reorderDishesSchema,
  updateDishAnnotationSchema,
  updatePlanSchema
} from "./plans";

describe("createPlanSchema", () => {
  it("accepts a minimal valid payload (no notes)", () => {
    const parsed = createPlanSchema.parse({
      name: "Eid al-Adha 2024",
      scheduledDate: "2024-06-17"
    });
    expect(parsed.name).toBe("Eid al-Adha 2024");
    expect(parsed.notes).toBeUndefined();
  });

  it("rejects empty or trimming-empty names", () => {
    expect(() =>
      createPlanSchema.parse({ name: "   ", scheduledDate: "2024-06-17" })
    ).toThrow(/Give the plan a name/);
  });

  it("rejects ill-formed dates", () => {
    expect(() =>
      createPlanSchema.parse({ name: "x", scheduledDate: "2024/06/17" })
    ).toThrow(/YYYY-MM-DD/);
    expect(() =>
      createPlanSchema.parse({ name: "x", scheduledDate: "Jun 17 2024" })
    ).toThrow();
  });

  it("passes empty-string notes through; the service coerces to null on insert", () => {
    const parsed = createPlanSchema.parse({
      name: "x",
      scheduledDate: "2024-06-17",
      notes: ""
    });
    expect(parsed.notes).toBe("");
  });
});

describe("updatePlanSchema", () => {
  it("requires at least one field", () => {
    expect(() => updatePlanSchema.parse({})).toThrow(
      /at least one field/
    );
  });

  it("accepts a single-field update (notes only)", () => {
    const parsed = updatePlanSchema.parse({ notes: "table for 14" });
    expect(parsed.notes).toBe("table for 14");
    expect(parsed.name).toBeUndefined();
  });
});

describe("addDishToPlanSchema", () => {
  it("rejects non-uuid mealIds", () => {
    expect(() => addDishToPlanSchema.parse({ mealId: "abc" })).toThrow(
      /Invalid meal id/
    );
  });
});

describe("reorderDishesSchema", () => {
  it("rejects empty arrays", () => {
    expect(() => reorderDishesSchema.parse({ dishIdsInOrder: [] })).toThrow(
      /at least one dish/
    );
  });

  it("caps at 200 dishes to keep the bulk update bounded", () => {
    const big = Array.from({ length: 201 }, () => crypto.randomUUID());
    expect(() => reorderDishesSchema.parse({ dishIdsInOrder: big })).toThrow(
      /Too many/
    );
  });
});

describe("updateDishAnnotationSchema", () => {
  it("requires at least one annotation field", () => {
    expect(() => updateDishAnnotationSchema.parse({})).toThrow(
      /at least one annotation field/
    );
  });

  it("allows explicit null to clear a field (verdict null)", () => {
    const parsed = updateDishAnnotationSchema.parse({ verdict: null });
    expect(parsed.verdict).toBeNull();
  });

  it("rejects negative time taken", () => {
    expect(() =>
      updateDishAnnotationSchema.parse({ timeTakenMinutes: -5 })
    ).toThrow(/can't be negative/);
  });

  it("caps time taken at 24 hours (1440 minutes)", () => {
    expect(() =>
      updateDishAnnotationSchema.parse({ timeTakenMinutes: 1441 })
    ).toThrow(/capped at 24 hours/);
  });

  it("rejects unknown verdict values (stability of the enum)", () => {
    // Zod's .parse takes unknown, so this isn't a TS error — guard the
    // enum at runtime instead.
    expect(() => updateDishAnnotationSchema.parse({ verdict: "skip" })).toThrow();
  });
});

describe("clonePlanSchema", () => {
  it("accepts a valid clone request", () => {
    const parsed = clonePlanSchema.parse({
      sourcePlanId: "0e2a8d4f-2a2f-4b6a-9c70-7d3a5b1a2c45",
      newName: "Eid al-Adha 2025",
      newScheduledDate: "2025-06-07"
    });
    expect(parsed.newName).toBe("Eid al-Adha 2025");
  });
});
