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
  Text,
  View
} from "react-native";
import { PhotoUploadError, uploadPhoto } from "../lib/photo-upload";

/**
 * Round 13 — photo picker primitive. Used by the meal log form and
 * the AI capture review path. Self-contained: handles permissions,
 * camera-vs-library choice, upload to R2, error states.
 *
 * Round 17 — restyled with NativeWind tokens. Three surfaces:
 *   - no photo → dashed border tile with icon + "Add a photo" CTA
 *   - uploading → preview with overlay spinner
 *   - photo present → preview + Change / Remove actions
 *
 * Calling `onChange(url)` with a publicUrl signals upload success.
 * Calling `onChange(null)` clears the value.
 */
export type PhotoPickerProps = {
  value: string | null;
  onChange: (url: string | null) => void;
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
        <View className="relative">
          <Image
            source={{ uri: uploading ? sheet.previewUri : value! }}
            className="w-full aspect-[4/3] rounded-md bg-background-muted"
            resizeMode="cover"
          />
          {uploading ? (
            <View className="absolute inset-0 items-center justify-center rounded-md bg-foreground/40 gap-2">
              <ActivityIndicator color="#FBF8F1" />
              <Text className="text-caption text-primary-foreground font-semibold">
                Uploading…
              </Text>
            </View>
          ) : null}
          {!uploading && !disabled ? (
            <View className="flex-row gap-3 mt-2">
              <Pressable
                onPress={openSheet}
                className="px-3 py-2 rounded-sm active:opacity-70 min-h-[44px] justify-center"
              >
                <Text className="text-caption-strong font-semibold text-primary">
                  Change
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onChange(null)}
                className="px-3 py-2 rounded-sm active:opacity-70 min-h-[44px] justify-center"
              >
                <Text className="text-caption-strong font-semibold text-destructive">
                  Remove
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : (
        <Pressable
          onPress={openSheet}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Add a photo"
          className={`h-[180px] rounded-lg border border-dashed border-border dark:border-border-dark bg-cream-soft dark:bg-cream-soft-dark items-center justify-center px-4 py-4 active:opacity-70 ${
            disabled ? "opacity-50" : ""
          }`}
        >
          <Ionicons name="image-outline" size={28} color="#2E5739" />
          <Text className="font-body-semibold text-body-lg text-ink dark:text-ink-dark mt-2">
            Add a photo
          </Text>
          <Text
            className="font-mono text-eyebrow text-ink-3 dark:text-ink-3-dark uppercase mt-1"
            style={{ letterSpacing: 0.6 }}
          >
            Camera or library
          </Text>
        </Pressable>
      )}

      {error ? (
        <Text className="text-caption text-destructive mt-2">{error}</Text>
      ) : null}

      <Modal
        visible={sheet.kind === "open"}
        transparent
        animationType="fade"
        onRequestClose={closeSheet}
      >
        <Pressable
          className="flex-1 bg-foreground/40 justify-end"
          onPress={closeSheet}
        >
          <Pressable
            onPress={() => null}
            className="bg-background-elevated rounded-t-lg pt-3 pb-9 px-4 gap-1"
          >
            <Text className="text-caption text-foreground-muted text-center py-2">
              Add a photo
            </Text>
            <SheetOption
              icon="camera-outline"
              label="Take photo"
              onPress={takePhoto}
            />
            <SheetOption
              icon="images-outline"
              label="Choose from library"
              onPress={pickFromLibrary}
            />
            <SheetOption
              icon="close-outline"
              label="Cancel"
              onPress={closeSheet}
              variant="cancel"
            />
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
      className={`flex-row items-center gap-3.5 px-2 py-3.5 rounded-sm min-h-[56px] active:opacity-70 ${
        variant === "cancel" ? "mt-1 border-t border-border dark:border-border-dark" : ""
      }`}
    >
      <Ionicons
        name={icon}
        size={22}
        color={variant === "cancel" ? "#6B7068" : "#2C5F3F"}
      />
      <Text
        className={`text-body ${
          variant === "cancel"
            ? "text-foreground-muted"
            : "text-foreground font-semibold"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
