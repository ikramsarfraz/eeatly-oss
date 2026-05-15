import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Mobile Pinterest pin embed. Same approach as the TikTok embed:
 * wrap Pinterest's official `embedPin` widget pattern in an inline
 * HTML page, load via WebView, let their `pinit.js` script render
 * the pin.
 *
 * Pinterest pins are usually portrait (taller than wide). Height
 * 500 fits most without scrolling; the embed itself is fluid inside.
 */
type Props = {
  url: string;
};

export function PinterestEmbed({ url }: Props) {
  const safeUrl = url.replace(/["\\]/g, "");
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <style>
      body { margin: 0; padding: 12px; background: #fff; display: flex; justify-content: center; }
    </style>
  </head>
  <body>
    <a data-pin-do="embedPin" data-pin-width="medium" href="${safeUrl}"></a>
    <script async defer src="//assets.pinterest.com/js/pinit.js"></script>
  </body>
</html>`;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html, baseUrl: "https://www.pinterest.com/" }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["https://*", "about:*"]}
        onShouldStartLoadWithRequest={(request) => {
          if (request.url.startsWith("about:")) return true;
          if (request.url.startsWith("https://www.pinterest.com")) return true;
          if (request.url.startsWith("https://assets.pinterest.com")) return true;
          if (request.url.startsWith("https://i.pinimg.com")) return true;
          return false;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 500,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc"
  },
  webview: {
    flex: 1,
    backgroundColor: "#fff"
  }
});
