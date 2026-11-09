import React, { useRef } from "react";
import { View, Text, StyleSheet, Pressable, BackHandler } from "react-native";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useFocusEffect } from "@react-navigation/native";

export default function YouTubeFullScreenScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);

  // Interceção do botão "voltar" físico para navegar no histórico do YouTube
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (canGoBackRef.current && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        router.back();
        return true;
      };

      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [router])
  );

  // Bloqueio preventivo de requisições de rede direcionadas a servidores de anúncios do YouTube/Google
  const handleShouldStartLoad = (request: { url: string }) => {
    const { url } = request;
    
    // Lista de domínios de publicidade comuns do ecossistema Google/YouTube
    const adDomains = [
      "googlesyndication.com",
      "doubleclick.net",
      "googleadservices.com",
      "adservice.google.com",
      "pagead2.googlesyndication.com"
    ];

    // Se o pedido for para um domínio de anúncios, bloqueia imediatamente
    if (adDomains.some((domain) => url.includes(domain))) {
      return false; 
    }

    return true;
  };

  // Script injetado para forçar a limpeza visual e saltar anúncios instantaneamente caso passem
  const injectedJavaScript = `
    (function() {
      const style = document.createElement('style');
      style.innerHTML = \`
        .ytp-ad-module, .ytp-ad-player-overlay, #masthead-ad, ytd-display-ad-renderer, .video-ads {
          display: none !important;
          visibility: hidden !important;
        }
        body { width: 100% !important; overflow-x: hidden !important; }
      \`;
      document.head.appendChild(style);

      // Mutação dinâmica para destruir qualquer overlay de anúncio assim que ele nascer no DOM
      const observer = new MutationObserver(function(mutations) {
        const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-overlay-close-button');
        if (skipBtn) {
          skipBtn.click();
        }
        const adOverlay = document.querySelector('.ad-showing');
        if (adOverlay) {
          const video = document.querySelector('video');
          if (video && !isNaN(video.duration)) {
            video.currentTime = video.duration;
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    })();
    true;
  `;

  return (
    <View style={styles.container}>
      {/* Barra superior de controlo para voltar ao menu do GoldCast */}
      <View style={styles.topBar}>
        <Pressable 
          focusable={true} 
          onPress={() => router.back()} 
          style={({ focused }) => [styles.backBtn, focused && styles.btnFocused]}
          hitSlop={15}
        >
          <Ionicons name="arrow-back" size={20} color="#FFF" />
          <Text style={styles.backText}>Voltar ao Menu</Text>
        </Pressable>
        <Text style={styles.brandTitle}>GoldCast • YouTube Clean</Text>
      </View>

      {/* WebView com filtragem de rede e injeção anti-ads avançada */}
      <View style={styles.webWrapper}>
        <WebView
          ref={webViewRef}
          source={{ uri: "https://m.youtube.com" }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          injectedJavaScript={injectedJavaScript}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onNavigationStateChange={(navState) => {
            canGoBackRef.current = navState.canGoBack;
          }}
          scalesPageToFit={true}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1920" },
  
  topBar: { 
    height: 48,
    width: "100%",
    backgroundColor: "#0b1920", 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    paddingHorizontal: 16, 
    borderBottomWidth: 1,
    borderBottomColor: "rgba(233,196,106,0.2)",
    zIndex: 100,
  },
  
  backBtn: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 6, 
    backgroundColor: "rgba(255,255,255,0.1)", 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 6, 
    borderWidth: 2, 
    borderColor: "transparent" 
  },
  
  btnFocused: { borderColor: "#E9C46A", backgroundColor: "#152E3B", transform: [{ scale: 1.02 }] },
  backText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  brandTitle: { color: "#E9C46A", fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  
  webWrapper: { flex: 1, width: "100%", backgroundColor: "#000" },
  webview: { flex: 1, backgroundColor: "transparent" },
});
