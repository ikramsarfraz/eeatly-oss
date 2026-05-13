import "server-only";

import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { randomUUID } from "node:crypto";
import { getServerEnv, hasR2Env } from "@/lib/env/server";
import type { PresignedUploadInput } from "@/lib/validators/meals";

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
