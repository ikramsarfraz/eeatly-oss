import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState
} from "expo-audio";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

/**
 * Round 15 Task 1 — voice recorder primitive used by the AI capture
 * sheet's Voice mode. Self-contained; the caller hands a single
 * callback and we hand back a local URI when the user confirms.
 *
 * Three internal states:
 *   - idle      — big primary "Record" button; permission requested on
 *                 first tap. Permanent denial deep-links Settings.
 *   - recording — timer counting up, Stop button, Cancel link. Auto-stop
 *                 at 5 minutes to match the backend's 25 MB cap
 *                 (`MAX_AUDIO_UPLOAD_BYTES` in validators/ai.ts — high-
 *                 quality m4a from `RecordingPresets.HIGH_QUALITY` runs
 *                 ~1.5 MB/min, so 5 min keeps us well under cap with a
 *                 cushion for unusual encoders).
 *   - preview   — playback bar + "Use this" + "Re-record" buttons.
 *
 * Uses `expo-audio` (SDK 54 ships v1.1.x; `expo-av` is deprecated).
 */

const MAX_DURATION_MS = 5 * 60 * 1000;

export type VoiceRecorderProps = {
  onRecorded: (localUri: string) => void;
  /** Disable the buttons (e.g. during upload kicked off after onRecorded). */
  disabled?: boolean;
};

type Phase =
  | { kind: "idle" }
  | { kind: "recording"; startMs: number }
  | { kind: "preview"; uri: string };

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceRecorder({ onRecorded, disabled }: VoiceRecorderProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [pending, setPending] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  // Auto-stop guard: when we cross MAX_DURATION_MS while still recording,
  // stop and surface a toast. The exact stop call still goes through
  // `stopRecording()` so the preview phase opens consistently.
  const autoStoppedRef = useRef(false);
  useEffect(() => {
    if (phase.kind !== "recording") {
      autoStoppedRef.current = false;
      return;
    }
    if (recorderState.durationMillis >= MAX_DURATION_MS && !autoStoppedRef.current) {
      autoStoppedRef.current = true;
      Alert.alert(
        "Voice notes max 5 minutes",
        "We stopped the recording at five minutes so it'll fit through the AI."
      );
      void stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorderState.durationMillis, phase.kind]);

  async function requestPermission(): Promise<boolean> {
    const current = await AudioModule.getRecordingPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain === false) {
      Alert.alert(
        "Microphone access needed",
        "eeatly needs microphone access to record a voice note. Open Settings?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Settings", onPress: () => Linking.openSettings() }
        ]
      );
      return false;
    }
    const next = await AudioModule.requestRecordingPermissionsAsync();
    if (!next.granted) {
      setPermissionError("Microphone permission denied.");
      return false;
    }
    return true;
  }

  async function startRecording() {
    if (disabled || pending) return;
    setPermissionError(null);
    setPending(true);
    try {
      const granted = await requestPermission();
      if (!granted) {
        setPending(false);
        return;
      }
      // Audio session config — needed on iOS so recording works while
      // the device is on silent. `allowsRecording: true` switches the
      // category to PlayAndRecord; without it the recorder yields zero
      // bytes on iPhone hardware in silent mode.
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase({ kind: "recording", startMs: Date.now() });
    } catch (e) {
      Alert.alert(
        "Couldn't start recording",
        e instanceof Error ? e.message : "Try again."
      );
    } finally {
      setPending(false);
    }
  }

  async function stopRecording() {
    if (pending) return;
    setPending(true);
    try {
      await recorder.stop();
      // The recorder's uri is the path to the produced file. iOS gives
      // an m4a; Android typically gives a 3gp or m4a depending on
      // RecordingPresets. The backend handles both via the existing R8
      // `SUPPORTED_AUDIO_MEDIA_TYPES` allowlist.
      const uri = recorder.uri;
      if (!uri) {
        Alert.alert("Recording empty", "We couldn't save that recording. Try again.");
        setPhase({ kind: "idle" });
        return;
      }
      setPhase({ kind: "preview", uri });
    } catch (e) {
      Alert.alert(
        "Couldn't stop recording",
        e instanceof Error ? e.message : "Try again."
      );
      setPhase({ kind: "idle" });
    } finally {
      setPending(false);
    }
  }

  function cancelRecording() {
    // Stop the recorder so it isn't left running; throw away the URI.
    void recorder.stop().catch(() => null);
    setPhase({ kind: "idle" });
  }

  function reRecord() {
    setPhase({ kind: "idle" });
  }

  function confirm(uri: string) {
    onRecorded(uri);
  }

  if (phase.kind === "idle") {
    return (
      <View style={styles.wrap}>
        <Text style={styles.body}>
          Record a voice note describing what you cooked or pasting from a
          family member's WhatsApp note.
        </Text>
        <Pressable
          onPress={startRecording}
          disabled={disabled || pending}
          style={({ pressed }) => [
            styles.recordButton,
            (disabled || pending) && styles.disabled,
            pressed && !disabled && !pending && styles.pressed
          ]}
          accessibilityRole="button"
        >
          {pending ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <>
              <Ionicons name="mic" size={36} color="#fff" />
              <Text style={styles.recordLabel}>Record</Text>
            </>
          )}
        </Pressable>
        {permissionError ? (
          <Text style={styles.error}>{permissionError}</Text>
        ) : null}
        <Text style={styles.hint}>
          Up to 5 minutes. Speak clearly — the AI handles English, Urdu,
          and most languages.
        </Text>
      </View>
    );
  }

  if (phase.kind === "recording") {
    return (
      <View style={styles.wrap}>
        <View style={styles.recordingDotRow}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingLabel}>Recording…</Text>
        </View>
        <Text style={styles.timer}>{formatMs(recorderState.durationMillis)}</Text>
        <Text style={styles.timerCap}>/ 5:00</Text>
        <Pressable
          onPress={stopRecording}
          disabled={pending}
          style={({ pressed }) => [
            styles.stopButton,
            pending && styles.disabled,
            pressed && !pending && styles.pressed
          ]}
          accessibilityRole="button"
        >
          {pending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="stop" size={20} color="#fff" />
              <Text style={styles.stopLabel}>Stop</Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={cancelRecording}
          hitSlop={6}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Text style={styles.cancelLink}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <PreviewView
      uri={phase.uri}
      onConfirm={() => confirm(phase.uri)}
      onReRecord={reRecord}
      disabled={disabled}
    />
  );
}

function PreviewView({
  uri,
  onConfirm,
  onReRecord,
  disabled
}: {
  uri: string;
  onConfirm: () => void;
  onReRecord: () => void;
  disabled?: boolean;
}) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  function togglePlay() {
    if (status.playing) {
      player.pause();
    } else {
      // Seek back to 0 if the player ran past the end, so a re-tap
      // restarts from the beginning rather than no-op'ing.
      if (status.duration > 0 && status.currentTime >= status.duration - 0.05) {
        player.seekTo(0);
      }
      player.play();
    }
  }

  const positionMs = (status.currentTime ?? 0) * 1000;
  const durationMs = (status.duration ?? 0) * 1000;

  return (
    <View style={styles.wrap}>
      <Text style={styles.previewHeading}>Listen back</Text>
      <View style={styles.playerCard}>
        <Pressable
          onPress={togglePlay}
          disabled={!status.isLoaded}
          style={({ pressed }) => [
            styles.playButton,
            !status.isLoaded && styles.disabled,
            pressed && status.isLoaded && styles.pressed
          ]}
          accessibilityRole="button"
          accessibilityLabel={status.playing ? "Pause playback" : "Play recording"}
        >
          {!status.isLoaded ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons
              name={status.playing ? "pause" : "play"}
              size={20}
              color="#fff"
            />
          )}
        </Pressable>
        <Text style={styles.playerTime}>
          {formatMs(positionMs)} / {formatMs(durationMs)}
        </Text>
      </View>
      <Pressable
        onPress={onConfirm}
        disabled={disabled}
        style={({ pressed }) => [
          styles.primaryCta,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed
        ]}
        accessibilityRole="button"
      >
        <Ionicons name="checkmark" size={20} color="#fff" />
        <Text style={styles.primaryCtaText}>Use this</Text>
      </Pressable>
      <Pressable
        onPress={onReRecord}
        hitSlop={6}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <Text style={styles.reRecordLink}>Re-record</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 12
  },
  body: {
    fontSize: 13,
    color: "#555",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 8
  },
  hint: {
    fontSize: 11,
    color: "#888",
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 12,
    marginTop: 4
  },
  recordButton: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: "#2f6f58",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  recordLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5
  },
  recordingDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#b91c1c"
  },
  recordingLabel: {
    fontSize: 13,
    color: "#b91c1c",
    fontWeight: "600",
    letterSpacing: 0.4
  },
  timer: {
    fontSize: 44,
    fontWeight: "300",
    color: "#111",
    fontVariant: ["tabular-nums"]
  },
  timerCap: {
    fontSize: 12,
    color: "#888",
    marginTop: -4
  },
  stopButton: {
    minHeight: 52,
    minWidth: 160,
    paddingHorizontal: 24,
    borderRadius: 28,
    backgroundColor: "#b91c1c",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8
  },
  stopLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600"
  },
  cancelLink: {
    color: "#666",
    fontSize: 14,
    marginTop: 4
  },
  previewHeading: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444"
  },
  playerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#eef5f1",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#cfe1d7",
    alignSelf: "stretch"
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2f6f58",
    alignItems: "center",
    justifyContent: "center"
  },
  playerTime: {
    fontSize: 14,
    color: "#1f4a3b",
    fontVariant: ["tabular-nums"]
  },
  primaryCta: {
    alignSelf: "stretch",
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "#2f6f58",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4
  },
  primaryCtaText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  },
  reRecordLink: {
    color: "#2f6f58",
    fontSize: 14,
    fontWeight: "500"
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  error: {
    color: "#b91c1c",
    fontSize: 12
  }
});
