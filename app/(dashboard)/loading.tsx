import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="grid gap-4 rounded-2xl border bg-card p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full max-w-lg" />
          <Skeleton className="h-16 w-full max-w-2xl" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        </div>
        <div className="grid gap-4 rounded-xl border bg-card p-5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-24" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
