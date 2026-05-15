import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Renders a server-component card with a direct anchor download. We don't
 * stream through a server action because the response is large + binary-
 * adjacent and actions are JSON-oriented; the API route handles the CSV
 * transport properly.
 */
export function ExportDataCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Export your data</CardTitle>
        <CardDescription>
          Download your meal history as a CSV. Includes everything you&apos;ve
          logged: meal names, dates, effort, notes, and recipes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Native anchor with `download` attribute — server sets
            Content-Disposition; the browser respects the suggested filename. */}
        <Button asChild variant="outline">
          <a href="/api/account/export" download>
            <Download className="h-4 w-4" />
            Download meal history (CSV)
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
