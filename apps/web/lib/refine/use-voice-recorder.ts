"use client";

import * as React from "react";

/**
 * Round 22 — shared MediaRecorder hook.
 *
 * Lifted out of `components/forms/ai-suggest-dialog.tsx` (originally
 * R11) so the Refine composer can drive a recording flow with the
 * same browser-permission + state-machine semantics. The dialog now
 * also consumes this hook; behavior is preserved verbatim.
 *
 * State machine:
 *   idle      — no recording in progress, no captured blob ready.
 *   requesting — getUserMedia in flight.
 *   recording  — MediaRecorder running; `seconds` increments once/sec.
 *   ready      — stop()'d; `blob` + `url` are populated.
 *   denied     — permission rejected by the user or the OS.
 *   error      — recorder unsupported or some other failure.
 *
 * The hook owns the MediaRecorder instance, the mic stream, the
 * per-second timer, and the object URL for the captured blob; all
 * three are cleaned up on `reset()` or unmount so the browser's red
 * mic indicator goes away promptly.
 */
export type RecordingState =
  | "idle"
  | "requesting"
  | "recording"
  | "ready"
  | "denied"
  | "error";

export type UseVoiceRecorderReturn = {
  state: RecordingState;
  blob: Blob | null;
  url: string | null;
  seconds: number;
  supported: boolean;
  errorMessage: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
};

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = React.useState<RecordingState>("idle");
  const [blob, setBlob] = React.useState<Blob | null>(null);
  const [url, setUrl] = React.useState<string | null>(null);
  const [seconds, setSeconds] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<number | null>(null);
  const urlRef = React.useRef<string | null>(null);
  // Latest url tracked in a ref so cleanup callbacks (effect teardown,
  // stop handler) don't capture stale state. setUrl writes both.
  React.useEffect(() => {
    urlRef.current = url;
  }, [url]);

  const supported = React.useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.MediaRecorder !== "undefined",
    []
  );

  const cleanupTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = React.useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        // Already stopped — ignore.
      }
    }
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    chunksRef.current = [];
    cleanupTimer();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    setBlob(null);
    setUrl(null);
    setSeconds(0);
    setErrorMessage(null);
    setState("idle");
  }, [cleanupTimer]);

  React.useEffect(() => {
    // Run reset on unmount so a navigation mid-recording releases the
    // mic without waiting for GC.
    return () => {
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = React.useCallback(async () => {
    if (!supported) {
      setState("error");
      setErrorMessage(
        "Recording isn't supported in this browser. Try uploading a file instead."
      );
      return;
    }
    setErrorMessage(null);
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        // recorder.mimeType is the browser's chosen container — strip
        // codec params so the server-side validator sees a recognized
        // MIME ("audio/webm;codecs=opus" → "audio/webm").
        const rawMime = recorder.mimeType || "audio/webm";
        const cleanMime = rawMime.split(";")[0]?.trim() || "audio/webm";
        const captured = new Blob(chunksRef.current, { type: cleanMime });
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const nextUrl = URL.createObjectURL(captured);
        setBlob(captured);
        setUrl(nextUrl);
        setState("ready");
        stream.getTracks().forEach((t) => t.stop());
        cleanupTimer();
      });
      recorder.start();
      setState("recording");
      setSeconds(0);
      timerRef.current = window.setInterval(
        () => setSeconds((s) => s + 1),
        1000
      );
    } catch {
      // NotAllowedError, SecurityError, NotFoundError converge here.
      setState("denied");
      setErrorMessage(
        "We need microphone access to record. You can switch to upload mode instead."
      );
    }
  }, [supported, cleanupTimer]);

  const stop = React.useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  return {
    state,
    blob,
    url,
    seconds,
    supported,
    errorMessage,
    start,
    stop,
    reset
  };
}

/**
 * Convert a binary Blob to a Node-style base64 string suitable for a
 * tRPC procedure's JSON body. Shared between the AI-suggest dialog
 * and Refine voice submissions.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // btoa wants a binary string. Chunked at 32k chars to stay below
  // String.fromCharCode.apply's call-stack ceiling on large recordings.
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
