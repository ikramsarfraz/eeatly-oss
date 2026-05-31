import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { createHash, randomUUID } from "node:crypto";
import { getServerEnv, hasR2Env } from "@/lib/env/server";
import type { PresignedUploadInput } from "@eeatly/api/validators/meals";

export type PresignedUpload = {
  url: string;
  fields: Record<string, string>;
  publicUrl: string;
  key: string;
};

function getR2Client() {
  const env = getServerEnv();

  if (!hasR2Env(env)) {
    throw new Error("Cloudflare R2 is not configured yet.");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!
    }
  });
}

export async function createPresignedPhotoUpload(
  input: PresignedUploadInput,
  userId: string
): Promise<PresignedUpload> {
  const env = getServerEnv();

  if (!hasR2Env(env)) {
    throw new Error("Cloudflare R2 is not configured yet.");
  }

  const extension = input.filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const key = `users/${userId}/meal-photos/${randomUUID()}.${extension}`;

  const { url, fields } = await createPresignedPost(getR2Client(), {
    Bucket: env.R2_BUCKET!,
    Key: key,
    Conditions: [
      ["content-length-range", 1, 10 * 1024 * 1024],
      ["starts-with", "$Content-Type", "image/"]
    ],
    Expires: 60
  });

  const publicUrl = `${env.R2_PUBLIC_BASE_URL!.replace(/\/$/, "")}/${key}`;

  return { url, fields, publicUrl, key };
}

/**
 * Server-side upload of an AI-generated dish image to R2.
 *
 * Unlike `createPresignedPhotoUpload` (which hands the browser a presigned
 * POST for user-supplied photos), this path PUTs bytes we already hold in
 * memory — the base64 image OpenAI returns. There's no per-user prefix: the
 * image is shared app-wide, keyed deterministically off the normalized dish
 * name so the same dish always maps to the same object. Re-generating a dish
 * overwrites the same key rather than orphaning the old object.
 *
 * Returns the public URL. Callers must confirm R2 is configured before
 * invoking — the dish-image service short-circuits to the monogram fallback
 * when it isn't, so this throws (rather than silently no-oping) if reached
 * without credentials.
 */
export async function uploadDishImage(
  normalizedName: string,
  bytes: Buffer,
  contentType: string
): Promise<string> {
  const env = getServerEnv();

  if (!hasR2Env(env)) {
    throw new Error("Cloudflare R2 is not configured yet.");
  }

  // sha256 of the normalized name → a stable, filesystem-safe key. We
  // slice to 32 hex chars (128 bits) — collision-free at any realistic
  // dish-catalog size, and shorter keys keep the bucket listing tidy.
  const hash = createHash("sha256").update(normalizedName).digest("hex").slice(0, 32);
  const key = `dish-images/${hash}.png`;

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      // Generated images are immutable per key (a regeneration writes a
      // new key only if the name changes), so let the CDN cache hard.
      CacheControl: "public, max-age=31536000, immutable"
    })
  );

  return `${env.R2_PUBLIC_BASE_URL!.replace(/\/$/, "")}/${key}`;
}
