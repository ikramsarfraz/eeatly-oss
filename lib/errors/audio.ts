/**
 * Round 8 — typed errors for voice-note transcription + extraction. The
 * action layer translates each `.code` into a discriminated-union UI
 * state (see `actions/ai.ts:suggestFromAudioAction`); no provider-
 * specific error shape leaks into the UI.
 *
 * Whisper is the only transcription provider (no symmetry with the
 * text/vision OpenAI → Anthropic fallback). If Whisper fails, the
 * service throws `AudioTranscriptionFailedError` and the UI suggests
 * text/photo as an alternate input mode.
 */

export class AudioTooLargeError extends Error {
  readonly code = "AUDIO_TOO_LARGE" as const;
  constructor() {
    super("Audio file exceeds the 25 MB limit.");
    this.name = "AudioTooLargeError";
  }
}

export class AudioInvalidFormatError extends Error {
  readonly code = "AUDIO_INVALID_FORMAT" as const;
  constructor(mediaType?: string) {
    super(
      mediaType
        ? `Unsupported audio format: ${mediaType}.`
        : "Unsupported audio format."
    );
    this.name = "AudioInvalidFormatError";
  }
}

export class AudioTranscriptionFailedError extends Error {
  readonly code = "AUDIO_TRANSCRIPTION_FAILED" as const;
  constructor() {
    super("Couldn't transcribe that audio right now.");
    this.name = "AudioTranscriptionFailedError";
  }
}

export class AudioTooShortOrEmptyError extends Error {
  readonly code = "AUDIO_TOO_SHORT_OR_EMPTY" as const;
  constructor() {
    super("We couldn't hear a recipe in that audio.");
    this.name = "AudioTooShortOrEmptyError";
  }
}

export type AudioExtractionError =
  | AudioTooLargeError
  | AudioInvalidFormatError
  | AudioTranscriptionFailedError
  | AudioTooShortOrEmptyError;
