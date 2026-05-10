"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { cn } from "@/lib/utils";

type EventBarChartProps = {
  data: Array<{
    name: string;
    count: number;
  }>;
  heightClass?: string;
};

export function EventBarChart({ data, heightClass = "h-72" }: EventBarChartProps) {
  return (
    <div className={cn("w-full", heightClass)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" angle={-20} textAnchor="end" height={60} tickMargin={12} />
          <YAxis allowDecimals={false} width={32} />
          <Tooltip />
          <Bar dataKey="count" fill="var(--primary)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
