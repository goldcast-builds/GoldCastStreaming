import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useSession } from "../src/store/session";

function formatTimeShort(seconds?: number): string {
  const sec = Math.max(0, Math.floor(seconds || 0));
  if (sec <= 0) return "0m";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${Math.max(1, m)}m`;
}

export default function ContinueWatchingScreen() {
  const router = useRouter();
  const ud = useSession((s) => s.ud);

  const progressItems = useMemo(() => {
    const prog = ud?.progress || {};
    return Object.values(prog)
      .filter((entry: any) => entry && entry.item && entry.item.id)
      .sort((a: any, b: any) => (b?.updatedAt || 0) - (a?.updatedAt || 0));
  }, [ud]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          focusable={true}
          accessible={true}
          onPress={() => router.back()}
          style={({ focused }) => [styles.backBtn, focused && styles.cardFocused]}
          hitSlop={10}
        >
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
          keyExtractor={(entry: any, idx) =>
            `prog-${entry?.item?.kind || "media"}-${entry?.item?.id || idx}-${idx}`
          }
          numColumns={4}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          renderItem={({ item: entry, index }: { item: any; index: number }) => {
            const media = entry.item;
            const position = Number(entry?.position || 0);
            const duration = Number(entry?.duration || 0);
            const percentage =
              duration > 0
                ? Math.min(100, Math.max(4, Math.round((position / duration) * 100)))
                : 20;

            return (
              <Pressable
                focusable={true}
                accessible={true}
                hasTVPreferredFocus={index === 0}
                onPress={() => {
                  const targetId = String(media.id);
                  const resumeParam =
                    position > 0 ? { resumeSec: String(Math.floor(position)) } : {};

                  if (media.kind === "vod" || media.kind === "movie") {
                    router.push({
                      pathname: "/movie/[id]",
                      params: { id: targetId, ...resumeParam },
                    });
                  } else if (media.kind === "series") {
                    router.push({
                      pathname: "/series/[id]",
                      params: { id: targetId, ...resumeParam },
                    });
                  }
                }}
                style={({ focused }) => [styles.mediaCard, focused && styles.cardFocused]}
              >
                {media.logo || media.cover ? (
                  <Image
                    source={{ uri: media.logo || media.cover }}
                    style={styles.poster}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={styles.noPoster}>
                    <Ionicons name="play-outline" size={28} color="#E9C46A" />
                  </View>
                )}

                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.mediaTitle} numberOfLines={1}>
                    {media.title || "Sem título"}
                  </Text>
                  <Text style={styles.metaText} numberOfLines={1}>
                    {duration > 0
                      ? `${formatTimeShort(position)} / ${formatTimeShort(duration)} (${percentage}%)`
                      : `Parou em ${formatTimeShort(position)}`}
                  </Text>
                </View>
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
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "900", letterSpacing: 1.2 },

  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { color: "#9CA3AF", fontSize: 14, fontWeight: "700" },

  gridContainer: { paddingBottom: 20 },
  columnWrapper: { gap: 16, marginBottom: 16 },
  mediaCard: {
    width: 144,
    height: 206,
    backgroundColor: "#152E3B",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    justifyContent: "space-between",
  },
  cardFocused: { borderColor: "#E9C46A", borderWidth: 3, transform: [{ scale: 1.05 }] },
  poster: { width: "100%", height: 142 },
  noPoster: {
    width: "100%",
    height: 142,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },

  progressBarBg: { height: 4, backgroundColor: "rgba(255,255,255,0.2)", width: "100%" },
  progressBarFill: { height: "100%", backgroundColor: "#E9C46A" },

  cardFooter: { paddingHorizontal: 6, paddingVertical: 6, gap: 2 },
  mediaTitle: { color: "#FFF", fontSize: 10.5, fontWeight: "800", textAlign: "center" },
  metaText: { color: "#9CA3AF", fontSize: 9, fontWeight: "700", textAlign: "center" },
});
