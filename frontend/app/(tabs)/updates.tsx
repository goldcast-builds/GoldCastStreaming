import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import YoutubePlayer from "react-native-youtube-iframe";

export default function YouTubeTVScreen() {
  const router = useRouter();
  const [playing, setPlaying] = useState(true);
  const [videoId, setVideoId] = useState("L_LUpnjgPso"); // Vídeo padrão ativo e garantido
  const [searchQuery, setSearchQuery] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [activeCategory, setActiveCategory] = useState("musica");

  // Listas de conteúdos reais divididos por categorias para navegação por D-pad
  const categories: Record<string, { id: string; title: string; channel: string }[]> = {
    musica: [
      { id: "L_LUpnjgPso", title: "Global Hits — Melhores Músicas do Momento", channel: "Music Global" },
      { id: "5qap5aO4i9A", title: "Lofi Hip Hop Radio — Beats para Relaxar", channel: "Lofi Girl" },
      { id: "jfKfPfyJRdk", title: "Chill Beats & Study Music", channel: "Lofi Records" },
    ],
    documentarios: [
      { id: "LXb3EKWsInQ", title: "Costa Amalfitana em 4K — Viagem e Paisagens", channel: "World 4K" },
      { id: "1La4QzGeaaQ", title: "Planeta Terra: Maravilhas da Natureza 4K", channel: "Nature UHD" },
      { id: "YqeW9_5kURI", title: "O Universo e as Galáxias em Alta Definição", channel: "Space Science" },
    ],
    tecnologia: [
      { id: "9xwazDkOJRM", title: "Futuro da Inteligência Artificial e Robótica", channel: "Tech Trends" },
      { id: "ZHbuZaNrpIQ", title: "Invenções Incríveis que Vão Mudar o Mundo", channel: "Inovação Tech" },
    ]
  };

  const currentList = categories[activeCategory] || categories.musica;

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
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>YOUTUBE TV — MEDIA HUB</Text>

        {/* Barra de Pesquisa Integrada */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#E9C46A" />
          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar no YouTube..."
            placeholderTextColor="#9CA3AF"
            value={inputVal}
            onChangeText={setInputVal}
            onSubmitEditing={() => {
              if (inputVal.trim()) {
                // Simulação de termo pesquisado para carregar vídeos dinâmicos
                setSearchQuery(inputVal);
              }
            }}
            blurOnSubmit={false}
          />
        </View>
      </View>

      {/* Abas de Categorias */}
      <View style={styles.categoriesBar}>
        {[
          { key: "musica", label: "🎵 Músicas & Hits" },
          { key: "documentarios", label: "🌍 Viagens & Natureza 4K" },
          { key: "tecnologia", label: "💻 Tecnologia & Inovação" },
        ].map((cat) => {
          const isSelected = activeCategory === cat.key;
          return (
            <Pressable
              key={cat.key}
              focusable={true}
              onPress={() => setActiveCategory(cat.key)}
              style={({ focused }) => [
                styles.catTab,
                isSelected && styles.catTabActive,
                focused && styles.btnFocused
              ]}
            >
              <Text style={[styles.catText, isSelected && styles.catTextActive]}>{cat.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.contentLayout}>
        {/* Painel Principal do Leitor */}
        <View style={styles.playerContainer}>
          <YoutubePlayer
            height={280}
            play={playing}
            videoId={videoId}
            onChangeState={onStateChange}
            webViewProps={{
              allowsInlineMediaPlayback: true,
              androidLayerType: "hardware",
            }}
          />
          <View style={styles.playerInfoBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nowPlayingTitle} numberOfLines={1}>Reproduzindo conteúdo selecionado</Text>
              <Text style={styles.playerInfoText}>{playing ? "▶ A transmitir em direto" : "⏸ Pausado"}</Text>
            </View>
            <Pressable
              focusable={true}
              onPress={() => setPlaying((prev) => !prev)}
              style={({ focused }) => [styles.controlBtn, focused && styles.btnFocused]}
            >
              <Ionicons name={playing ? "pause" : "play"} size={16} color="#000" />
              <Text style={styles.controlBtnText}>{playing ? "Pausar" : "Reproduzir"}</Text>
            </Pressable>
          </View>
        </View>

        {/* Lista Lateral de Vídeos da Categoria */}
        <View style={styles.sidebarContainer}>
          <Text style={styles.sidebarTitle}>📺 Vídeos Disponíveis</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {currentList.map((item) => {
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
                  <Ionicons name="play-circle" size={22} color={isSelected ? "#E9C46A" : "#FFF"} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionText} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.suggestionChannel} numberOfLines={1}>{item.channel}</Text>
                  </View>
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
  container: { flex: 1, backgroundColor: "#1B3B4B", paddingHorizontal: 32, paddingVertical: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  btnFocused: { borderColor: "#E9C46A", borderWidth: 3, backgroundColor: "#152E3B", transform: [{ scale: 1.02 }] },
  headerTitle: { color: "#FFF", fontSize: 16, fontWeight: "900", letterSpacing: 1 },

  searchBox: { flex: 1, maxWidth: 320, flexDirection: "row", alignItems: "center", backgroundColor: "#10222B", borderRadius: 10, paddingHorizontal: 12, height: 38, borderWidth: 1, borderColor: "rgba(233,196,106,0.3)", gap: 8 },
  searchInput: { flex: 1, color: "#FFF", fontSize: 12, fontWeight: "700" },

  categoriesBar: { flexDirection: "row", gap: 10, marginBottom: 14 },
  catTab: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#152E3B", borderRadius: 8, borderWidth: 2, borderColor: "transparent" },
  catTabActive: { backgroundColor: "rgba(233,196,106,0.2)", borderColor: "#E9C46A" },
  catText: { color: "#9CA3AF", fontSize: 11, fontWeight: "800" },
  catTextActive: { color: "#E9C46A", fontWeight: "900" },

  contentLayout: { flex: 1, flexDirection: "row", gap: 20 },
  playerContainer: { flex: 1.6, backgroundColor: "#10222B", borderRadius: 14, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(233,196,106,0.2)" },
  playerInfoBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, backgroundColor: "#152E3B" },
  nowPlayingTitle: { color: "#FFF", fontSize: 12, fontWeight: "900" },
  playerInfoText: { color: "#E9C46A", fontSize: 10, fontWeight: "700" },
  
  controlBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E9C46A", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  controlBtnText: { color: "#000", fontSize: 11, fontWeight: "900" },

  sidebarContainer: { flex: 1, backgroundColor: "#152E3B", borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: "rgba(233,196,106,0.2)", gap: 10 },
  sidebarTitle: { color: "#E9C46A", fontSize: 13, fontWeight: "900", letterSpacing: 0.8 },
  
  suggestionCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(27,59,75,0.8)", padding: 10, borderRadius: 10, borderWidth: 2, borderColor: "transparent" },
  cardSelected: { borderColor: "#E9C46A", backgroundColor: "#10222B" },
  suggestionText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  suggestionChannel: { color: "#9CA3AF", fontSize: 9, fontWeight: "600" },
});
