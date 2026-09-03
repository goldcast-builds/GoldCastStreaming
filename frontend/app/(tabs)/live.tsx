import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, ActivityIndicator, TextInput } from "react-native";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius, spacing } from "../../src/utils/theme";
import {
  Category,
  getActiveListId,
  getLiveCategories,
  getLiveStreams,
  listLists,
  setActiveListId,
} from "../../src/utils/api";

const ALL: Category = { category_id: "", category_name: "Todos" };

export default function LiveTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [cats, setCats] = useState<Category[]>([ALL]);
  const [selectedCat, setSelectedCat] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listLists();
      setLists(all.map((l) => ({ id: l.id, name: l.name })));
      let a = await getActiveListId();
      if (!a && all.length) { a = all[0].id; await setActiveListId(a); }
      setActiveId(a);
      if (a) {
        const c = await getLiveCategories(a);
        setCats([ALL, ...c]);
      } else {
        setCats([ALL]); setItems([]);
      }
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoading(true);
    getLiveStreams(activeId, { category: selectedCat || undefined, search: search || undefined, limit: 300 })
      .then((data) => { if (!cancelled) setItems(data); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeId, selectedCat, search]);

  const openStream = (item: any) => {
    const url = item.playback_url || item.streamUrl;
    if (!url) return;
    const title = item.name || "";
    router.push({ pathname: "/player", params: { url, title } });
  };

  if (!activeId) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]} testID="live-empty">
        <Ionicons name="tv-outline" size={44} color={colors.textDim} />
        <Text style={styles.emptyTitle}>Nenhuma lista ativa</Text>
        <Text style={styles.emptyText}>Adicione ou selecione uma lista na aba Início.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]} testID="live-screen">
      <View style={styles.headerRow}>
        <Text style={styles.h1}>TV ao vivo</Text>
        {lists.length > 1 && (
          <Pressable
            testID="switch-list"
            onPress={async () => {
              const idx = lists.findIndex((l) => l.id === activeId);
              const next = lists[(idx + 1) % lists.length];
              await setActiveListId(next.id);
              setActiveId(next.id);
              const c = await getLiveCategories(next.id);
              setCats([ALL, ...c]);
              setSelectedCat("");
            }}
            style={styles.switchBtn}
          >
            <Ionicons name="swap-horizontal" size={14} color={colors.gold} />
            <Text style={styles.switchLabel} numberOfLines={1}>{lists.find(l => l.id === activeId)?.name}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textDim} />
        <TextInput
          testID="live-search"
          placeholder="Buscar canais..."
          placeholderTextColor={colors.textDim}
          value={search}
          onChangeText={setSearch}
          style={styles.search}
        />
      </View>

      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {cats.map((c) => {
            const active = selectedCat === c.category_id;
            return (
              <Pressable
                key={c.category_id || "all"}
                onPress={() => setSelectedCat(c.category_id)}
                testID={`cat-chip-${c.category_id || "all"}`}
                style={[styles.chip, active && styles.chipActive]}
              >
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
          <Ionicons name="tv-outline" size={40} color={colors.textDim} />
          <Text style={styles.emptyText}>Nenhum canal encontrado</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) => String(item.stream_id ?? item.id ?? item.playback_url ?? i)}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <Pressable
              testID={`channel-${item.stream_id ?? item.id}`}
              onPress={() => openStream(item)}
              style={({ focused, pressed }) => [styles.channel, focused && styles.channelFocused, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.logoBox}>
                {item.stream_icon || item.logo ? (
                  <Image source={{ uri: item.stream_icon || item.logo }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                ) : (
                  <Ionicons name="tv" size={28} color={colors.textDim} />
                )}
              </View>
              <Text style={styles.channelName} numberOfLines={2}>{item.name}</Text>
            </Pressable>
          )}
          removeClippedSubviews
          initialNumToRender={16}
          windowSize={7}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  h1: { color: colors.text, fontSize: 22, fontWeight: "700" },
  switchBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 160 },
  switchLabel: { color: colors.gold, fontSize: 12, fontWeight: "600" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginBottom: spacing.sm },
  search: { flex: 1, color: colors.text, paddingVertical: 10, fontSize: 14 },
  chipsWrap: { height: 56, justifyContent: "center" },
  chip: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0, maxWidth: 200 },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  channel: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: spacing.md, alignItems: "center", gap: spacing.sm, minHeight: 130 },
  channelFocused: { borderColor: colors.gold, borderWidth: 2 },
  logoBox: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.sm, backgroundColor: "#000", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  channelName: { color: colors.text, fontSize: 13, fontWeight: "500", textAlign: "center" },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginTop: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
});
