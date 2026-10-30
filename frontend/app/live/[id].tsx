import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSession } from "../../src/store/session";
import { VideoView, useVideoPlayer } from "expo-video";
import Ionicons from "@react-native-vector-icons/ionicons";

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
        <ActivityIndicator size="large" color="#E9C46A" />
        <Text style={styles.loadingText}>A carregar canal...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VideoView 
        player={player} 
        style={styles.video} 
        nativeControls={true} 
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  center: { flex: 1, backgroundColor: "#1B3B4B", justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  video: { width: "100%", height: "100%" },
});
