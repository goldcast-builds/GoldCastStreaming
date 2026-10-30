import React from "react";
import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useSession } from "../src/store/session";

export default function ContinueWatchingScreen() {
  const router = useRouter();
  const progressItems = useSession((s) => Object.values(s.ud.progress || {}));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable focusable={true} onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>CONTINUAR A ASSISTIR</Text>
      </View>

      {progressItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="film-outline" size={48} color="#E9C46A" />
          <Text style={styles.emptyText}>Nenhum histórico de reprodução encontrado.</Text>
        </View>
      ) : (
        <FlatList
          data={progressItems}
          keyExtractor={(item, idx) => `prog-${item?.item?.id || idx}`}
          numColumns={4}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const media = item.item;
            const percentage = item.duration > 0 ? Math.min(100, Math.round((item.position / item.duration) * 100)) : 0;

            return (
              <Pressable
                focusable={true}
                onPress={() => {
                  if (media.kind === "vod") {
                    router.push({ pathname: "/movie/[id]", params: { id: String(media.id) } });
                  } else if (media.kind === "series") {
                    router.push({ pathname: "/series/[id]", params: { id: String(media.id) } });
                  }
                }}
                style={({ focused }) => [styles.mediaCard, focused && styles.cardFocused]}
              >
                {media.logo ? (
                  <Image source={{ uri: media.logo }} style={styles.poster} contentFit="cover" />
                ) : (
                  <View style={styles.noPoster}>
                    <Ionicons name="play-outline" size={28} color="#E9C46A" />
                  </View>
                )}
                
                {/* Barra de Progresso */}
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
                </View>

                <Text style={styles.mediaTitle} numberOfLines={1}>{media.title}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1B3B4B", paddingHorizontal: 36, paddingVertical: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "900", letterSpacing: 1.2 },

  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { color: "#9CA3AF", fontSize: 14, fontWeight: "700" },

  gridContainer: { paddingBottom: 20 },
  columnWrapper: { gap: 16, marginBottom: 16 },
  mediaCard: { width: 140, height: 195, backgroundColor: "#152E3B", borderRadius: 10, overflow: "hidden", borderWidth: 2, borderColor: "transparent", justifyContent: "space-between" },
  cardFocused: { borderColor: "#E9C46A", borderWidth: 3, transform: [{ scale: 1.05 }] },
  poster: { width: "100%", height: 145 },
  noPoster: { width: "100%", height: 145, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.2)" },
  
  progressBarBg: { height: 4, backgroundColor: "rgba(255,255,255,0.2)", width: "100%" },
  progressBarFill: { height: "100%", backgroundColor: "#E9C46A" },

  mediaTitle: { color: "#FFF", fontSize: 10, fontWeight: "800", textAlign: "center", paddingHorizontal: 4, paddingBottom: 6 },
});
