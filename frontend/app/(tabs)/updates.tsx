import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, BackHandler } from "react-native";
import { WebView } from "react-native-webview";
import { useRouter, useFocusEffect } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

export default function YouTubeFullScreenScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [cleanPlayerUrl, setCleanPlayerUrl] = useState<string | null>(null);
  const canGoBackRef = useRef(false);

  // Interceção segura do botão "voltar" nativo
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (cleanPlayerUrl) {
          setCleanPlayerUrl(null);
          return true;
        }
        if (canGoBackRef.current && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        router.back();
        return true;
      };

      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [router, cleanPlayerUrl])
  );

  const handleNavigationStateChange = (navState: any) => {
    const { url } = navState;
    canGoBackRef.current = navState.canGoBack;

    if (url.includes("youtube.com/watch?v=")) {
      setCurrentVideoUrl(url);
    } else {
      setCurrentVideoUrl(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Barra superior com espaçamento e visibilidade perfeita */}
      <View style={styles.topBar}>
        <Pressable 
          focusable={true} 
          onPress={() => {
            if (cleanPlayerUrl) {
              setCleanPlayerUrl(null);
            } else {
              router.back();
            }
          }} 
          style={({ focused }) => [styles.backBtn, focused && styles.btnFocused]}
          hitSlop={15}
        >
          <Ionicons name="arrow-back" size={20} color="#000" />
          <Text style={styles.backText}>{cleanPlayerUrl ? "Voltar ao YouTube" : "Voltar ao Menu"}</Text>
        </Pressable>
        <Text style={styles.brandTitle}>GoldCast • YouTube Smart Clean</Text>
      </View>

      {/* Conteúdo Principal */}
      <View style={styles.webWrapper}>
        <WebView
          ref={webViewRef}
          source={{ uri: cleanPlayerUrl || "https://m.youtube.com" }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          onNavigationStateChange={handleNavigationStateChange}
          scalesPageToFit={true}
        />

        {/* Botão Flutuante Inteligente (Aparece ao abrir um vídeo) */}
        {currentVideoUrl && !cleanPlayerUrl && (
          <View style={styles.floatingBanner}>
            <View style={styles.bannerInfo}>
              <Ionicons name="shield-checkmark" size={22} color="#E9C46A" />
              <View>
                <Text style={styles.bannerTitle}>Vídeo Detetado!</Text>
                <Text style={styles.bannerSubtitle}>Assista sem interrupções de propagandas</Text>
              </View>
            </View>

            <Pressable
              focusable={true}
              onPress={() => {
                const clean = currentVideoUrl.replace("youtube.com", "yout-ube.com");
                setCleanPlayerUrl(clean);
                setCurrentVideoUrl(null);
              }}
              style={({ focused }) => [styles.watchCleanBtn, focused && styles.btnFocused]}
            >
              <Ionicons name="play-circle" size={18} color="#000" />
              <Text style={styles.watchCleanText}>Assistir sem Anúncios</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1920" },
  
  topBar: { 
    height: 52,
    width: "100%",
    backgroundColor: "#07080A", 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    paddingHorizontal: 16, 
    borderBottomWidth: 1.5,
    borderBottomColor: "rgba(233,196,106,0.3)",
    zIndex: 100,
  },
  
  backBtn: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 6, 
    backgroundColor: "#E9C46A", 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 6, 
    borderWidth: 2, 
    borderColor: "transparent" 
  },
  
  btnFocused: { borderColor: "#FFF", backgroundColor: "#F4A261", transform: [{ scale: 1.05 }] },
  backText: { color: "#000", fontSize: 12, fontWeight: "900" },
  brandTitle: { color: "#E9C46A", fontSize: 12, fontWeight: "900", letterSpacing: 0.8 },
  
  webWrapper: { flex: 1, width: "100%", backgroundColor: "#000", position: "relative" },
  webview: { flex: 1, backgroundColor: "transparent" },

  floatingBanner: {
    position: "absolute",
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: "#152E3B",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 2,
    borderColor: "#E9C46A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 999,
  },
  bannerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  bannerTitle: {
    color: "#E9C46A",
    fontSize: 14,
    fontWeight: "900",
  },
  bannerSubtitle: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  watchCleanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E9C46A",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  watchCleanText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "900",
  },
});
