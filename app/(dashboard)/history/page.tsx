import { HistoryTable } from "@/components/dashboard/history-table";
import { MealStatsList } from "@/components/dashboard/meal-stats-list";
import {
  BaseTabs,
  BaseTabsList,
  BaseTabsPanel,
  BaseTabsTab
} from "@/components/ui/base-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardMealsAction } from "@/actions/meals";

export default async function HistoryPage() {
  const meals = await getDashboardMealsAction();

  return (
    <div className="grid gap-4 pb-20 md:gap-5 md:pb-0">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Cooking history</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Your meal memory</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Review what you have cooked, spot reliable repeats, and log old favorites again
          when they come back into rotation.
        </p>
      </div>

      <BaseTabs defaultValue="recent">
        <BaseTabsList>
          <BaseTabsTab value="recent">Recent</BaseTabsTab>
          <BaseTabsTab value="most">Most cooked</BaseTabsTab>
          <BaseTabsTab value="neglected">Neglected</BaseTabsTab>
        </BaseTabsList>
        <BaseTabsPanel value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Recent logs</CardTitle>
            </CardHeader>
            <CardContent>
              <HistoryTable meals={meals.recentMeals} />
            </CardContent>
          </Card>
        </BaseTabsPanel>
        <BaseTabsPanel value="most">
          <MealStatsList title="Most cooked meals" meals={meals.mostCookedMeals} />
        </BaseTabsPanel>
        <BaseTabsPanel value="neglected">
          <MealStatsList title="Meals not cooked recently" meals={meals.neglectedMeals} />
        </BaseTabsPanel>
      </BaseTabs>
    </div>
  );
}
