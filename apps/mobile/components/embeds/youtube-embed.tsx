import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Mobile YouTube embed via the privacy-preserving `youtube-nocookie.com`
 * iframe host, rendered inside a `react-native-webview`. Fixed 16:9
 * container so the player sizes correctly inside a vertically-scrolling
 * recipe view.
 *
 * We don't add `react-native-youtube-iframe` — it would be a second
 * dependency on top of WebView (it wraps WebView itself), and we get
 * the same playback by pointing WebView at the iframe URL directly.
 * Documented in the R16 report.
 *
 * The WebView's `originWhitelist` accepts both the `https://*` form
 * (so the iframe can navigate / fetch its dependencies) and `about:*`
 * (so the loading splash doesn't get blocked).
 */
type Props = {
  videoId: string;
};

export function YouTubeEmbed({ videoId }: Props) {
  const source = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?playsinline=1`;
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: source }}
        style={styles.webview}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction
        originWhitelist={["https://*", "about:*"]}
        // Don't open any user navigation in the embedded WebView —
        // tapping the YouTube logo would otherwise pull the user out
        // of the recipe page. Returning false stops the load; the
        // outer recipe view always exposes a "View on YouTube" link
        // for users who want to leave the app.
        onShouldStartLoadWithRequest={(request) => {
          if (request.url.startsWith(source)) return true;
          if (request.url.startsWith("https://www.youtube-nocookie.com")) return true;
          if (request.url.startsWith("https://www.youtube.com/embed")) return true;
          return false;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#000"
  },
  webview: {
    flex: 1,
    backgroundColor: "#000"
  }
});
