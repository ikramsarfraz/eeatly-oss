"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          Unable to load CookLoop
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm text-muted-foreground">
        <p>{error.message || "Check your auth and database configuration, then try again."}</p>
        {error.digest ? <p className="text-xs">Reference: {error.digest}</p> : null}
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
