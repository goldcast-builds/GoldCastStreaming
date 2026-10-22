import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, ActivityIndicator, TextInput, Modal, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, radius, spacing } from "../../src/utils/theme";
import { Category, getLiveCategories, getLiveStreams, IPTVList, listLists } from "../../src/utils/api";
import { useDebounce } from "../../src/utils/hooks";
import { PlayItem, useSession } from "../../src/store/session";
import { liveUrls } from "../../src/services/xtream";

const CAT_ALL = "__all", CAT_FAV = "__fav", CAT_RECENT = "__recent";

type Row = { id: string; name: string; logo?: string; category: string; urls: string[]; streamId?: number | string; epgId?: string | null; raw: any };

interface UserProfile {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: "normal" | "kids" | "adult" | "football";
}

export default function LiveTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
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
  const [searchFocused, setSearchFocused] = useState(false);
  const q = useDebounce(search.trim().toLowerCase(), 300);

  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [adultPin, setAdultPin] = useState("0000");
  const [adultLocked, setAdultLocked] = useState(true);
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const numCols = useMemo(() => {
    if (width >= 900) return 6;
    if (width >= 600) return 4;
    return 3;
  }, [width]);

  const listMode = source?.kind === "list" ? source.listId : null;
  const [listCats, setListCats] = useState<Category[]>([]);
  const [listItems, setListItems] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    let isMounted = true;
    listLists().then((l) => { if (isMounted) setLists(l); }).catch(() => {});
    if (!listMode && session) loadLive();

    AsyncStorage.getItem("@goldcast_active_profile").then((raw) => {
      if (raw && isMounted) {
        try { setCurrentProfile(JSON.parse(raw)); } catch {}
      }
    });
    AsyncStorage.getItem("@goldcast_adult_pin").then((val) => { if (val && isMounted) setAdultPin(val); });
    AsyncStorage.getItem("@goldcast_adult_locked").then((val) => { if (val !== null && isMounted) setAdultLocked(val === "true"); });

    return () => { isMounted = false; };
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

  const isAdultContent = (name: string, categoryName: string = "") => {
    const text = (name + " " + categoryName).toLowerCase();
    return /adult|xxx|\+18|18\+|private|sensual|erot|sex|playboy|venus|hot|seventeen|privates|canal adulto|filmes xxx/i.test(text);
  };

  const isKidsContent = (name: string, categoryName: string = "") => {
    const text = (name + " " + categoryName).toLowerCase();
    return /infantil|kids|anima|desenho|disney|pixar|cartoon|turma|peppa|patrulha|barbie|lego|baby|nickelodeon|turma da mônica|galinha pintadinha|patrulha canina|ben 10|frozen|princesa|sonic|pokemon|minions|super onze|akame|dragon ball|naruto|one piece|sword art/i.test(text);
  };

  const themeStyles = useMemo(() => {
    const type = currentProfile?.type;
    if (type === "kids") {
      return { bg: "#0C1B2A", accent: "#38BDF8", cardBg: "#172A45", headerBg: "#0B132B" };
    }
    if (type === "adult") {
      return { bg: "#140808", accent: "#EF4444", cardBg: "#1F1111", headerBg: "#120505" };
    }
    if (type === "football") {
      return { bg: "#041C0F", accent: "#10B981", cardBg: "#0D2E1A", headerBg: "#03140A" };
    }
    return { bg: colors.bg, accent: colors.gold, cardBg: colors.surface2, headerBg: colors.surface };
  }, [currentProfile?.type]);

  // Exibe todas as categorias da API do IPTV sem bloqueios severos no perfil normal
  const cats: Category[] = useMemo(() => {
    const base = listMode ? listCats : catalog.liveCats;
    let filtered = base;

    if (currentProfile?.type === "kids") {
      filtered = base.filter((c) => isKidsContent("", c.category_name));
    } else if (currentProfile?.type === "adult") {
      filtered = base.filter((c) => isAdultContent("", c.category_name));
    }

    return [
      { category_id: CAT_ALL, category_name: "Todos" },
      { category_id: CAT_FAV, category_name: "Favoritos" },
      { category_id: CAT_RECENT, category_name: "Recentes" },
      ...filtered,
    ];
  }, [listMode, listCats, catalog.liveCats, currentProfile?.type]);

  const catName = useMemo(() => Object.fromEntries(cats.map((c) => [String(c.category_id), c.category_name])), [cats]);

  const rows: Row[] = useMemo(() => {
    let src: any[] = listMode ? listItems : catalog.live;

    if (!listMode && session) {
      src = src.filter((c) => {
        const name = c.name || "";
        const cat = catName[String(c.category_id)] || "";

        if (currentProfile?.type === "kids") {
          return isKidsContent(name, cat);
        }
        if (currentProfile?.type === "adult") {
          return isAdultContent(name, cat);
        }
        return true; // Permite todos os canais para perfis normais e de futebol
      });
    }

    if (listMode) {
      return src.map((c: any) => ({ id: String(c.id), name: c.name, logo: c.logo, category: c.group || "", urls: [c.playback_url || c.streamUrl], epgId: c.tvgId, raw: c }));
    }

    if (!session) return [];
    let mapped = src;
    if (selectedCat === CAT_FAV) mapped = mapped.filter((c) => favs.includes(String(c.stream_id)));
    else if (selectedCat === CAT_RECENT) {
      const order = new Map(recents.map((r, i) => [String(r.stream_id), i]));
      mapped = mapped.filter((c) => order.has(String(c.stream_id))).sort((a, b) => order.get(String(a.stream_id))! - order.get(String(b.stream_id))!);
    } else if (selectedCat !== CAT_ALL) {
      mapped = mapped.filter((c) => String(c.category_id) === selectedCat || (c.category_ids || []).map(String).includes(selectedCat));
    }
    if (q) mapped = mapped.filter((c) => (c.name || "").toLowerCase().includes(q) || (c.epg_channel_id || "").toLowerCase().includes(q));

    return mapped.map((c) => ({
      id: String(c.stream_id), name: c.name, logo: c.stream_icon, category: catName[String(c.category_id)] || "",
      urls: liveUrls(session, c.stream_id, liveFormat === "auto" ? undefined : liveFormat), streamId: c.stream_id, epgId: c.epg_channel_id, raw: c,
    }));
  }, [listMode, listItems, session, catalog.live, selectedCat, q, favs, recents, catName, liveFormat, currentProfile?.type]);

  const visibleRows = useMemo(() => {
    if (!listMode) return rows;
    if (selectedCat === CAT_FAV) return rows.filter((r) => favs.includes(r.id));
    if (selectedCat === CAT_RECENT) { const o = new Map(recents.map((r, i) => [String(r.id), i])); return rows.filter((r) => o.has(r.id)).sort((a, b) => o.get(a.id)! - o.get(b.id)!); }
    return rows;
  }, [rows, listMode, selectedCat, favs, recents]);

  const handleOpenPlayer = (item: Row, index: number) => {
    const openAction = () => {
      const items: PlayItem[] = visibleRows.map((r) => ({
        kind: "live", id: r.id, title: r.name, subtitle: r.category, logo: r.logo, urls: r.urls, streamId: r.streamId, epgChannelId: r.epgId, raw: r.raw,
      }));
      setQueue(items, index);
      
      router.push({
        pathname: "/player",
        params: {
          url: item?.urls?.[0] || "",
          streamUrl: item?.urls?.[0] || "",
          title: item?.name || "Transmissão",
          name: item?.name || "",
          id: item?.id || "",
          stream_id: String(item?.streamId || item?.id || ""),
          type: "live",
        },
      });
    };

    // Solicita o PIN apenas se for canal adulto e o bloqueio estiver ativo num perfil não adulto
    if (adultLocked && currentProfile?.type !== "adult" && isAdultContent(item.name, item.category)) {
      setPendingAction(() => openAction);
      setEnteredPin("");
      setShowPinModal(true);
    } else {
      openAction();
    }
  };

  const verifyPinAndOpen = () => {
    if (enteredPin === adultPin) {
      setShowPinModal(false);
      setEnteredPin("");
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } else {
      Alert.alert("Senha Incorreta", "A senha padrão é 0000.");
      setEnteredPin("");
    }
  };

  const loading = listMode ? listLoading : loadingLive && !catalog.liveLoaded;
  const sourceLabel = listMode ? lists.find((l) => l.id === listMode)?.name || "Lista M3U" : session ? `Conta ${session.userInfo?.username || session.username}` : "";

  return (
    <View style={[styles.root, { backgroundColor: themeStyles.bg, paddingTop: insets.top + spacing.sm }]} testID="live-screen">
      <View style={styles.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ionicons name="tv" size={22} color={themeStyles.accent} />
          <Text style={[styles.h1, { color: colors.text }]}>TV ao vivo & Canais</Text>
        </View>

        {(lists.length > 0 || session) && (
          <Pressable testID="switch-list" focusable={true} onPress={() => setPickerOpen(true)} style={({ focused }) => [styles.switchBtn, { borderColor: themeStyles.accent }, focused && styles.focused]}>
            <Ionicons name="swap-horizontal" size={14} color={themeStyles.accent} />
            <Text style={[styles.switchLabel, { color: themeStyles.accent }]} numberOfLines={1}>{sourceLabel}</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.searchWrap, { backgroundColor: themeStyles.headerBg }, searchFocused && styles.searchWrapFocused]}>
        <Ionicons name="search" size={16} color={searchFocused ? "#000000" : colors.textDim} />
        <TextInput 
          ref={searchRef} 
          testID="live-search" 
          placeholder="Buscar canais..." 
          placeholderTextColor={searchFocused ? "#333333" : colors.textDim} 
          value={search} 
          onChangeText={setSearch} 
          style={[styles.search, searchFocused && { color: "#000000", fontWeight: "700" }]} 
          autoCorrect={false}
          focusable={true}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {search.length > 0 && (
          <Pressable focusable={true} onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={searchFocused ? "#000000" : colors.textDim} />
          </Pressable>
        )}
      </View>

      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}>
          {cats.map((c) => (
            <LiveCategoryChipItem
              key={String(c.category_id)}
              cat={c}
              active={selectedCat === String(c.category_id)}
              accentColor={themeStyles.accent}
              onSelect={() => setSelectedCat(String(c.category_id))}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={themeStyles.accent} /><Text style={styles.emptyText}>Carregando canais...</Text></View>
      ) : errLive && !listMode && !catalog.liveLoaded ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textDim} />
          <Text style={styles.emptyText}>{errLive}</Text>
          <Pressable focusable={true} testID="live-retry" onPress={() => loadLive(true)} style={[styles.retryBtn, { borderColor: themeStyles.accent }]}><Text style={[styles.retryText, { color: themeStyles.accent }]}>TENTAR NOVAMENTE</Text></Pressable>
        </View>
      ) : visibleRows.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name={selectedCat === CAT_FAV ? "star-outline" : "tv-outline"} size={40} color={colors.textDim} />
          <Text style={styles.emptyText}>{selectedCat === CAT_FAV ? "Nenhum canal favorito ainda." : "Nenhum canal encontrado."}</Text>
        </View>
      ) : (
        <FlatList
          key={`grid-${numCols}`}
          data={visibleRows}
          keyExtractor={(r) => r.id}
          numColumns={numCols}
          columnWrapperStyle={{ gap: 8, paddingHorizontal: spacing.md }}
          contentContainerStyle={{ gap: 8, paddingVertical: spacing.sm, paddingBottom: 120 }}
          renderItem={({ item, index }) => (
            <ChannelCard 
              row={item} 
              fav={favs.includes(item.id)} 
              cardBg={themeStyles.cardBg}
              accentColor={themeStyles.accent}
              onPress={() => handleOpenPlayer(item, index)} 
              onFav={() => toggleFav("live", item.id)} 
              isFirst={index === 0}
            />
          )}
          removeClippedSubviews={false}
          initialNumToRender={18}
          maxToRenderPerBatch={18}
          windowSize={9}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={() => setShowPinModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.pinCard}>
            <Ionicons name="lock-closed" size={32} color="#EF4444" />
            <Text style={styles.pinTitle}>Conteúdo Protegido (+18)</Text>
            <Text style={styles.pinSub}>Digite a senha PIN (padrão: 0000)</Text>
            <TextInput
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              placeholder="••••"
              placeholderTextColor="#777"
              value={enteredPin}
              onChangeText={setEnteredPin}
              style={styles.pinInput}
            />
            <View style={{ flexDirection: "row", gap: 10, width: "100%", marginTop: 10 }}>
              <Pressable onPress={() => setShowPinModal(false)} style={[styles.pinBtn, { backgroundColor: "#262936" }]}>
                <Text style={{ color: "#FFF", fontWeight: "800" }}>CANCELAR</Text>
              </Pressable>
              <Pressable onPress={verifyPinAndOpen} style={[styles.pinBtn, { backgroundColor: "#EF4444" }]}>
                <Text style={{ color: "#FFF", fontWeight: "900" }}>LIBERAR</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setPickerOpen(false)}>
          <View style={styles.modalCard} testID="source-picker">
            <Text style={styles.modalTitle}>Trocar fonte</Text>
            {session && (
              <Pressable focusable={true} testID="source-xtream" onPress={() => { setSource({ kind: "xtream" }); setSelectedCat(CAT_ALL); setPickerOpen(false); }} style={({ focused }) => [styles.modalRow, !listMode && styles.modalRowActive, focused && styles.focused]}>
                <Ionicons name="key" size={16} color={colors.gold} />
                <Text style={styles.modalRowText}>Conta Xtream · {session.userInfo?.username || session.username}</Text>
              </Pressable>
            )}
            {lists.map((l) => (
              <Pressable key={l.id} focusable={true} testID={`source-list-${l.id}`} onPress={() => { setSource({ kind: "list", listId: l.id }); setSelectedCat(CAT_ALL); setPickerOpen(false); }} style={({ focused }) => [styles.modalRow, listMode === l.id && styles.modalRowActive, focused && styles.focused]}>
                <Ionicons name="document" size={16} color={colors.gold} />
                <Text style={styles.modalRowText} numberOfLines={1}>{l.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function LiveCategoryChipItem({ cat, active, accentColor, onSelect }: { cat: Category; active: boolean; accentColor: string; onSelect: () => void }) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onSelect}
      style={[
        styles.chip,
        active && { backgroundColor: `${accentColor}35`, borderColor: accentColor },
        isFocused && { backgroundColor: accentColor, borderColor: "#FFFFFF", transform: [{ scale: 1.08 }] },
      ]}
    >
      <Text style={[styles.chipText, (active || isFocused) && { color: isFocused ? "#000000" : accentColor, fontWeight: "900" }]} numberOfLines={1}>
        {cat.category_name}
      </Text>
    </Pressable>
  );
}

const ChannelCard = memo(function ChannelCard({ row, fav, cardBg, accentColor, onPress, onFav, isFirst }: { row: Row; fav: boolean; cardBg: string; accentColor: string; onPress: () => void; onFav: () => void; isFirst?: boolean }) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <Pressable
      focusable={true}
      hasTVPreferredFocus={isFirst}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      onLongPress={onFav}
      style={[
        styles.channel,
        { backgroundColor: cardBg },
        isFocused && styles.channelFocused,
      ]}
    >
      <View style={styles.logoBox}>
        {row.logo ? (
          <Image source={{ uri: row.logo }} style={{ width: "85%", height: "85%" }} contentFit="contain" recyclingKey={row.id} cachePolicy="memory-disk" transition={120} />
        ) : (
          <Ionicons name="tv" size={24} color={isFocused ? accentColor : colors.textDim} />
        )}

        {isFocused && (
          <View style={[styles.channelFocusBadge, { backgroundColor: accentColor }]}>
            <Text style={styles.channelFocusBadgeText}>▶ ASSISTIR</Text>
          </View>
        )}

        <Pressable focusable={true} onPress={onFav} hitSlop={6} style={styles.favBtn}>
          <Ionicons name={fav ? "star" : "star-outline"} size={12} color={fav ? accentColor : colors.textMuted} />
        </Pressable>
      </View>
      <Text style={[styles.channelName, isFocused && { color: "#FFFFFF", fontWeight: "900" }]} numberOfLines={1}>
        {row.name}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  h1: { fontSize: 20, fontWeight: "700" },
  switchBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 9, height: 30, maxWidth: 180 },
  switchLabel: { fontSize: 11, fontWeight: "600" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.md, borderRadius: radius.md, paddingHorizontal: spacing.sm, borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.xs },
  searchWrapFocused: { backgroundColor: "#E5A93B", borderColor: "#FFFFFF", borderWidth: 2.5 },
  search: { flex: 1, color: colors.text, paddingVertical: 8, fontSize: 13 },
  chipsWrap: { height: 46, justifyContent: "center" },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  focused: { borderColor: colors.gold, borderWidth: 2 },
  channel: { flex: 1, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, padding: 6, alignItems: "center", gap: 4 },
  channelFocused: { borderColor: "#FFD700", borderWidth: 3.5, transform: [{ scale: 1.07 }], elevation: 14, zIndex: 99 },
  logoBox: { width: "100%", aspectRatio: 1, borderRadius: radius.xs, backgroundColor: "#0c0d14", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" },
  channelFocusBadge: { position: "absolute", bottom: 0, left: 0, right: 0, paddingVertical: 2.5, alignItems: "center" },
  channelFocusBadgeText: { color: "#000000", fontSize: 8.5, fontWeight: "900" },
  favBtn: { position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  channelName: { color: colors.text, fontSize: 11, fontWeight: "600", textAlign: "center", width: "100%", marginTop: 2 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  retryBtn: { marginTop: spacing.sm, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 16, height: 36, justifyContent: "center" },
  retryText: { fontWeight: "700", fontSize: 11 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  modalCard: { width: "100%", maxWidth: 420, backgroundColor: colors.surface2, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: spacing.md, gap: 4 },
  modalTitle: { color: colors.gold, fontSize: 14, fontWeight: "700", marginBottom: spacing.xs, marginLeft: spacing.xs },
  modalRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md },
  modalRowActive: { backgroundColor: "rgba(212,175,55,0.12)" },
  modalRowText: { color: colors.text, fontSize: 13, flex: 1 },
  pinCard: { width: "100%", maxWidth: 360, backgroundColor: "#181818", borderRadius: 20, padding: 22, alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "#EF4444" },
  pinTitle: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  pinSub: { color: "#9CA3AF", fontSize: 12, textAlign: "center" },
  pinInput: { width: "100%", height: 48, backgroundColor: "#262626", borderRadius: 10, paddingHorizontal: 14, color: "#FFF", fontSize: 22, textAlign: "center", letterSpacing: 8 },
  pinBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
