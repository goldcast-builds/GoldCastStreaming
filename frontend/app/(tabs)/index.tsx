import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, useWindowDimensions, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Logo } from "../../src/components/Logo";
import { GoldButton } from "../../src/components/GoldButton";
import { colors, radius, spacing } from "../../src/utils/theme";
import { listLists } from "../../src/utils/api";
import { useSession } from "../../src/store/session";

const MAIN = [
  { key: "live", label: "TV AO VIVO", icon: "tv-outline", path: "/(tabs)/live", testID: "home-live" },
  { key: "movies", label: "FILMES", icon: "film-outline", path: "/(tabs)/movies", testID: "home-movies" },
  { key: "series", label: "SÉRIES", icon: "albums-outline", path: "/(tabs)/series", testID: "home-series" },
] as const;

export default function HomeTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const session = useSession((s) => s.session);
  const source = useSession((s) => s.source);
  const setSource = useSession((s) => s.setSource);
  const deviceMode = useSession((s) => s.deviceMode);
  const [hasLists, setHasLists] = useState(false);

  useFocusEffect(useCallback(() => { listLists().then((l) => setHasLists(l.length > 0)).catch(() => {}); }, []));

  const landscape = width > height;
  const isTV = deviceMode === "tv" || landscape;
  const circle = Math.min(isTV ? 190 : 150, (width - spacing.lg * 2 - spacing.lg * 2) / 3);
  const hasContent = !!session || hasLists;

  const go = async (path: string) => {
    if (session && source?.kind !== "list") await setSource({ kind: "xtream" });
    router.push(path as any);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, minHeight: height - 60 }]} testID="home-screen">
      <View style={styles.topBar}>
        <View style={{ width: 44 }} />
        <Logo size={isTV ? 120 : 110} />
        <Pressable testID="home-search" onPress={() => router.push({ pathname: "/(tabs)/live", params: { focusSearch: "1" } })} hitSlop={8} style={({ focused }) => [styles.iconBtn, focused && styles.focused]}>
          <Ionicons name="search" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.center}>
        {hasContent ? (
          <View style={styles.mainRow}>
            {MAIN.map((m) => (
              <Pressable
                key={m.key}
                testID={m.testID}
                onPress={() => go(m.path)}
                hasTVPreferredFocus={m.key === "live"}
                style={({ focused, pressed }) => [styles.circle, { width: circle, height: circle, borderRadius: circle / 2 }, focused && styles.circleFocused, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name={m.icon as any} size={circle * 0.34} color={colors.gold} />
                <Text style={[styles.circleLabel, { fontSize: Math.max(11, circle * 0.09) }]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ width: "100%", maxWidth: 420, gap: spacing.md, alignItems: "center" }}>
            <Text style={styles.brand}>GoldCast Streaming</Text>
            <Text style={styles.hint}>Entre com usuário e senha do seu serviço ou adicione uma lista M3U.</Text>
            <GoldButton testID="home-login" label="ENTRAR" icon={<Ionicons name="log-in-outline" size={20} color={colors.onGold} />} onPress={() => router.push("/login")} style={{ alignSelf: "stretch", marginTop: spacing.md }} />
            <GoldButton testID="add-list-primary" label="ADICIONAR LISTA M3U" variant="outline" icon={<Ionicons name="add-circle" size={20} color={colors.gold} />} onPress={() => router.push("/add-list")} style={{ alignSelf: "stretch" }} />
          </View>
        )}
      </View>

      <View style={[styles.bottomRow, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.bottomGroup}>
          <SmallTile testID="home-account" icon="person-outline" label="CONTA" onPress={() => router.push(session ? "/(tabs)/settings" : "/login")} />
          <SmallTile testID="home-favorites" icon="star-outline" label="FAVORITOS" onPress={() => router.push({ pathname: "/(tabs)/live", params: { cat: "__fav" } })} />
        </View>
        <View style={styles.bottomGroup}>
          <SmallTile testID="home-settings" icon="settings-outline" label="CONFIGURAÇÕES" onPress={() => router.push("/(tabs)/settings")} />
        </View>
      </View>
    </ScrollView>
  );
}

function SmallTile({ icon, label, onPress, testID }: { icon: any; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ focused, pressed }) => [styles.tile, focused && styles.circleFocused, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={24} color={colors.text} />
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, justifyContent: "space-between" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl },
  mainRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.lg, flexWrap: "wrap" },
  circle: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: "rgba(212,175,55,0.45)", alignItems: "center", justifyContent: "center", gap: 6 },
  circleFocused: { borderColor: colors.gold, borderWidth: 3, backgroundColor: colors.surface3, transform: [{ scale: 1.06 }] },
  circleLabel: { color: colors.text, fontWeight: "700", letterSpacing: 1 },
  brand: { color: colors.gold, fontSize: 26, fontWeight: "700", letterSpacing: 0.6 },
  hint: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: spacing.xl },
  bottomGroup: { flexDirection: "row", gap: spacing.sm },
  tile: { width: 92, height: 84, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 6 },
  tileLabel: { color: colors.text, fontSize: 9, fontWeight: "700", letterSpacing: 0.5, textAlign: "center" },
  focused: { borderWidth: 2, borderColor: colors.gold },
});
