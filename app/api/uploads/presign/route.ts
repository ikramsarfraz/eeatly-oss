import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { createPresignedPhotoUpload } from "@/lib/storage/r2";
import { presignedUploadInputSchema } from "@/lib/validators/meals";

export async function POST(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Photo uploads are not configured yet."
      },
      { status: 501 }
    );
  }
}
