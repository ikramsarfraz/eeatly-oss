import { useFonts } from "expo-font";
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic
} from "@expo-google-fonts/instrument-serif";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold
} from "@expo-google-fonts/geist";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold
} from "@expo-google-fonts/jetbrains-mono";

/**
 * Round 18 — load the three editorial families before the app renders.
 *
 * Registered family names match the constants in `lib/design/tokens.ts`
 * and the tokens consumed by `tailwind.config.js`. iOS can't synthesize
 * weights from a single family, so each weight ships its own font file
 * and registers under its own PostScript name.
 *
 * Returns `[loaded]` matching expo-font's tuple; the caller is
 * responsible for showing a splash / fallback until `loaded === true`.
 */
export function useAppFonts(): [boolean] {
  const [loaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold
  });
  return [loaded];
}
