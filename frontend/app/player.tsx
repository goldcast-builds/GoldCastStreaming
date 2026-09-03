import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useEvent } from "expo";
import { VideoView, useVideoPlayer } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useEffect, useState } from "react";
import { colors, spacing } from "../src/utils/theme";

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { url, title } = useLocalSearchParams<{ url: string; title: string }>();
  const [error, setError] = useState<string | null>(null);

  const player = useVideoPlayer(url || null, (p) => {
    p.loop = false;
    try { p.play(); } catch {}
  });

  const { status } = useEvent(player, "statusChange", { status: player.status });

  useEffect(() => {
    if (status === "error") setError("Não foi possível reproduzir este stream.");
  }, [status]);

  if (!url) {
    return (
      <View style={styles.errorRoot}>
        <Text style={styles.errorText}>URL de stream ausente</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: colors.gold }}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="player-screen">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        allowsFullscreen
        nativeControls
      />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn} testID="player-close">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{title || "Reproduzindo"}</Text>
      </View>

      {status === "loading" && (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      )}

      {error && (
        <View style={styles.errorOverlay}>
          <Ionicons name="alert-circle" size={40} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ color: colors.gold, fontWeight: "600" }}>Voltar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 10,
  },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  title: { color: colors.text, fontSize: 15, fontWeight: "600", flex: 1 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  errorOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: "rgba(0,0,0,0.85)" },
  errorRoot: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: "#000" },
  errorText: { color: colors.text, fontSize: 14, textAlign: "center", paddingHorizontal: spacing.xl },
  backBtn: { paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: colors.gold, borderRadius: 999 },
});
