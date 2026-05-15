import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Mobile TikTok embed. We wrap their official embed pattern in an
 * inline-HTML page and load it into a WebView. TikTok's
 * `embed.js` script does the heavy lifting (resolves the URL,
 * fetches the video manifest, renders the player).
 *
 * Height is fixed-ish — TikTok videos are 9:16 portrait, plus the
 * footer the embed adds. 580 covers most videos; longer captions
 * scroll inside the WebView.
 */
type Props = {
  url: string;
};

export function TikTokEmbed({ url }: Props) {
  // Escape the URL into the HTML safely — TikTok URLs contain `?`,
  // `@`, `/`, and digits, none of which break HTML attribute
  // contexts when double-quoted. Strip backslashes / quotes
  // defensively in case anything weird slipped through.
  const safeUrl = url.replace(/["\\]/g, "");
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <style>
      body { margin: 0; padding: 0; background: #000; }
      blockquote { margin: 0 !important; max-width: 100% !important; }
    </style>
  </head>
  <body>
    <blockquote class="tiktok-embed" cite="${safeUrl}" data-video-id="">
      <section></section>
    </blockquote>
    <script async src="https://www.tiktok.com/embed.js"></script>
  </body>
</html>`;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html, baseUrl: "https://www.tiktok.com/" }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction
        originWhitelist={["https://*", "about:*"]}
        onShouldStartLoadWithRequest={(request) => {
          // Block navigations away from TikTok's own assets so the
          // user doesn't accidentally leave the recipe page.
          if (request.url.startsWith("about:")) return true;
          if (request.url.startsWith("https://www.tiktok.com")) return true;
          if (request.url.startsWith("https://tiktok.com")) return true;
          if (request.url.startsWith("https://lf16-tiktok-")) return true;
          return false;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 580,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#000"
  },
  webview: {
    flex: 1,
    backgroundColor: "#000"
  }
});
