import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, FlatList } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius, spacing } from "../../src/utils/theme";
import { PlayItem, useSession } from "../../src/store/session";
import { Episode, episodeUrls, xtream } from "../../src/services/xtream";

export default function SeriesDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const base = useSession((s) => s.catalog.series.find((v) => String(v.series_id) === String(id)));
  const fav = useSession((s) => s.ud.favorites.series.includes(String(id)));
  const toggleFav = useSession((s) => s.toggleFav);
  const addRecent = useSession((s) => s.addRecent);
  const setQueue = useSession((s) => s.setQueue);
  const progress = useSession((s) => s.ud.progress);
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !id) return;
    let cancelled = false;
    setLoading(true); setError(null);
    xtream.seriesInfo(session, id)
      .then((d) => { if (cancelled) return; setInfo(d); const keys = Object.keys(d?.episodes || {}); setSeason(keys[0] ?? null); })
      .catch((e) => !cancelled && setError(e?.message || "Falha ao carregar série."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [session?.server, id]);

  const meta = info?.info || {};
  const title = meta.name || base?.name || "Série";
  const poster = meta.cover || base?.cover;
  const seasons: string[] = useMemo(() => Object.keys(info?.episodes || {}).sort((a, b) => Number(a) - Number(b)), [info]);
  const episodes: Episode[] = useMemo(() => (season && info?.episodes?.[season]) || [], [info, season]);

  const playEpisode = (index: number) => {
    if (!session) return;
    const items: PlayItem[] = episodes.map((ep) => ({
      kind: "series", id: String(ep.id), title: `T${season} E${ep.episode_num} · ${ep.title || "Episódio " + ep.episode_num}`, subtitle: title,
      logo: ep.info?.movie_image || poster, urls: episodeUrls(session, ep.id, ep.container_extension), progressKey: `ep:${ep.id}`,
      favKind: "series", favId: String(id),
      raw: base || { series_id: Number(id), name: title, cover: poster },
    }));
    addRecent("series", base || { series_id: Number(id), name: title, cover: poster });
    setQueue(items, index);
    router.push("/player");
  };

  const Header = (
    <View>
      <View style={styles.hero}>
        {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={12} /> : null}
        <LinearGradient colors={["rgba(0,0,0,0.3)", colors.bg]} style={StyleSheet.absoluteFill} />
        <View style={[styles.heroRow, { paddingTop: insets.top + 56 }]}>
          <View style={styles.posterWrap}>
            {poster ? <Image source={{ uri: poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Ionicons name="albums" size={40} color={colors.textDim} />}
          </View>
          <View style={{ flex: 1, justifyContent: "flex-end", gap: 6 }}>
            <Text style={styles.title}>{title}</Text>
            {!!(meta.releaseDate || base?.releaseDate) && <Text style={styles.metaLine}><Text style={styles.metaKey}>Ano: </Text>{String(meta.releaseDate || base?.releaseDate).slice(0, 4)}</Text>}
            {!!(meta.genre || base?.genre) && <Text style={styles.metaLine} numberOfLines={1}><Text style={styles.metaKey}>Gênero: </Text>{meta.genre || base?.genre}</Text>}
            {!!meta.rating && <Text style={styles.metaLine}><Text style={styles.metaKey}>Avaliação: </Text>{String(meta.rating)}</Text>}
            <Pressable testID="series-fav" onPress={() => toggleFav("series", String(id))} style={({ focused }) => [styles.favBtn, focused && styles.focused]}>
              <Ionicons name={fav ? "star" : "star-outline"} size={16} color={colors.gold} />
              <Text style={styles.favText}>{fav ? "FAVORITO" : "FAVORITAR"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <View style={styles.body}>
        {!!meta.plot && <Text style={styles.plot} numberOfLines={5}>{meta.plot}</Text>}
        {seasons.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} style={{ marginTop: spacing.sm }}>
            {seasons.map((s) => (
              <Pressable key={s} testID={`season-${s}`} onPress={() => setSeason(s)} style={({ focused }) => [styles.chip, season === s && styles.chipActive, focused && styles.focused]}>
                <Text style={[styles.chipText, season === s && { color: colors.onGold }]}>Temporada {s}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.root} testID="series-details">
      {loading ? (
        <>{Header}<ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} /></>
      ) : (
        <FlatList
          data={episodes}
          keyExtractor={(e) => String(e.id)}
          ListHeaderComponent={Header}
          ListEmptyComponent={<Text style={styles.hint}>{error || "Nenhum episódio disponível nesta temporada."}</Text>}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
          renderItem={({ item: ep, index }) => {
            const p = progress[`ep:${ep.id}`];
            const pct = p && p.duration > 0 ? p.position / p.duration : 0;
            return (
              <Pressable testID={`episode-${ep.id}`} onPress={() => playEpisode(index)} style={({ focused }) => [styles.epRow, focused && styles.focused]}>
                <View style={styles.epThumb}>
                  {ep.info?.movie_image ? <Image source={{ uri: ep.info.movie_image }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Ionicons name="play-circle" size={26} color={colors.textDim} />}
                  {pct > 0.01 && <View style={styles.progTrack}><View style={[styles.progFill, { width: `${Math.min(100, pct * 100)}%` }]} /></View>}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.epTitle} numberOfLines={1}>{ep.episode_num}. {ep.title || `Episódio ${ep.episode_num}`}</Text>
                  {!!ep.info?.duration && <Text style={styles.epMeta}>{ep.info.duration}</Text>}
                  {!!ep.info?.plot && <Text style={styles.epPlot} numberOfLines={2}>{ep.info.plot}</Text>}
                </View>
                <View style={styles.epPlay}><Ionicons name="play" size={16} color={colors.onGold} /></View>
              </Pressable>
            );
          }}
          initialNumToRender={10}
          windowSize={5}
        />
      )}
      <Pressable testID="series-back" onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + 8 }]} hitSlop={10}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { minHeight: 300, overflow: "hidden" },
  heroRow: { flexDirection: "row", gap: spacing.lg, padding: spacing.lg },
  posterWrap: { width: 130, aspectRatio: 2 / 3, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(212,175,55,0.4)" },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  metaLine: { color: colors.textMuted, fontSize: 13 },
  metaKey: { color: colors.gold, fontWeight: "600" },
  favBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 12, height: 34, marginTop: 4 },
  favText: { color: colors.gold, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  focused: { borderWidth: 2, borderColor: colors.gold },
  body: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
  plot: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  chip: { height: 34, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  epRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  epThumb: { width: 96, aspectRatio: 16 / 9, borderRadius: radius.sm, backgroundColor: "#000", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  epTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
  epMeta: { color: colors.gold, fontSize: 11 },
  epPlot: { color: colors.textDim, fontSize: 11, lineHeight: 15 },
  epPlay: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  progTrack: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: "rgba(255,255,255,0.2)" },
  progFill: { height: 3, backgroundColor: colors.gold },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: "center", padding: spacing.xl },
  backBtn: { position: "absolute", left: spacing.md, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
});
