import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

export default function YouTubeFullWebViewScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  // Script avançado injetado para bloquear anúncios agressivamente e ocultar elementos indesejados
  const injectedJavaScript = `
    (function() {
      // 1. Estilos CSS para ocultar anúncios, banners e módulos comerciais
      const style = document.createElement('style');
      style.innerHTML = \`
        .ad-showing, .ytp-ad-module, .ytp-ad-player-overlay, #masthead-ad, ytd-display-ad-renderer {
          display: none !important;
        }
      \`;
      document.head.appendChild(style);

      // 2. Automação contínua para saltar e fechar anúncios automaticamente
      setInterval(function() {
        const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, button.ytp-ad-skip-button');
        if (skipBtn) {
          skipBtn.click();
        }
        
        // Se houver anúncios em vídeo bloqueando a tela, avança o tempo para o fim do anúncio
        const video = document.querySelector('video');
        if (video && document.querySelector('.ad-showing')) {
          video.currentTime = video.duration || 999;
        }
      }, 300);
    })();
    true;
  `;

  return (
    <View style={styles.container}>
      {/* Barra de topo minimalista para permitir voltar ao menu do GoldCast com o comando */}
      <View style={styles.topBar}>
        <Pressable 
          focusable={true} 
          onPress={() => router.back()} 
          style={({ focused }) => [styles.backBtn, focused && styles.btnFocused]}
          hitSlop={15}
        >
          <Ionicons name="arrow-back" size={22} color="#FFF" />
          <Text style={styles.backText}>Voltar ao Menu</Text>
        </Pressable>
        <Text style={styles.brandTitle}>GoldCast Media Hub — YouTube TV</Text>
      </View>

      {/* Contentor do WebView com o YouTube Completo */}
      <View style={styles.webContainer}>
        {loading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color="#E9C46A" />
            <Text style={styles.loaderText}>A carregar YouTube TV...</Text>
          </View>
        )}
        <WebView
          ref={webViewRef}
          source={{ uri: "https://www.youtube.com/tv" }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          injectedJavaScript={injectedJavaScript}
          onLoadEnd={() => setLoading(false)}
          userAgent="Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/6.0 TV Safari/537.36"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1920", padding: 12 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 8 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 2, borderColor: "transparent" },
  btnFocused: { borderColor: "#E9C46A", backgroundColor: "#152E3B", transform: [{ scale: 1.02 }] },
  backText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  brandTitle: { color: "#E9C46A", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  
  webContainer: { flex: 1, borderRadius: 12, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(233,196,106,0.2)", backgroundColor: "#000" },
  webview: { flex: 1, backgroundColor: "transparent" },
  loaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#152E3B", alignItems: "center", justifyContent: "center", gap: 10, zIndex: 10 },
  loaderText: { color: "#E9C46A", fontSize: 12, fontWeight: "700" },
});
