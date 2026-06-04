import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";
import { checkUploadPresignLimit } from "@/lib/security/rate-limit";
import { createPresignedPhotoUpload } from "@/lib/storage/r2";
import { presignedUploadInputSchema } from "@eeatly/api/validators/meals";

export async function POST(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await checkUploadPresignLimit(user.id);
  } catch {
    return NextResponse.json(
      { error: "Too many upload requests. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const parsed = presignedUploadInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid upload request.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const upload = await createPresignedPhotoUpload(parsed.data, user.id);
    return NextResponse.json(upload);
  } catch (error) {
    // Log internal detail server-side; return a generic message to the client.
    logger.error("upload_presign_failed", {
      requestId: (await getRequestId()) ?? undefined,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: "Photo uploads are temporarily unavailable." },
      { status: 503 }
    );
  }
}
