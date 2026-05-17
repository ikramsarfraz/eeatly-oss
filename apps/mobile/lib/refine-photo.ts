import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { Alert } from "react-native";

/**
 * Round 20 — photo capture for Refine recipe.
 *
 * `submitPhotoTurn` (R18) takes `imageBase64 + mediaType` inline in the
 * JSON body — the same trade-off the existing AI procedures use
 * (validators/ai.ts comment: "the binary IS the input, ferrying through
 * R2 means orphan uploads when the user doesn't save"). So Refine's
 * photo path is camera/library → shrink → read base64, NOT the R2
 * presign-and-POST flow `photo-upload.ts` uses for persisted meal
 * photos.
 *
 * Pipeline:
 *   1. Request permission (camera or library) and surface a friendly
 *      Settings deep-link on permanent denial.
 *   2. Launch the picker.
 *   3. Shrink the chosen asset to keep wire size under the validator's
 *      15 MB base64 ceiling (≈ 11 MB raw). 2048 long edge @ 0.85
 *      quality JPEG matches the photo-upload primitive and produces
 *      files in the 200-600 KB range for typical phone-camera shots.
 *   4. Read the file's base64 + return the bundle.
 *
 * Returns `null` when the user cancels or permission is denied — caller
 * decides whether to show a re-prompt.
 */

const MAX_LONG_EDGE = 2048;

/** Validator (`submitPhotoTurnInputSchema`) caps base64 at 15 MB. We
 *  pre-check on-device so a too-large file surfaces a friendly message
 *  instead of a generic BAD_REQUEST round-trip. */
export const MAX_REFINE_PHOTO_BASE64_BYTES = 15 * 1024 * 1024;

export class RefinePhotoError extends Error {
  constructor(
    message: string,
    readonly reason:
      | "PERMISSION_DENIED"
      | "TOO_LARGE"
      | "READ_FAILED"
      | "UNSUPPORTED"
  ) {
    super(message);
    this.name = "RefinePhotoError";
  }
}

export type RefinePhotoBundle = {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  /** Local URI of the *shrunken* image — useful for an in-line preview
   *  while the AI proposal is in flight. */
  previewUri: string;
  sizeBytes: number;
};

export type RefinePhotoSource = "camera" | "library";

async function requestPermission(
  source: RefinePhotoSource
): Promise<boolean> {
  const request =
    source === "camera"
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
  const perm = await request();
  if (perm.granted) return true;
  const label = source === "camera" ? "Camera" : "Photo library";
  if (perm.canAskAgain === false) {
    Alert.alert(
      `${label} access needed`,
      `eeatly needs ${label.toLowerCase()} access to refine from a photo. Open Settings?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Settings", onPress: () => Linking.openSettings() }
      ]
    );
  }
  return false;
}

async function launchPicker(
  source: RefinePhotoSource
): Promise<ImagePicker.ImagePickerResult> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: "images",
    allowsEditing: false,
    quality: 1
  };
  if (source === "camera") {
    return ImagePicker.launchCameraAsync(options);
  }
  return ImagePicker.launchImageLibraryAsync(options);
}

/**
 * Shrink the picked asset and read it as base64.
 *
 * Always re-encodes to JPEG. The validator's media-type enum also
 * accepts PNG / GIF / WEBP, but Refine doesn't gain anything from
 * preserving the source format — phone cameras emit HEIC/JPEG and the
 * AI's vision pass handles JPEG fine. JPEG keeps the wire size small.
 */
async function processAsset(uri: string): Promise<RefinePhotoBundle> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_LONG_EDGE } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );

  const file = new File(manipulated.uri);
  if (!file.exists) {
    throw new RefinePhotoError(
      "Couldn't read that photo. Try a different one.",
      "READ_FAILED"
    );
  }
  let imageBase64: string;
  try {
    imageBase64 = await file.base64();
  } catch {
    throw new RefinePhotoError(
      "Couldn't read that photo's bytes. Try again.",
      "READ_FAILED"
    );
  }
  const sizeBytes = imageBase64.length;
  if (sizeBytes > MAX_REFINE_PHOTO_BASE64_BYTES) {
    throw new RefinePhotoError(
      "That photo is too large after compression. Try a different one.",
      "TOO_LARGE"
    );
  }
  return {
    imageBase64,
    mediaType: "image/jpeg",
    previewUri: manipulated.uri,
    sizeBytes
  };
}

/**
 * Top-level entry point — handles permission, picker launch, shrink,
 * and base64 encode. Returns `null` for user cancel or permission
 * denial (both are non-error UX paths the caller silently accepts).
 * Throws `RefinePhotoError` for everything else.
 */
export async function pickRefinePhoto(
  source: RefinePhotoSource
): Promise<RefinePhotoBundle | null> {
  const granted = await requestPermission(source);
  if (!granted) return null;
  const result = await launchPicker(source);
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return processAsset(asset.uri);
}
