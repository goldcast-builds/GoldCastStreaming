import React, { useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

export default function YouTubeFullScreenScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);

  // Script injetado para bloquear anúncios e adaptar perfeitamente a largura do site móvel
  const injectedJavaScript = `
    (function() {
      const style = document.createElement('style');
      style.innerHTML = \`
        .ytp-ad-module, .ytp-ad-player-overlay, #masthead-ad, ytd-display-ad-renderer {
          display: none !important;
        }
        /* Força o site a ocupar toda a largura sem margens excessivas */
        body {
          width: 100% !important;
          overflow-x: hidden !important;
        }
      \`;
      document.head.appendChild(style);

      // Salta anúncios automaticamente em vídeo
      setInterval(function() {
        const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
        if (skipBtn) skipBtn.click();
      }, 300);
    })();
    true;
  `;

  return (
    <View style={styles.container}>
      {/* Barra superior flutuante e discreta para permitir voltar ao menu com o comando ou toque */}
      <View style={styles.floatingTopBar}>
        <Pressable 
          focusable={true} 
          onPress={() => router.back()} 
          style={({ focused }) => [styles.backBtn, focused && styles.btnFocused]}
          hitSlop={15}
        >
          <Ionicons name="arrow-back" size={20} color="#FFF" />
          <Text style={styles.backText}>Voltar ao Menu</Text>
        </Pressable>
        <Text style={styles.brandTitle}>GoldCast • YouTube</Text>
      </View>

      {/* WebView de largura e altura total (sem margens pretas) */}
      <View style={styles.fullWidthContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: "https://m.youtube.com" }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          injectedJavaScript={injectedJavaScript}
          // Compatibilidade total com Touch Screen e D-pad de TV
          scalesPageToFit={true}
          contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1920" },
  
  floatingTopBar: { 
    position: "absolute", 
    top: 8, 
    left: 12, 
    right: 12, 
    zIndex: 99, 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    backgroundColor: "rgba(11,25,32,0.85)", 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.2)"
  },
  
  backBtn: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 6, 
    backgroundColor: "rgba(255,255,255,0.1)", 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 6, 
    borderWidth: 2, 
    borderColor: "transparent" 
  },
  
  btnFocused: { borderColor: "#E9C46A", backgroundColor: "#152E3B", transform: [{ scale: 1.02 }] },
  backText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  brandTitle: { color: "#E9C46A", fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  
  fullWidthContainer: { flex: 1, width: "100%", height: "100%", backgroundColor: "#000" },
  webview: { flex: 1, backgroundColor: "transparent", width: "100%", height: "100%" },
});
