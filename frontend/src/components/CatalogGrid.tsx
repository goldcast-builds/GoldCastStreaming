import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, ActivityIndicator, TextInput, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius, spacing } from "../utils/theme";
import { Category } from "../services/xtream";
import { useDebounce } from "../utils/hooks";

export const CAT_ALL = "__all", CAT_FAV = "__fav", CAT_RECENT = "__recent", CAT_CONTINUE = "__continue";

export interface GridItem { id: string; name: string; poster?: string; year?: string; genre?: string; categoryId?: string; rating?: string; progress?: number }

export function CatalogGrid({
  title, items, cats, loading, error, onRetry, favIds, recentIds, continueIds, onOpen, onFav, emptyText, testIDPrefix, searchPlaceholder,
}: {
  title: string;
  items: GridItem[];
  cats: Category[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  favIds: string[];
  recentIds: string[];
  continueIds?: string[];
  onOpen: (item: GridItem) => void;
  onFav: (item: GridItem) => void;
  emptyText: string;
  testIDPrefix: string;
  searchPlaceholder: string;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const COLS = width > 900 ? 6 : width > 600 ? 4 : 3;
  const CARD_W = (width - spacing.lg * 2 - spacing.md * (COLS - 1)) / COLS;
  const [selectedCat, setSelectedCat] = useState(CAT_ALL);
  const [search, setSearch] = useState("");
  const q = useDebounce(search.trim().toLowerCase(), 300);

  const allCats = useMemo(() => [
    { category_id: CAT_ALL, category_name: "Todos" },
    ...(continueIds ? [{ category_id: CAT_CONTINUE, category_name: "Continuar a Assistir" }] : []),
    { category_id: CAT_FAV, category_name: "Favoritos" },
    { category_id: CAT_RECENT, category_name: "Recentes" },
    ...cats,
  ], [cats, continueIds]);

  const visible = useMemo(() => {
    let src = items;
    if (selectedCat === CAT_FAV) src = src.filter((i) => favIds.includes(i.id));
    else if (selectedCat === CAT_RECENT) { const o = new Map(recentIds.map((r, i) => [r, i])); src = src.filter((i) => o.has(i.id)).sort((a, b) => o.get(a.id)! - o.get(b.id)!); }
    else if (selectedCat === CAT_CONTINUE && continueIds) { const o = new Map(continueIds.map((r, i) => [r, i])); src = src.filter((i) => o.has(i.id)).sort((a, b) => o.get(a.id)! - o.get(b.id)!); }
    else if (selectedCat !== CAT_ALL) src = src.filter((i) => String(i.categoryId) === selectedCat);
    if (q) src = src.filter((i) => i.name.toLowerCase().includes(q));
    return src;
  }, [items, selectedCat, q, favIds, recentIds, continueIds]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]} testID={`${testIDPrefix}-screen`}>
      <Text style={styles.h1}>{title}</Text>
      
      {/* Barra de Pesquisa Moderna */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput 
          testID={`${testIDPrefix}-search`} 
          placeholder={searchPlaceholder} 
          placeholderTextColor={colors.textDim} 
          value={search} 
          onChangeText={setSearch} 
          style={styles.search} 
          autoCorrect={false} 
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Categorias em Cápsulas Horizontais */}
      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {allCats.map((c) => {
            const active = selectedCat === String(c.category_id);
            return (
              <Pressable 
                key={String(c.category_id)} 
                onPress={() => setSelectedCat(String(c.category_id))} 
                testID={`${testIDPrefix}-cat-${c.category_id}`} 
                style={({ focused }) => [
                  styles.chip, 
                  active && styles.chipActive, 
                  focused && styles.focused
                ]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                  {c.category_name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Estados de Carregamento, Erro e Lista */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.gold} size="large" /><Text style={styles.emptyText}>A carregar catálogo...</Text></View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.textDim} />
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable testID={`${testIDPrefix}-retry`} onPress={onRetry} style={styles.retryBtn}><Text style={styles.retryText}>TENTAR NOVAMENTE</Text></Pressable>
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.center} testID={`${testIDPrefix}-empty`}>
          <Ionicons name="film-outline" size={44} color={colors.textDim} />
          <Text style={styles.emptyText}>{items.length === 0 ? emptyText : selectedCat === CAT_FAV ? "Nenhum favorito adicionado." : selectedCat === CAT_RECENT ? "Nada assistido recentemente." : selectedCat === CAT_CONTINUE ? "Nada para continuar." : "Nenhum resultado encontrado."}</Text>
        </View>
      ) : (
        <FlatList
          key={COLS}
          data={visible}
          keyExtractor={(i) => i.id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md, paddingBottom: 110 }}
          renderItem={({ item }) => <PosterCard item={item} width={CARD_W} fav={favIds.includes(item.id)} onPress={() => onOpen(item)} onFav={() => onFav(item)} testIDPrefix={testIDPrefix} />}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const PosterCard = memo(function PosterCard({ item, width, fav, onPress, onFav, testIDPrefix }: { item: GridItem; width: number; fav: boolean; onPress: () => void; onFav: () => void; testIDPrefix: string }) {
  return (
    <Pressable 
      testID={`${testIDPrefix}-item-${item.id}`} 
      onPress={onPress} 
      onLongPress={onFav} 
      style={({ focused, pressed }) => [
        { width }, 
        styles.poster, 
        focused && styles.posterFocused, 
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }
      ]}
    >
      <View style={styles.posterImgWrap}>
        {item.poster ? (
          <Image 
            source={{ uri: item.poster }} 
            style={StyleSheet.absoluteFillObject} 
            contentFit="cover" 
            transition={200} 
            recyclingKey={item.id} 
            cachePolicy="memory-disk" 
          />
        ) : (
          <Ionicons name="film" size={32} color={colors.textDim} />
        )}

        {/* Gradiente estilo Netflix / Prime com 3 níveis de profundidade */}
        <LinearGradient 
          colors={["transparent", "rgba(9,10,14,0.45)", "rgba(9,10,14,0.98)"]} 
          locations={[0, 0.55, 1]}
          style={styles.scrim} 
        />

        {/* Emblema de Favorito com fundo translúcido */}
        {fav && (
          <View style={styles.favBadge}>
            <Ionicons name="star" size={12} color={colors.gold} />
          </View>
        )}

        {/* Informações de Título e Categoria */}
        <View style={styles.posterMeta}>
          <Text style={styles.posterTitle} numberOfLines={2}>{item.name}</Text>
          {(item.year || item.genre) && (
            <Text style={styles.posterSub} numberOfLines={1}>
              {[item.year, item.genre].filter(Boolean).join(" • ")}
            </Text>
          )}
        </View>

        {/* Barra de Progresso elegante */}
        {item.progress != null && item.progress > 0 && (
          <View style={styles.progTrack}>
            <View style={[styles.progFill, { width: `${Math.min(100, item.progress * 100)}%` }]} />
          </View>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  h1: { color: colors.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.5, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  
  // Barra de Pesquisa Flutuante
  searchWrap: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: spacing.sm, 
    marginHorizontal: spacing.lg, 
    backgroundColor: colors.surface, 
    borderRadius: radius.md, 
    paddingHorizontal: spacing.md, 
    height: 44,
    borderWidth: 1, 
    borderColor: colors.border, 
    marginBottom: spacing.xs 
  },
  search: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "500" },
  
  // Cápsulas de Categorias
  chipsWrap: { height: 50, justifyContent: "center" },
  chip: { 
    height: 34, 
    paddingHorizontal: 16, 
    borderRadius: radius.pill, 
    backgroundColor: colors.surface, 
    borderWidth: 1, 
    borderColor: colors.border, 
    alignItems: "center", 
    justifyContent: "center", 
    flexShrink: 0 
  },
  chipActive: { 
    backgroundColor: colors.gold, 
    borderColor: colors.gold 
  },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.onGold, fontWeight: "800" },
  focused: { borderColor: colors.gold, borderWidth: 2 },
  
  // Cartão com Sombra e Cantos Redondos
  poster: { 
    borderRadius: 8, 
    overflow: "hidden", 
    backgroundColor: colors.surface2,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 }
  },
  posterFocused: { borderWidth: 2, borderColor: colors.gold, transform: [{ scale: 1.04 }] },
  posterImgWrap: { width: "100%", aspectRatio: 2 / 3, backgroundColor: "#0E1017", alignItems: "center", justifyContent: "center" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" },
  
  favBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    padding: 4,
    borderRadius: radius.pill,
  },
  
  posterMeta: { position: "absolute", left: 8, right: 8, bottom: 8 },
  posterTitle: { color: colors.text, fontSize: 12, fontWeight: "700", lineHeight: 15, textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 3 },
  posterSub: { color: colors.textMuted, fontSize: 10, fontWeight: "500", marginTop: 3 },
  
  // Barra de Progresso
  progTrack: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3.5, backgroundColor: "rgba(255,255,255,0.22)" },
  progFill: { height: 3.5, backgroundColor: colors.gold },
  
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  retryBtn: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 20, height: 40, justifyContent: "center" },
  retryText: { color: colors.gold, fontWeight: "800", fontSize: 12 },
});
