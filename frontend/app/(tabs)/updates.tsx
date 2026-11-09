import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

export default function YouTubeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  // Script avançado injetado para bloquear anúncios, saltar overlays e ocultar distrações
  const injectedJavaScript = `
    (function() {
      // 1. Injeção de CSS para ocultar anúncios e elementos patrocinados
      const style = document.createElement('style');
      style.innerHTML = \`
        .ytp-ad-module, 
        .ytp-ad-overlay-image, 
        .ytp-ad-player-overlay, 
        #masthead-ad, 
        ytd-rich-item-renderer.style-scope.ytd-rich-grid-row #dismissible.style-scope.ytd-rich-item-renderer:has(span.ytd-badge-supported-renderer),
        ytd-display-ad-renderer, 
        ytd-compact-promoted-video-renderer {
          display: none !important;
        }
      \`;
      document.head.appendChild(style);

      // 2. Função automática para clicar no botão "Saltar Anúncio" (Skip Ad) assim que aparecer
      setInterval(function() {
        const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, button.ytp-ad-skip-button');
        if (skipBtn) {
          skipBtn.click();
        }
        
        // Fechar overlays de anúncios em vídeo se surgirem
        const closeOverlay = document.querySelector('.ytp-ad-overlay-close-button');
        if (closeOverlay) {
          closeOverlay.click();
        }
      }, 500);
    })();
    true;
  `;

  return (
    <View style={styles.container}>
      {/* Cabeçalho nativo mantendo o padrão visual do GoldCast */}
      <View style={styles.header}>
        <Pressable 
          focusable={true} 
          onPress={() => router.back()} 
          style={({ focused }) => [styles.backBtn, focused && styles.btnFocused]}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>YOUTUBE SEM ANÚNCIOS</Text>
      </View>

      {/* Contentor do WebView isolado */}
      <View style={styles.webContainer}>
        {loading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color="#E9C46A" />
            <Text style={styles.loaderText}>A carregar YouTube limpo...</Text>
          </View>
        )}
        <WebView
          ref={webViewRef}
          source={{ uri: "https://m.youtube.com" }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          injectedJavaScript={injectedJavaScript}
          onLoadEnd={() => setLoading(false)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1B3B4B", paddingHorizontal: 24, paddingVertical: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  btnFocused: { borderColor: "#E9C46A", backgroundColor: "#152E3B" },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "900", letterSpacing: 1.2 },
  webContainer: { flex: 1, borderRadius: 16, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(233,196,106,0.2)", backgroundColor: "#10222B" },
  webview: { flex: 1, backgroundColor: "transparent" },
  loaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#152E3B", alignItems: "center", justifyContent: "center", gap: 10, zIndex: 10 },
  loaderText: { color: "#E9C46A", fontSize: 12, fontWeight: "700" },
});
