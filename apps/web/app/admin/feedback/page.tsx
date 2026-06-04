import { format } from "date-fns";
import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { listBetaFeedback } from "@/services/feedback";
import { FeedbackReplyDialog } from "@/components/admin/feedback-reply-dialog";

const typeLabels = {
  bug: "Bug",
  confusion: "Confusion",
  feature_request: "Feature request",
  general: "General"
};

export default async function AdminFeedbackPage() {
  await requirePlatformAdmin();
  const feedback = await listBetaFeedback();

  return (
    <main id="main" tabIndex={-1} className="mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Platform admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Beta feedback</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Recent feedback from authenticated beta users.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Feedback inbox
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feedback.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-background/60 p-6 text-sm text-muted-foreground">
              No feedback has been submitted yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedback.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">{item.userEmail}</TableCell>
                    <TableCell className="whitespace-nowrap">{typeLabels[item.type]}</TableCell>
                    <TableCell className="min-w-80 max-w-xl">
                      <p className="line-clamp-3">{item.message}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {item.context ?? "No context"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(item.createdAt, "MMM d, yyyy h:mm a")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <FeedbackReplyDialog
                        feedbackId={item.id}
                        recipientEmail={item.userEmail}
                        originalMessage={item.message}
                      />
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
