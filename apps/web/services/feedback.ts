import "server-only";

import { desc, eq } from "drizzle-orm";
import { betaFeedback, users } from "@/db/schema";
import { db } from "@/lib/db/client";
import { feedbackInputSchema, type FeedbackInput } from "@eeatly/api/validators/feedback";

export async function createBetaFeedback(userId: string, input: FeedbackInput) {
  const payload = feedbackInputSchema.parse(input);
  const [feedback] = await db
    .insert(betaFeedback)
    .values({
      userId,
      type: payload.type,
      message: payload.message,
      context: payload.context || null,
      updatedAt: new Date()
    })
    .returning({
      id: betaFeedback.id,
      type: betaFeedback.type,
      createdAt: betaFeedback.createdAt
    });

  return feedback;
}

/**
 * Resolve the cook who submitted a feedback row, for admin reply-by-email.
 * Returns `null` when the feedback id is unknown so the caller can 404.
 */
export async function getFeedbackRecipient(feedbackId: string) {
  const [row] = await db
    .select({
      feedbackId: betaFeedback.id,
      userId: betaFeedback.userId,
      email: users.email,
      name: users.name,
      originalMessage: betaFeedback.message
    })
    .from(betaFeedback)
    .innerJoin(users, eq(betaFeedback.userId, users.id))
    .where(eq(betaFeedback.id, feedbackId))
    .limit(1);

  return row ?? null;
}

export async function listBetaFeedback() {
  return db
    .select({
      id: betaFeedback.id,
      type: betaFeedback.type,
      message: betaFeedback.message,
      context: betaFeedback.context,
      createdAt: betaFeedback.createdAt,
      userEmail: users.email
    })
    .from(betaFeedback)
    .innerJoin(users, eq(betaFeedback.userId, users.id))
    .orderBy(desc(betaFeedback.createdAt))
    .limit(100);
}
