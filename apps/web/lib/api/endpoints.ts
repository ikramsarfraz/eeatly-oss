import type { DashboardMeals } from "@/types";

export type MealsListResponse = DashboardMeals;

export type CreateMealLogResponse = {
  mealLog: unknown;
};

export type PresignUploadResponse = {
  url: string;
  fields: Record<string, string>;
  publicUrl: string;
  key: string;
};

export const endpoints = {
  meals: {
    list: () => "/api/meals",
    create: () => "/api/meals"
  },
  uploads: {
    presign: () => "/api/uploads/presign"
  }
};
