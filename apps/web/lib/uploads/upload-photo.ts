import { endpoints, type PresignUploadResponse } from "@/lib/api/endpoints";

/**
 * Upload a user-selected photo to R2 via the presigned-POST flow and return
 * its public URL.
 *
 * Shared by the meal-log form (set a photo at cook time) and the recipe
 * view's "Add / Change photo" affordance (set a meal's own photo later).
 * The two-step shape is mandated by R2/S3 presigned POST: ask the server
 * for a policy, then POST the file straight to the bucket with the file
 * field appended last.
 */
export async function uploadPhoto(file: File): Promise<string> {
  const presignResponse = await fetch(endpoints.uploads.presign(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type
    })
  });

  if (!presignResponse.ok) {
    const error = (await presignResponse.json()) as { error?: string };
    throw new Error(error.error ?? "Photo upload is not available yet.");
  }

  const { url, fields, publicUrl } = (await presignResponse.json()) as PresignUploadResponse;

  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    formData.append(name, value);
  }
  // Content-Type must be an explicit field to satisfy the policy condition.
  // The file must be appended last — S3/R2 presigned POST requires it.
  formData.append("Content-Type", file.type);
  formData.append("file", file);

  const uploadResponse = await fetch(url, {
    method: "POST",
    body: formData
  });

  if (!uploadResponse.ok) {
    throw new Error("Unable to upload photo.");
  }

  return publicUrl;
}
