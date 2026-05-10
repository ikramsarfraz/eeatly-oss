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
import { ArrowUpDown } from "lucide-react";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import type { RecentMeal } from "@/types";

const columns: ColumnDef<RecentMeal>[] = [
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
    cell: ({ row }) => row.original.effortLevel.replace("_", " ")
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
      <LogAgainButton
        mealName={row.original.mealName}
        effortLevel={row.original.effortLevel}
        variant="ghost"
      />
    )
  }
];

export function HistoryTable({ meals }: { meals: RecentMeal[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "cookedAt", desc: true }
  ]);
  const table = useReactTable({
    data: meals,
    columns,
    state: {
      sorting
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
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
  );
}
