import React, { useState, useRef, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, ScrollView, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import YoutubePlayer from "react-native-youtube-iframe";

const { width } = Dimensions.get("window");

export default function YouTubeTVScreen() {
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const [videoId, setVideoId] = useState("jfKfPfyJRdk"); // Exemplo inicial: Lo-fi / Vídeo padrão
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Lista de sugestões rápidas otimizada para navegação por D-pad na Smart TV
  const suggestions = [
    { id: "jfKfPfyJRdk", title: "Lo-Fi Beats (Relaxamento)" },
    { id: "5qap5aO4i9A", title: "Lofi Hip Hop Radio" },
    { id: "LXb3EKWsInQ", title: "Costa Amalfitana 4K (Relax)" },
    { id: "1La4QzGeaaQ", title: "Natureza em 4K UHD" },
  ];

  const onStateChange = useCallback((state: string) => {
    if (state === "ended") {
      setPlaying(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      {/* Cabeçalho nativo otimizado para TV */}
      <View style={styles.header}>
        <Pressable 
          focusable={true} 
          onPress={() => router.back()} 
          style={({ focused }) => [styles.backBtn, focused && styles.btnFocused]}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={26} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>YOUTUBE TV — PLAYER NATIVO</Text>
      </View>

      <View style={styles.contentLayout}>
        {/* Painel Principal do Leitor (Compatível com D-pad) */}
        <View style={styles.playerContainer}>
          <YoutubePlayer
            height={320}
            play={playing}
            videoId={videoId}
            onChangeState={onStateChange}
            webViewProps={{
              allowsInlineMediaPlayback: true,
              androidLayerType: "hardware",
            }}
          />
          <View style={styles.playerInfoBar}>
            <Text style={styles.playerInfoText}>
              {playing ? "▶ Reproduzindo com controlos da TV" : "⏸ Pausado"}
            </Text>
            <Pressable
              focusable={true}
              onPress={() => setPlaying((prev) => !prev)}
              style={({ focused }) => [styles.controlBtn, focused && styles.btnFocused]}
            >
              <Ionicons name={playing ? "pause" : "play"} size={18} color="#000" />
              <Text style={styles.controlBtnText}>{playing ? "Pausar" : "Reproduzir"}</Text>
            </Pressable>
          </View>
        </View>

        {/* Lista Lateral de Conteúdos para Seleção Rápida com o Comando da TV */}
        <View style={styles.sidebarContainer}>
          <Text style={styles.sidebarTitle}>⭐ Sugestões em Destaque</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {suggestions.map((item) => {
              const isSelected = videoId === item.id;
              return (
                <Pressable
                  key={item.id}
                  focusable={true}
                  onPress={() => {
                    setVideoId(item.id);
                    setPlaying(true);
                  }}
                  style={({ focused }) => [
                    styles.suggestionCard, 
                    isSelected && styles.cardSelected, 
                    focused && styles.btnFocused
                  ]}
                >
                  <Ionicons name="play-circle" size={24} color={isSelected ? "#E9C46A" : "#FFF"} />
                  <Text style={styles.suggestionText} numberOfLines={2}>{item.title}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1B3B4B", paddingHorizontal: 36, paddingVertical: 24 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  btnFocused: { borderColor: "#E9C46A", borderWidth: 3, backgroundColor: "#152E3B", transform: [{ scale: 1.02 }] },
  headerTitle: { color: "#FFF", fontSize: 20, fontWeight: "900", letterSpacing: 1.2 },

  contentLayout: { flex: 1, flexDirection: "row", gap: 24 },
  playerContainer: { flex: 2, backgroundColor: "#10222B", borderRadius: 16, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(233,196,106,0.2)" },
  playerInfoBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#152E3B" },
  playerInfoText: { color: "#E9C46A", fontSize: 13, fontWeight: "800" },
  
  controlBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E9C46A", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  controlBtnText: { color: "#000", fontSize: 12, fontWeight: "900" },

  sidebarContainer: { flex: 1, backgroundColor: "#152E3B", borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: "rgba(233,196,106,0.2)", gap: 12 },
  sidebarTitle: { color: "#E9C46A", fontSize: 14, fontWeight: "900", letterSpacing: 0.8, marginBottom: 4 },
  
  suggestionCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(27,59,75,0.8)", padding: 12, borderRadius: 12, borderWidth: 2, borderColor: "transparent" },
  cardSelected: { borderColor: "#E9C46A", backgroundColor: "#10222B" },
  suggestionText: { color: "#FFF", fontSize: 12, fontWeight: "800", flex: 1 },
});
