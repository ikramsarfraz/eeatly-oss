export const queryKeys = {
  meals: {
    all: ["meals"] as const,
    dashboard: () => [...queryKeys.meals.all, "dashboard"] as const
  }
};
