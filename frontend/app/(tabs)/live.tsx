import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, ActivityIndicator, TextInput, Modal } from "react-native";
import { Image } from "expo-image";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius, spacing } from "../../src/utils/theme";
import { Category, getLiveCategories, getLiveStreams, IPTVList, listLists } from "../../src/utils/api";
import { useDebounce } from "../../src/utils/hooks";
import { PlayItem, useSession } from "../../src/store/session";
import { liveUrls } from "../../src/services/xtream";
import { AccessGate } from "../../src/components/AccessGate";

const CAT_ALL = "__all", CAT_FAV = "__fav", CAT_RECENT = "__recent";

type Row = { id: string; name: string; logo?: string; category: string; urls: string[]; streamId?: number | string; epgId?: string | null; raw: any };

export default function LiveTab() {
  return (
    <AccessGate>
      <LiveContent />
    </AccessGate>
  );
}

function LiveContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ cat?: string; focusSearch?: string }>();
  const searchRef = useRef<TextInput>(null);
  const session = useSession((s) => s.session);
  const source = useSession((s) => s.source);
  const setSource = useSession((s) => s.setSource);
  const catalog = useSession((s) => s.catalog);
  const loadingLive = useSession((s) => s.loading.live);
  const errLive = useSession((s) => s.errors.live);
  const loadLive = useSession((s) => s.loadLive);
  const favs = useSession((s) => s.ud.favorites.live);
  const recents = useSession((s) => s.ud.recents.live);
  const toggleFav = useSession((s) => s.toggleFav);
  const setQueue = useSession((s) => s.setQueue);
  const liveFormat = useSession((s) => s.prefs.liveFormat);

  const [lists, setLists] = useState<IPTVList[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState(CAT_ALL);
  const [search, setSearch] = useState("");
  const q = useDebounce(search.trim().toLowerCase(), 300);

  // M3U list mode (backend)
  const listMode = source?.kind === "list" ? source.listId : null;
  const [listCats, setListCats] = useState<Category[]>([]);
  const [listItems, setListItems] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    listLists().then(setLists).catch(() => {});
    if (!listMode && session) loadLive();
  }, [listMode, session?.server, loadLive]));

  useEffect(() => {
    if (params.cat) setSelectedCat(String(params.cat));
    if (params.focusSearch) setTimeout(() => searchRef.current?.focus(), 300);
  }, [params.cat, params.focusSearch]);

  useEffect(() => {
    if (!listMode) return;
    let cancelled = false;
    setListLoading(true);
    Promise.all([
      getLiveCategories(listMode),
      getLiveStreams(listMode, { category: selectedCat.startsWith("__") ? undefined : selectedCat, search: q || undefined, limit: 5000 }),
    ])
      .then(([c, it]) => { if (!cancelled) { setListCats(c); setListItems(it); } })
      .catch(() => { if (!cancelled) setListItems([]); })
      .finally(() => { if (!cancelled) setListLoading(false); });
    return () => { cancelled = true; };
  }, [listMode, selectedCat, q]);

  const cats: Category[] = useMemo(() => {
    const base = listMode ? listCats : catalog.liveCats;
    return [
      { category_id: CAT_ALL, category_name: "Todos" },
      { category_id: CAT_FAV, category_name: "Favoritos" },
      { category_id: CAT_RECENT, category_name: "Recentes" },
      ...base,
    ];
  }, [listMode, listCats, catalog.liveCats]);
  const catName = useMemo(() => Object.fromEntries(cats.map((c) => [String(c.category_id), c.category_name])), [cats]);

  const rows: Row[] = useMemo(() => {
    if (listMode) {
      return listItems.map((c: any) => ({ id: String(c.id), name: c.name, logo: c.logo, category: c.group || "", urls: [c.playback_url || c.streamUrl], epgId: c.tvgId, raw: c }));
    }
    if (!session) return [];
    let src = catalog.live;
    if (selectedCat === CAT_FAV) src = src.filter((c) => favs.includes(String(c.stream_id)));
    else if (selectedCat === CAT_RECENT) {
      const order = new Map(recents.map((r, i) => [String(r.stream_id), i]));
      src = src.filter((c) => order.has(String(c.stream_id))).sort((a, b) => order.get(String(a.stream_id))! - order.get(String(b.stream_id))!);
    } else if (selectedCat !== CAT_ALL) src = src.filter((c) => String(c.category_id) === selectedCat || (c.category_ids || []).map(String).includes(selectedCat));
    if (q) src = src.filter((c) => (c.name || "").toLowerCase().includes(q) || (c.epg_channel_id || "").toLowerCase().includes(q));
    return src.map((c) => ({
      id: String(c.stream_id), name: c.name, logo: c.stream_icon, category: catName[String(c.category_id)] || "",
      urls: liveUrls(session, c.stream_id, liveFormat === "auto" ? undefined : liveFormat), streamId: c.stream_id, epgId: c.epg_channel_id, raw: c,
    }));
  }, [listMode, listItems, session, catalog.live, selectedCat, q, favs, recents, catName, liveFormat]);

  // In list (M3U) mode favorites/recents are filtered client-side too
  const visibleRows = useMemo(() => {
    if (!listMode) return rows;
    if (selectedCat === CAT_FAV) return rows.filter((r) => favs.includes(r.id));
    if (selectedCat === CAT_RECENT) { const o = new Map(recents.map((r, i) => [String(r.id), i])); return rows.filter((r) => o.has(r.id)).sort((a, b) => o.get(a.id)! - o.get(b.id)!); }
    return rows;
  }, [rows, listMode, selectedCat, favs, recents]);

  const open = useCallback((index: number) => {
    const items: PlayItem[] = visibleRows.map((r) => ({
      kind: "live", id: r.id, title: r.name, subtitle: r.category, logo: r.logo, urls: r.urls, streamId: r.streamId, epgChannelId: r.epgId, raw: r.raw,
    }));
    setQueue(items, index);
    router.push("/player");
  }, [visibleRows, setQueue, router]);

  const loading = listMode ? listLoading : loadingLive && !catalog.liveLoaded;
  const sourceLabel = listMode ? lists.find((l) => l.id === listMode)?.name || "Lista M3U" : session ? `Conta ${session.userInfo?.username || session.username}` : "";

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]} testID="live-screen">
      <View style={styles.headerRow}>
        <Text style={styles.h1}>TV ao vivo</Text>
        {(lists.length > 0 || session) && (
          <Pressable testID="switch-list" onPress={() => setPickerOpen(true)} style={({ focused }) => [styles.switchBtn, focused && styles.focused]}>
            <Ionicons name="swap-horizontal" size={14} color={colors.gold} />
            <Text style={styles.switchLabel} numberOfLines={1}>{sourceLabel}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textDim} />
        <TextInput ref={searchRef} testID="live-search" placeholder="Buscar canais..." placeholderTextColor={colors.textDim} value={search} onChangeText={setSearch} style={styles.search} autoCorrect={false} />
        {search.length > 0 && <Pressable onPress={() => setSearch("")} hitSlop={8}><Ionicons name="close-circle" size={16} color={colors.textDim} /></Pressable>}
      </View>

      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {cats.map((c) => {
            const active = selectedCat === String(c.category_id);
            return (
              <Pressable key={String(c.category_id)} onPress={() => setSelectedCat(String(c.category_id))} testID={`cat-chip-${c.category_id}`} style={({ focused }) => [styles.chip, active && styles.chipActive, focused && styles.focused]}>
                <Text style={[styles.chipText, active && { color: colors.onGold }]} numberOfLines={1}>{c.category_name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.gold} /><Text style={styles.emptyText}>Carregando canais...</Text></View>
      ) : errLive && !listMode && !catalog.liveLoaded ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textDim} />
          <Text style={styles.emptyText}>{errLive}</Text>
          <Pressable testID="live-retry" onPress={() => loadLive(true)} style={styles.retryBtn}><Text style={styles.retryText}>TENTAR NOVAMENTE</Text></Pressable>
        </View>
      ) : visibleRows.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name={selectedCat === CAT_FAV ? "star-outline" : "tv-outline"} size={40} color={colors.textDim} />
          <Text style={styles.emptyText}>{selectedCat === CAT_FAV ? "Nenhum canal favorito ainda." : selectedCat === CAT_RECENT ? "Nenhum canal assistido recentemente." : "Nenhum canal encontrado"}</Text>
        </View>
      ) : (
        <FlatList
          data={visibleRows}
          keyExtractor={(r) => r.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md, paddingBottom: 100 }}
          renderItem={({ item, index }) => <ChannelCard row={item} fav={favs.includes(item.id)} onPress={() => open(index)} onFav={() => toggleFav("live", item.id)} />}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setPickerOpen(false)}>
          <View style={styles.modalCard} testID="source-picker">
            <Text style={styles.modalTitle}>Trocar fonte</Text>
            {session && (
              <Pressable testID="source-xtream" onPress={() => { setSource({ kind: "xtream" }); setSelectedCat(CAT_ALL); setPickerOpen(false); }} style={({ focused }) => [styles.modalRow, !listMode && styles.modalRowActive, focused && styles.focused]}>
                <Ionicons name="key" size={16} color={colors.gold} />
                <Text style={styles.modalRowText}>Conta Xtream/XUI · {session.userInfo?.username || session.username}</Text>
              </Pressable>
            )}
            {lists.map((l) => (
              <Pressable key={l.id} testID={`source-list-${l.id}`} onPress={() => { setSource({ kind: "list", listId: l.id }); setSelectedCat(CAT_ALL); setPickerOpen(false); }} style={({ focused }) => [styles.modalRow, listMode === l.id && styles.modalRowActive, focused && styles.focused]}>
                <Ionicons name={l.type === "xtream" ? "key" : l.type === "m3u_url" ? "link" : "document"} size={16} color={colors.gold} />
                <Text style={styles.modalRowText} numberOfLines={1}>{l.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const ChannelCard = memo(function ChannelCard({ row, fav, onPress, onFav }: { row: Row; fav: boolean; onPress: () => void; onFav: () => void }) {
  return (
    <Pressable testID={`channel-${row.id}`} onPress={onPress} onLongPress={onFav} style={({ focused, pressed }) => [styles.channel, focused && styles.channelFocused, pressed && { opacity: 0.85 }]}>
      <View style={styles.logoBox}>
        {row.logo ? (
          <Image source={{ uri: row.logo }} style={{ width: "100%", height: "100%" }} contentFit="contain" recyclingKey={row.id} cachePolicy="memory-disk" transition={150} />
        ) : (
          <Ionicons name="tv" size={28} color={colors.textDim} />
        )}
        <Pressable testID={`fav-${row.id}`} onPress={onFav} hitSlop={8} style={styles.favBtn}>
          <Ionicons name={fav ? "star" : "star-outline"} size={16} color={fav ? colors.gold : colors.textMuted} />
        </Pressable>
      </View>
      <Text style={styles.channelName} numberOfLines={2}>{row.name}</Text>
      {!!row.category && <Text style={styles.channelCat} numberOfLines={1}>{row.category}</Text>}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  h1: { color: colors.text, fontSize: 22, fontWeight: "700" },
  switchBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 10, height: 34, maxWidth: 190 },
  switchLabel: { color: colors.gold, fontSize: 12, fontWeight: "600" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginBottom: spacing.sm },
  search: { flex: 1, color: colors.text, paddingVertical: 10, fontSize: 14 },
  chipsWrap: { height: 52, justifyContent: "center" },
  chip: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0, maxWidth: 220 },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  focused: { borderColor: colors.gold, borderWidth: 2 },
  channel: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: spacing.md, alignItems: "center", gap: 6, minHeight: 140 },
  channelFocused: { borderColor: colors.gold, borderWidth: 2, transform: [{ scale: 1.03 }] },
  logoBox: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.sm, backgroundColor: "#000", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  favBtn: { position: "absolute", top: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  channelName: { color: colors.text, fontSize: 13, fontWeight: "600", textAlign: "center" },
  channelCat: { color: colors.textDim, fontSize: 11, textAlign: "center" },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  retryBtn: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 18, height: 40, justifyContent: "center" },
  retryText: { color: colors.gold, fontWeight: "700", fontSize: 12 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  modalCard: { width: "100%", maxWidth: 420, backgroundColor: colors.surface2, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: spacing.md, gap: 4 },
  modalTitle: { color: colors.gold, fontSize: 15, fontWeight: "700", marginBottom: spacing.sm, marginLeft: spacing.xs },
  modalRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md },
  modalRowActive: { backgroundColor: "rgba(212,175,55,0.12)" },
  modalRowText: { color: colors.text, fontSize: 14, flex: 1 },
});
