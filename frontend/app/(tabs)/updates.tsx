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

  // Interceção do botão "voltar" físico do Android/TV para navegar no histórico do YouTube
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (canGoBackRef.current && webViewRef.current) {
          webViewRef.current.goBack();
          return true; // Impede que o app feche e volta uma página no YouTube
        }
        router.back(); // Se já estiver na página inicial do YouTube, sai para o menu
        return true;
      };

      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [router])
  );

  // Script injetado para bloquear anúncios e garantir largura total
  const injectedJavaScript = `
    (function() {
      const style = document.createElement('style');
      style.innerHTML = \`
        .ytp-ad-module, .ytp-ad-player-overlay, #masthead-ad, ytd-display-ad-renderer {
          display: none !important;
        }
        body { width: 100% !important; overflow-x: hidden !important; }
      \`;
      document.head.appendChild(style);

      setInterval(function() {
        const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
        if (skipBtn) skipBtn.click();
      }, 300);
    })();
    true;
  `;

  return (
    <View style={styles.container}>
      {/* Barra superior fixa e com altura garantida para nunca ficar escondida */}
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
        <Text style={styles.brandTitle}>GoldCast • YouTube</Text>
      </View>

      {/* WebView com margem superior (marginTop) para não ficar por baixo da barra */}
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
