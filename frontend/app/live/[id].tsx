import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, StatusBar } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSession } from "../../src/store/session";
import { VideoView, useVideoPlayer } from "expo-video";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors } from "../../src/utils/theme";

export default function LivePlayerScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const session = useSession((s) => s.session);

  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !id) return;
    // URL padrão de transmissão Xtream para canais ao vivo
    const url = `${session.server.replace(/\/+$/, "")}/live/${session.username}/${session.password}/${id}.ts`;
    setStreamUrl(url);
  }, [session, id]);

  // Inicializa o expo-video unificado exatamente como nos filmes e séries
  const player = useVideoPlayer(streamUrl, (playerInstance) => {
    playerInstance.loop = false;
    playerInstance.play();
  });

  if (!streamUrl) {
    return (
      <View style={styles.center}>
        <StatusBar hidden={true} />
        <ActivityIndicator size="large" color="#E9C46A" />
        <Text style={styles.loadingText}>A carregar canal...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      <VideoView 
        player={player} 
        style={styles.video} 
        nativeControls={true} 
        contentFit="contain"
      />

      {/* Botão de voltar flutuante acessível por controlo remoto para Smart TV */}
      <TVBackLiveButton onPress={() => router.back()} />
    </View>
  );
}

function TVBackLiveButton({ onPress }: { onPress: () => void }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      accessible={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      hitSlop={15}
      style={[styles.floatingBackBtn, isFocused && styles.floatingBackBtnFocused]}
    >
      <Ionicons name="arrow-back" size={22} color={isFocused ? "#000000" : "#FFFFFF"} />
      <Text style={[styles.floatingBackText, isFocused && { color: "#000000", fontWeight: "900" }]}>Voltar</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center", position: "relative" },
  center: { flex: 1, backgroundColor: "#1B3B4B", justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  video: { width: "100%", height: "100%" },
  floatingBackBtn: {
    position: "absolute",
    top: 30,
    left: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    zIndex: 9999,
  },
  floatingBackBtnFocused: {
    backgroundColor: "#FFD700",
    borderColor: "#FFFFFF",
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
  floatingBackText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
