import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { PhotoUploadError, uploadPhoto } from "../lib/photo-upload";

/**
 * Round 13 — photo picker primitive. Used by Task 3 (manual meal log)
 * and Task 4 (AI capture). Self-contained: handles permissions,
 * camera-vs-library choice, upload to R2, error states.
 *
 * The component renders different surfaces depending on `value`:
 *   - no photo → "Add a photo" CTA tile (≥80px tap target)
 *   - uploading → preview + spinner overlay
 *   - photo present → preview + "Change" + "Remove" actions
 *
 * Calling `onChange(url)` with a publicUrl signals upload success.
 * Calling `onChange(null)` clears the value.
 */
export type PhotoPickerProps = {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Force-disable interactions, e.g. during form submission. */
  disabled?: boolean;
};

type SheetState =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "uploading"; previewUri: string };

export function PhotoPicker({ value, onChange, disabled }: PhotoPickerProps) {
  const [sheet, setSheet] = useState<SheetState>({ kind: "closed" });
  const [error, setError] = useState<string | null>(null);

  function openSheet() {
    if (disabled || sheet.kind === "uploading") return;
    setError(null);
    setSheet({ kind: "open" });
  }

  function closeSheet() {
    if (sheet.kind === "uploading") return;
    setSheet({ kind: "closed" });
  }

  async function withPicker(
    request: () => Promise<ImagePicker.PermissionResponse>,
    launch: () => Promise<ImagePicker.ImagePickerResult>,
    permissionName: "Camera" | "Photo library"
  ) {
    const perm = await request();
    if (!perm.granted) {
      if (perm.canAskAgain === false) {
        // iOS / Android: user permanently denied. Offer to deep-link
        // into the app's system settings so they can change it.
        Alert.alert(
          `${permissionName} access needed`,
          `eeatly needs ${permissionName.toLowerCase()} access to attach photos. Open Settings?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Settings", onPress: () => Linking.openSettings() }
          ]
        );
      } else {
        setError(`${permissionName} permission denied.`);
      }
      setSheet({ kind: "closed" });
      return;
    }

    const result = await launch();
    if (result.canceled || !result.assets[0]) {
      setSheet({ kind: "closed" });
      return;
    }
    const asset = result.assets[0];
    setSheet({ kind: "uploading", previewUri: asset.uri });

    try {
      const { publicUrl } = await uploadPhoto(asset.uri);
      onChange(publicUrl);
      setSheet({ kind: "closed" });
    } catch (e) {
      const message =
        e instanceof PhotoUploadError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Couldn't upload that photo. Try again.";
      setError(message);
      setSheet({ kind: "closed" });
    }
  }

  function takePhoto() {
    return withPicker(
      ImagePicker.requestCameraPermissionsAsync,
      () =>
        ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          allowsEditing: false,
          quality: 1
        }),
      "Camera"
    );
  }

  function pickFromLibrary() {
    return withPicker(
      ImagePicker.requestMediaLibraryPermissionsAsync,
      () =>
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          allowsEditing: false,
          quality: 1
        }),
      "Photo library"
    );
  }

  const uploading = sheet.kind === "uploading";

  return (
    <View>
      {value || uploading ? (
        <View style={styles.previewWrap}>
          <Image
            source={{ uri: uploading ? sheet.previewUri : value! }}
            style={styles.preview}
            resizeMode="cover"
          />
          {uploading ? (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.uploadingText}>Uploading…</Text>
            </View>
          ) : null}
          {!uploading && !disabled ? (
            <View style={styles.previewActions}>
              <Pressable
                onPress={openSheet}
                style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
              >
                <Text style={styles.actionText}>Change</Text>
              </Pressable>
              <Pressable
                onPress={() => onChange(null)}
                style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
              >
                <Text style={[styles.actionText, styles.destructive]}>Remove</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : (
        <Pressable
          onPress={openSheet}
          disabled={disabled}
          style={({ pressed }) => [
            styles.addTile,
            pressed && styles.pressed,
            disabled && styles.disabled
          ]}
        >
          <Ionicons name="image-outline" size={28} color="#666" />
          <Text style={styles.addLabel}>Add a photo</Text>
          <Text style={styles.addHint}>Optional — camera or library</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal
        visible={sheet.kind === "open"}
        transparent
        animationType="fade"
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.backdrop} onPress={closeSheet}>
          <Pressable style={styles.sheet} onPress={() => null}>
            <Text style={styles.sheetTitle}>Add a photo</Text>
            <SheetOption icon="camera-outline" label="Take photo" onPress={takePhoto} />
            <SheetOption icon="images-outline" label="Choose from library" onPress={pickFromLibrary} />
            <SheetOption icon="close-outline" label="Cancel" onPress={closeSheet} variant="cancel" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SheetOption({
  icon,
  label,
  onPress,
  variant = "default"
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  variant?: "default" | "cancel";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sheetOption,
        pressed && styles.pressed,
        variant === "cancel" && styles.sheetCancel
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={variant === "cancel" ? "#888" : "#2f6f58"}
      />
      <Text
        style={[
          styles.sheetOptionLabel,
          variant === "cancel" && styles.sheetCancelLabel
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  previewWrap: {
    position: "relative"
  },
  preview: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 12,
    backgroundColor: "#eaeae3"
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  uploadingText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500"
  },
  previewActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    minHeight: 44,
    justifyContent: "center"
  },
  actionText: {
    color: "#2f6f58",
    fontSize: 14,
    fontWeight: "500"
  },
  destructive: {
    color: "#b91c1c"
  },
  pressed: {
    opacity: 0.7
  },
  disabled: {
    opacity: 0.5
  },
  addTile: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d4d2cb",
    borderStyle: "dashed",
    backgroundColor: "#fbfaf6",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 6
  },
  addLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#444"
  },
  addHint: {
    fontSize: 12,
    color: "#888"
  },
  error: {
    marginTop: 8,
    color: "#b91c1c",
    fontSize: 13
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: "#fff",
    paddingTop: 12,
    paddingBottom: 36,
    paddingHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 4
  },
  sheetTitle: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    paddingVertical: 8
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 8,
    minHeight: 56
  },
  sheetOptionLabel: {
    fontSize: 16,
    color: "#111",
    fontWeight: "500"
  },
  sheetCancel: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc",
    borderRadius: 0,
    paddingTop: 14
  },
  sheetCancelLabel: {
    color: "#666",
    fontWeight: "400"
  }
});
