"use client";

/* eslint-disable react-hooks/incompatible-library */

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState
} from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { ArrowUpDown, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { QuickLogDialog } from "@/components/dashboard/quick-log-dialog";
import { ShareRecipeDialog } from "@/components/dashboard/share-recipe-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { useDeleteMealLog } from "@/hooks/use-dashboard-meals";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { RecentMeal } from "@/types";

function DeleteLogButton({ meal }: { meal: RecentMeal }) {
  const { showToast } = useToast();
  const mutation = useDeleteMealLog();

  async function handleDelete() {
    try {
      await mutation.mutateAsync(meal.id);
      showToast({
        variant: "success",
        title: "Log deleted",
        description: `Removed your ${meal.mealName} entry.`
      });
    } catch {
      showToast({
        variant: "error",
        title: "Couldn't delete log",
        description: "Please try again."
      });
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          <span className="sr-only">Delete log</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this log?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes your{" "}
            <span className="font-medium text-foreground">{meal.mealName}</span> entry
            from {format(parseISO(meal.cookedAt), "MMM d, yyyy")}. The meal stays in
            your history — only this log is deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const EFFORT_LABELS: Record<RecentMeal["effortLevel"], string> = {
  quick: "Quick",
  easy: "Easy",
  medium: "Medium",
  high_effort: "High effort"
};

const EFFORT_COLORS: Record<RecentMeal["effortLevel"], string> = {
  quick: "bg-emerald-50 text-emerald-700 border-emerald-200",
  easy: "bg-sky-50 text-sky-700 border-sky-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high_effort: "bg-rose-50 text-rose-700 border-rose-200"
};

function EffortChip({ level }: { level: RecentMeal["effortLevel"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        EFFORT_COLORS[level]
      )}
    >
      {EFFORT_LABELS[level]}
    </span>
  );
}

function MobileCardList({
  meals,
  onOpenLogForm
}: {
  meals: RecentMeal[];
  onOpenLogForm: (mealName: string) => void;
}) {
  if (meals.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No meals logged yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {meals.map((meal) => (
        <div
          key={meal.id}
          className="rounded-xl border bg-card p-4"
        >
          {/* Name + effort chip */}
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 font-medium leading-snug">{meal.mealName}</p>
            <EffortChip level={meal.effortLevel} />
          </div>

          {/* Date */}
          <p className="mt-1 text-sm text-muted-foreground">
            {format(parseISO(meal.cookedAt), "MMM d, yyyy")}
          </p>

          {/* Notes */}
          {meal.notes ? (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {meal.notes}
            </p>
          ) : null}

          {/* Actions */}
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <LogAgainButton
              mealName={meal.mealName}
              effortLevel={meal.effortLevel}
              variant="ghost"
              size="sm"
              compact
            />
            <div className="flex items-center gap-1">
              <ShareRecipeDialog
                mealId={meal.mealId}
                mealName={meal.mealName}
                onOpenLogForm={onOpenLogForm}
              />
              <DeleteLogButton meal={meal} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function makeColumns(
  onOpenLogForm: (mealName: string) => void
): ColumnDef<RecentMeal>[] {
  return [
    {
      accessorKey: "mealName",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Meal
          <ArrowUpDown className="h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.mealName}</span>
    },
    {
      accessorKey: "cookedAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Cooked
          <ArrowUpDown className="h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => format(parseISO(row.original.cookedAt), "MMM d, yyyy")
    },
    {
      accessorKey: "effortLevel",
      header: "Effort",
      cell: ({ row }) => <EffortChip level={row.original.effortLevel} />
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => (
        <span className="line-clamp-1 text-muted-foreground">
          {row.original.notes ?? "No notes"}
        </span>
      )
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <LogAgainButton
            mealName={row.original.mealName}
            effortLevel={row.original.effortLevel}
            variant="ghost"
          />
          <ShareRecipeDialog
            mealId={row.original.mealId}
            mealName={row.original.mealName}
            onOpenLogForm={onOpenLogForm}
          />
          <DeleteLogButton meal={row.original} />
        </div>
      )
    }
  ];
}

export function HistoryTable({ meals }: { meals: RecentMeal[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "cookedAt", desc: true }
  ]);
  // mealName set here when the share dialog's "add recipe" button is clicked
  const [addRecipeMealName, setAddRecipeMealName] = React.useState<string | null>(null);

  const columns = React.useMemo(() => makeColumns(setAddRecipeMealName), []);

  const table = useReactTable({
    data: meals,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <>
      {/* Controlled log-form dialog — opens when share dialog requests "add recipe" */}
      <QuickLogDialog
        open={addRecipeMealName !== null}
        onOpenChange={(open) => { if (!open) setAddRecipeMealName(null); }}
        initialMealName={addRecipeMealName ?? ""}
        autoFocusRecipe
      />

      {/* Mobile: card list */}
      <div className="md:hidden">
        <MobileCardList meals={meals} onOpenLogForm={setAddRecipeMealName} />
      </div>

      {/* Desktop: sortable table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No meals logged yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
