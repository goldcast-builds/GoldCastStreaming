import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, BackHandler } from "react-native";
import { WebView } from "react-native-webview";
import { useRouter, useFocusEffect } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useVideoPlayer, VideoView } from "expo-video"; // Integrado com o player nativo do GoldCast

export default function YouTubeFullScreenScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [activeStreamUrl, setActiveStreamUrl] = useState<string | null>(null);
  const canGoBackRef = useRef(false);

  // Instância do leitor nativo do GoldCast para reproduzir o vídeo sem anúncios
  const player = useVideoPlayer(activeStreamUrl || "", (playerInstance) => {
    playerInstance.loop = false;
    playerInstance.play();
  });

  // Interceção segura do botão "voltar" nativo
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (activeStreamUrl) {
          // Se estiver a ver no leitor do GoldCast, fecha o player e volta para o YouTube
          setActiveStreamUrl(null);
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
    }, [router, activeStreamUrl])
  );

  // Deteta quando o utilizador clica num vídeo no YouTube normal
  const handleNavigationStateChange = (navState: any) => {
    const { url } = navState;
    canGoBackRef.current = navState.canGoBack;

    // Expressão regular para extrair o ID do vídeo do YouTube (ex: watch?v=XXXXXXXXXXX)
    const match = url.match(/[?&]v=([^&#]*)/);
    if (match && match[1]) {
      setCurrentVideoId(match[1]);
    } else {
      setCurrentVideoId(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Barra superior de controlo para voltar ao menu do GoldCast */}
      <View style={styles.topBar}>
        <Pressable 
          focusable={true} 
          onPress={() => {
            if (activeStreamUrl) {
              setActiveStreamUrl(null);
            } else {
              router.back();
            }
          }} 
          style={({ focused }) => [styles.backBtn, focused && styles.btnFocused]}
          hitSlop={15}
        >
          <Ionicons name="arrow-back" size={20} color="#FFF" />
          <Text style={styles.backText}>{activeStreamUrl ? "Voltar ao YouTube" : "Voltar ao Menu"}</Text>
        </Pressable>
        <Text style={styles.brandTitle}>GoldCast • Media Hub</Text>
      </View>

      {/* Conteúdo Principal */}
      <View style={styles.webWrapper}>
        {activeStreamUrl ? (
          /* Leitor Nativo do GoldCast ativado para reproduzir o vídeo detetado */
          <View style={styles.playerContainer}>
            <VideoView
              style={styles.nativeVideo}
              player={player}
              allowsFullscreen={true}
              allowsPictureInPicture={true}
            />
          </View>
        ) : (
          /* WebView para navegar livremente pelo YouTube */
          <WebView
            ref={webViewRef}
            source={{ uri: "https://m.youtube.com" }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            onNavigationStateChange={handleNavigationStateChange}
            scalesPageToFit={true}
          />
        )}

        {/* Botão Flutuante Inteligente para abrir no Leitor Principal */}
        {currentVideoId && !activeStreamUrl && (
          <View style={styles.floatingBanner}>
            <View style={styles.bannerInfo}>
              <Ionicons name="tv" size={22} color="#E9C46A" />
              <View>
                <Text style={styles.bannerTitle}>Abrir no Player GoldCast</Text>
                <Text style={styles.bannerSubtitle}>Reproduzir sem interrupções e com alta performance</Text>
              </View>
            </View>

            <Pressable
              focusable={true}
              onPress={() => {
                // Constrói o fluxo limpo baseado no ID do vídeo para abrir no leitor nativo
                // (Utiliza a rota do Invidious/Piped stream ou o formato compatível com o expo-video)
                const streamUrl = `https://piped.video/latest/stream?id=${currentVideoId}`;
                setActiveStreamUrl(streamUrl);
                setCurrentVideoId(null);
              }}
              style={({ focused }) => [styles.watchCleanBtn, focused && styles.btnFocused]}
            >
              <Ionicons name="play" size={18} color="#000" />
              <Text style={styles.watchCleanText}>Assistir no Player</Text>
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
  
  webWrapper: { flex: 1, width: "100%", backgroundColor: "#000", position: "relative" },
  webview: { flex: 1, backgroundColor: "transparent" },

  playerContainer: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  nativeVideo: { width: "100%", height: "100%" },

  // Estilos do Botão Flutuante
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
