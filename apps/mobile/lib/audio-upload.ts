import { File } from "expo-file-system";

/**
 * Round 15 Task 2 — read a local audio URI into the shape the
 * `ai.suggestFromVoice` tRPC procedure expects: `{ audioBase64,
 * mediaType, fileName }`.
 *
 * The AI procedure intentionally inlines the audio bytes (base64-in-
 * JSON) rather than going through the R2 presign + POST flow that
 * persisted photos use. From the R11 router comment:
 *
 *   > For AI suggests the binary IS the input, and ferrying it through
 *   > R2 + a key would mean orphan uploads when the user doesn't save
 *   > the meal.
 *
 * The handoff suggested "upload to R2 first, then call the procedure
 * with the URI" — that contradicts the procedure's actual input shape
 * (`audioBase64`, not `url`). I followed the procedure's signature.
 *
 * Size guard: backend enforces a 25 MB raw cap (`MAX_AUDIO_UPLOAD_BYTES`
 * in `validators/ai.ts`). We pre-check on-device so a too-large file
 * surfaces "voice notes can't exceed 25 MB" instead of a generic
 * AUDIO_TOO_LARGE round-trip. The 5-minute recording cap (R15 Task 1)
 * keeps recordings well under this; the cap matters more for the
 * upload-from-gallery path where the user could pick a long WhatsApp
 * voice note.
 */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * Maps file extensions to the MIME types the server's audio validator
 * accepts (see `SUPPORTED_AUDIO_MEDIA_TYPES` in `validators/ai.ts`).
 * Unknown extensions fall back to `audio/mp4` since the recorder's
 * HIGH_QUALITY preset emits m4a on both iOS and Android.
 */
const EXT_TO_MEDIA_TYPE: Record<string, string> = {
  m4a: "audio/m4a",
  mp4: "audio/mp4",
  mp3: "audio/mp3",
  mpeg: "audio/mpeg",
  mpga: "audio/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/opus",
  wav: "audio/wav",
  webm: "audio/webm",
  flac: "audio/flac"
};

function pickMediaType(uri: string, hint?: string | null): string {
  if (hint) {
    const lower = hint.toLowerCase();
    if (
      lower.startsWith("audio/") &&
      lower !== "audio/x-m4a" &&
      lower !== "audio/x-wav"
    ) {
      return lower;
    }
    if (lower === "audio/x-m4a") return "audio/m4a";
    if (lower === "audio/x-wav") return "audio/wav";
  }
  const ext = uri.split(".").pop()?.toLowerCase().split("?")[0] ?? "";
  return EXT_TO_MEDIA_TYPE[ext] ?? "audio/mp4";
}

function pickFileName(uri: string): string {
  const tail = uri.split("/").pop() ?? `voice-${Date.now()}.m4a`;
  return tail.split("?")[0] ?? tail;
}

export class AudioReadError extends Error {
  constructor(
    message: string,
    readonly reason: "TOO_LARGE" | "READ_FAILED"
  ) {
    super(message);
    this.name = "AudioReadError";
  }
}

export type AudioInputBundle = {
  audioBase64: string;
  mediaType: string;
  fileName: string;
  sizeBytes: number;
};

/**
 * Read a local audio file URI and return the payload shape the tRPC AI
 * procedure expects. Throws `AudioReadError` with a friendly reason.
 *
 *   @param uri        Local file URI (file:/// scheme).
 *   @param mimeHint   Optional MIME from expo-document-picker.
 */
export async function readAudioForAi(
  uri: string,
  mimeHint?: string | null
): Promise<AudioInputBundle> {
  const file = new File(uri);
  if (!file.exists) {
    throw new AudioReadError("That voice note couldn't be opened.", "READ_FAILED");
  }
  const size = file.size ?? 0;
  if (size === 0) {
    throw new AudioReadError(
      "That voice note is empty. Try recording again.",
      "READ_FAILED"
    );
  }
  if (size > MAX_AUDIO_BYTES) {
    throw new AudioReadError(
      "Voice notes can't be larger than 25 MB. Try a shorter clip.",
      "TOO_LARGE"
    );
  }
  let audioBase64: string;
  try {
    audioBase64 = await file.base64();
  } catch {
    throw new AudioReadError("Couldn't read the voice note bytes.", "READ_FAILED");
  }
  return {
    audioBase64,
    mediaType: pickMediaType(uri, mimeHint),
    fileName: pickFileName(uri),
    sizeBytes: size
  };
}
