import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, ActivityIndicator, TextInput, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius, spacing } from "../../src/utils/theme";
import { Category, getActiveListId, getSeriesCategories, getSeriesStreams } from "../../src/utils/api";

const ALL: Category = { category_id: "", category_name: "Todos" };
const { width } = Dimensions.get("window");
const COLS = width > 600 ? 4 : 3;
const CARD_W = (width - spacing.lg * 2 - spacing.md * (COLS - 1)) / COLS;

export default function SeriesTab() {
  const insets = useSafeAreaInsets();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cats, setCats] = useState<Category[]>([ALL]);
  const [selectedCat, setSelectedCat] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const a = await getActiveListId();
      setActiveId(a);
      if (a) {
        const c = await getSeriesCategories(a);
        setCats([ALL, ...c]);
      } else { setItems([]); setCats([ALL]); }
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoading(true);
    getSeriesStreams(activeId, { category: selectedCat || undefined, search: search || undefined, limit: 300 })
      .then((d) => { if (!cancelled) setItems(d); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeId, selectedCat, search]);

  if (!activeId) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]} testID="series-empty">
        <Ionicons name="albums-outline" size={44} color={colors.textDim} />
        <Text style={styles.emptyTitle}>Nenhuma lista ativa</Text>
        <Text style={styles.emptyText}>Somente listas Xtream Codes têm Séries.{"\n"}Adicione uma na aba Início.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]} testID="series-screen">
      <Text style={styles.h1}>Séries</Text>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textDim} />
        <TextInput testID="series-search" placeholder="Buscar séries..." placeholderTextColor={colors.textDim} value={search} onChangeText={setSearch} style={styles.search} />
      </View>

      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {cats.map((c) => {
            const active = selectedCat === c.category_id;
            return (
              <Pressable key={c.category_id || "all"} onPress={() => setSelectedCat(c.category_id)} testID={`series-cat-${c.category_id || "all"}`} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && { color: colors.onGold }]} numberOfLines={1}>{c.category_name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="albums-outline" size={40} color={colors.textDim} />
          <Text style={styles.emptyText}>Nenhuma série encontrada</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) => String(item.series_id ?? item.id ?? i)}
          numColumns={COLS}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={[{ width: CARD_W }, styles.poster]} testID={`series-${item.series_id ?? item.id}`}>
              <View style={styles.posterImgWrap}>
                {item.cover ? (
                  <Image source={{ uri: item.cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
                ) : (
                  <Ionicons name="albums" size={30} color={colors.textDim} />
                )}
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.scrim} />
                <Text style={styles.posterTitle} numberOfLines={2}>{item.name}</Text>
              </View>
            </View>
          )}
          initialNumToRender={12}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  h1: { color: colors.text, fontSize: 22, fontWeight: "700", paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginBottom: spacing.sm },
  search: { flex: 1, color: colors.text, paddingVertical: 10, fontSize: 14 },
  chipsWrap: { height: 56, justifyContent: "center" },
  chip: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0, maxWidth: 200 },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  poster: { borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface2 },
  posterImgWrap: { width: "100%", aspectRatio: 2 / 3, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "50%" },
  posterTitle: { position: "absolute", left: 8, right: 8, bottom: 8, color: colors.text, fontSize: 12, fontWeight: "600" },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginTop: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
});
