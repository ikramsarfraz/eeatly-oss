import { format } from "date-fns";
import { Mail } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { loadAdmin } from "@/lib/auth/rls";
import {
  listEmailDeliveryLogsForAdmin,
  type EmailDeliveryAdminFilter
} from "@/services/email-delivery";

function parseDeliveryFilter(raw: unknown): EmailDeliveryAdminFilter {
  const value = typeof raw === "string" ? raw : "";
  if (value === "failed" || value === "bounced" || value === "opened" || value === "clicked") {
    return value;
  }
  return "all";
}

function filterHref(param: EmailDeliveryAdminFilter) {
  if (param === "all") return "/admin/emails";
  return `/admin/emails?filter=${param}`;
}

export default async function AdminEmailsPage(props: {
  searchParams?:
    | Promise<{ filter?: string }>
    | {
        filter?: string;
      };
}) {
  const sp = await Promise.resolve(props.searchParams ?? {});
  const filter = parseDeliveryFilter(sp.filter);

  const rows = await loadAdmin(() =>
    listEmailDeliveryLogsForAdmin({ filter, limit: 150 })
  );

  const chips: { label: string; value: EmailDeliveryAdminFilter }[] = [
    { label: "All", value: "all" },
    { label: "Failed / delayed / suppressed", value: "failed" },
    { label: "Bounced", value: "bounced" },
    { label: "Opened", value: "opened" },
    { label: "Clicked", value: "clicked" }
  ];

  return (
    <main id="main" tabIndex={-1} className="grid w-full gap-5 px-5 py-5">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Platform admin</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-normal">Email delivery</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Resend lifecycle rows merged from API sends plus Svix-signed webhooks. Correlate provider
          ids with <code className="text-[11px]">email_*</code> analytics events on the Analytics
          page.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <Button
            key={chip.value}
            asChild
            size="sm"
            variant={filter === chip.value ? "secondary" : "outline"}
          >
            <a href={filterHref(chip.value)}>{chip.label}</a>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Recent outbound email
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-background/60 p-6 text-sm text-muted-foreground">
              No delivery rows recorded yet — send mail through Resend, then replay webhooks.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Template / user id</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Last event</TableHead>
                  <TableHead>Message id</TableHead>
                  <TableHead className="min-w-[200px]">Failure</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline">{row.status}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div>{row.templateKey ?? "—"}</div>
                      <div className="text-muted-foreground">{row.userId ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm">{row.recipient}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                      {format(row.lastEventAt, "MMM d, yyyy h:mm a")}
                      <div className="font-mono text-[11px]">{row.lastProviderEventType}</div>
                    </TableCell>
                    <TableCell className="max-w-[200px] break-all font-mono text-[11px]">
                      {row.providerMessageId}
                    </TableCell>
                    <TableCell className="text-xs text-destructive">
                      {row.failureReason ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
