import * as ImageManipulator from "expo-image-manipulator";
import { API_BASE_URL } from "./api-base";
import { getSessionToken } from "./auth/session";

/**
 * Round 13 — photo upload primitive shared by manual logging (Task 3)
 * and AI capture (Task 4).
 *
 * Pipeline:
 *   1. Resize the photo to keep wire size under R2's 10 MB cap.
 *      Modern phone cameras emit ~12-30 MB heic/jpeg; we downscale
 *      the long edge to 2048px and re-encode JPEG @ 0.85 quality.
 *      Recipe-photo recognition doesn't need pixel-perfect detail,
 *      and a smaller upload means less waiting on slow kitchen Wi-Fi.
 *   2. Hit the existing `/api/uploads/presign` REST endpoint with a
 *      bearer token (R12 bearer plugin handles the auth). The same
 *      endpoint web uses; no mobile-specific server code needed.
 *   3. POST the file to R2 with the returned signed fields.
 *   4. Return the public URL the server prepared.
 *
 * The endpoint isn't a tRPC procedure on purpose — multipart bodies
 * don't ride well through tRPC's JSON link. R12 explicitly carved
 * out file uploads as REST-only.
 */
export type PhotoUploadResult = {
  publicUrl: string;
  key: string;
};

export class PhotoUploadError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "PhotoUploadError";
  }
}

const MAX_LONG_EDGE = 2048;
const PRESIGN_URL = `${API_BASE_URL}/api/uploads/presign`;

async function shrink(localUri: string): Promise<{ uri: string; mimeType: string }> {
  // `expo-image-manipulator` lazily inspects the source dimensions
  // when you pass an empty actions array, so we resize unconditionally
  // and let the library decide whether the long-edge clamp does
  // anything. JPEG output (heic → jpg conversion) keeps server-side
  // type assumptions simple — R2's content-type condition expects
  // `image/...`, and Better Auth's bucket policy treats `image/jpeg`
  // as the canonical kitchen-photo format.
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: MAX_LONG_EDGE } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );
  return { uri: result.uri, mimeType: "image/jpeg" };
}

async function getPresignedUpload(filename: string, contentType: string) {
  const token = await getSessionToken();
  const res = await fetch(PRESIGN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Origin: "eeatly://"
    },
    body: JSON.stringify({ filename, contentType })
  });
  if (!res.ok) {
    // 401 = bearer rejected, 429 = upload-presign rate limit, 503 = R2
    // not configured. Surface the server's user-facing message when
    // present so the UI can show it verbatim.
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new PhotoUploadError(
      body?.error ?? `Couldn't get an upload URL (${res.status}).`,
      res.status
    );
  }
  return (await res.json()) as {
    url: string;
    fields: Record<string, string>;
    publicUrl: string;
    key: string;
  };
}

async function uploadToR2(args: {
  uploadUrl: string;
  fields: Record<string, string>;
  fileUri: string;
  mimeType: string;
}): Promise<void> {
  // React Native's `FormData` accepts a `{ uri, name, type }` shape
  // for file fields — the bridge handles the local-path → multipart
  // streaming. `file` MUST be appended last per S3/R2 presigned-post
  // semantics (the policy fields are evaluated in order, with the
  // file content as the terminal part).
  const form = new FormData();
  for (const [name, value] of Object.entries(args.fields)) {
    form.append(name, value);
  }
  form.append("Content-Type", args.mimeType);
  // React Native's FormData accepts a `{ uri, name, type }` shape for
  // file fields — the bridge handles local-path → multipart streaming.
  // The DOM lib's type signature (Blob | File) rejects this at compile
  // time; the cast is a known RN quirk, not a runtime concern.
  form.append("file", {
    uri: args.fileUri,
    name: args.fields.key?.split("/").pop() ?? "photo.jpg",
    type: args.mimeType
  } as unknown as Blob);

  const res = await fetch(args.uploadUrl, {
    method: "POST",
    body: form as unknown as BodyInit
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new PhotoUploadError(
      `R2 rejected the upload (${res.status}). ${text.slice(0, 200)}`.trim(),
      res.status
    );
  }
}

/**
 * Take a local file URI from `expo-image-picker` and return a public
 * URL after upload. Caller decides what to do with the URL (attach to
 * a meal-log mutation, ship to `ai.suggestFromPhoto` as a fetch
 * target, etc).
 *
 * Throws `PhotoUploadError` with a user-facing message on failure.
 */
export async function uploadPhoto(localUri: string): Promise<PhotoUploadResult> {
  const { uri, mimeType } = await shrink(localUri);
  const filename = uri.split("/").pop() ?? `photo-${Date.now()}.jpg`;
  const presigned = await getPresignedUpload(filename, mimeType);
  await uploadToR2({
    uploadUrl: presigned.url,
    fields: presigned.fields,
    fileUri: uri,
    mimeType
  });
  return { publicUrl: presigned.publicUrl, key: presigned.key };
}
