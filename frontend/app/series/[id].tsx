import { TrailerPreviewBox } from "../../src/components/TrailerPreviewBox";
import { MovieMetadataPanel } from "../../src/components/MovieMetadataPanel";
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius, spacing } from "../../src/utils/theme";
import { PlayItem, useSession } from "../../src/store/session";
import { Episode, episodeUrls, xtream } from "../../src/services/xtream";
import { fetchStrictMediaEnrichment, StrictMediaEnrichment } from "../../src/services/tmdb";

export default function SeriesDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const base = useSession((s) =>
    s.catalog.series.find((v) => String(v.series_id) === String(id))
  );
  const fav = useSession((s) => s.ud.favorites.series.includes(String(id)));
  const toggleFav = useSession((s) => s.toggleFav);
  const addRecent = useSession((s) => s.addRecent);
  const setQueue = useSession((s) => s.setQueue);
  const progress = useSession((s) => s.ud.progress);

  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [enrichment, setEnrichment] = useState<StrictMediaEnrichment | null>(null);
  const [selectedBackdrop, setSelectedBackdrop] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEnrichment(null);
    setSelectedBackdrop(null);

    xtream
      .seriesInfo(session, id)
      .then((d) => {
        if (cancelled) return;
        setInfo(d);
        const keys = Object.keys(d?.episodes || {});
        setSeason(keys[0] ?? null);
      })
      .catch((e) => !cancelled && setError(e?.message || "Falha ao carregar série."))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [session?.server, id]);

  const meta = info?.info || {};
  const title = meta.name || base?.name || "Série";
  const poster = meta.cover || base?.cover;
  const seriesYear =
    String(meta.releaseDate || meta.release_date || base?.releaseDate || "").slice(0, 4) ||
    null;

  useEffect(() => {
    if (!info) return;
    let active = true;
    fetchStrictMediaEnrichment("tv", meta, title, seriesYear).then((res) => {
      if (active) setEnrichment(res);
    });
    return () => {
      active = false;
    };
  }, [info, meta, title, seriesYear]);

  const activeHeroBg = selectedBackdrop || enrichment?.backdropUrl || poster;

  const seasons: string[] = useMemo(
    () => Object.keys(info?.episodes || {}).sort((a, b) => Number(a) - Number(b)),
    [info]
  );
  const episodes: Episode[] = useMemo(
    () => (season && info?.episodes?.[season]) || [],
    [info, season]
  );

  const seriesScenes = useMemo(() => {
    const fromEpisodes = episodes
      .map((ep) => ep?.info?.movie_image)
      .filter((u): u is string => typeof u === "string" && u.length > 4);
    const uniqueEpisodes = [...new Set(fromEpisodes)].slice(0, 6);
    const fromTmdb = enrichment?.gallery || [];
    return [...new Set([...fromTmdb, ...uniqueEpisodes])].slice(0, 8);
  }, [episodes, enrichment]);

  const playEpisode = (index: number) => {
    if (!session) return;
    const items: PlayItem[] = episodes.map((ep) => ({
      kind: "series",
      id: String(ep.id),
      title: `T${season} E${ep.episode_num} · ${ep.title || "Episódio " + ep.episode_num}`,
      subtitle: title,
      logo: ep.info?.movie_image || poster,
      urls: episodeUrls(session, ep.id, ep.container_extension),
      progressKey: `ep:${ep.id}`,
      favKind: "series",
      favId: String(id),
      raw: base || { series_id: Number(id), name: title, cover: poster },
    }));
    addRecent("series", base || { series_id: Number(id), name: title, cover: poster });
    setQueue(items, index);
    router.push("/player");
  };

  const Header = (
    <View>
      <View style={styles.hero}>
        {activeHeroBg ? (
          <Image
            source={{ uri: activeHeroBg }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={selectedBackdrop ? 2 : 9}
            cachePolicy="memory-disk"
          />
        ) : null}
        <LinearGradient colors={["rgba(0,0,0,0.35)", colors.bg]} style={StyleSheet.absoluteFill} />

        {/* PAINEL DE AVALIAÇÕES E TRAILER NO TOPO */}
        <View style={styles.topWidgetsLayer}>
          <MovieMetadataPanel title={title} />
          <TrailerPreviewBox title={title} />
        </View>

        <View style={[styles.heroRow, { paddingTop: Math.max(insets.top + 88, 106) }]}>
          <View style={styles.posterWrap}>
            {poster ? (
              <Image
                source={{ uri: poster }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <Ionicons name="albums" size={40} color={colors.textDim} />
            )}
          </View>
          <View style={{ flex: 1, justifyContent: "flex-end", gap: 6, zIndex: 3 }}>
            <Text style={styles.title}>{title}</Text>
            {!!(meta.releaseDate || base?.releaseDate) && (
              <Text style={styles.metaLine}>
                <Text style={styles.metaKey}>Ano: </Text>
                {String(meta.releaseDate || base?.releaseDate).slice(0, 4)}
              </Text>
            )}
            {!!(meta.genre || base?.genre) && (
              <Text style={styles.metaLine} numberOfLines={1}>
                <Text style={styles.metaKey}>Gênero: </Text>
                {meta.genre || base?.genre}
              </Text>
            )}
            {!!meta.rating && (
              <Text style={styles.metaLine}>
                <Text style={styles.metaKey}>Avaliação: </Text>
                {String(meta.rating)}
              </Text>
            )}

            <TVSeriesFavBtn fav={fav} onPress={() => toggleFav("series", String(id))} />
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {!!meta.plot && (
          <Text style={styles.plot} numberOfLines={5}>
            {meta.plot}
          </Text>
        )}

        {/* CENAS DA SÉRIE (ALTERA O PLANO DE FUNDO AO FOCAR/TOCAR) */}
        {seriesScenes.length > 0 && (
          <View style={{ gap: 6, marginTop: spacing.xs }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Cenas da Série</Text>
              {selectedBackdrop && (
                <Pressable
                  focusable={true}
                  accessible={true}
                  onPress={() => setSelectedBackdrop(null)}
                  style={({ focused }) => [
                    styles.resetBgBtn,
                    focused && { borderColor: "#FFD700", borderWidth: 1.5 },
                  ]}
                >
                  <Text style={styles.resetBgText}>Restaurar fundo</Text>
                </Pressable>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
            >
              {seriesScenes.map((sceneUrl, idx) => {
                const isCurrent = selectedBackdrop === sceneUrl;
                return (
                  <Pressable
                    key={`sr-scene-${idx}`}
                    focusable={true}
                    accessible={true}
                    onFocus={() => setSelectedBackdrop(sceneUrl)}
                    onPress={() => setSelectedBackdrop(sceneUrl)}
                    style={({ focused }) => [
                      styles.sceneCard,
                      isCurrent && styles.sceneCardActive,
                      focused && styles.sceneCardFocused,
                    ]}
                  >
                    <Image
                      source={{ uri: sceneUrl }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ELENCO VALIDADO */}
        {enrichment?.cast && enrichment.cast.length > 0 && (
          <View style={{ gap: 6, marginTop: spacing.xs }}>
            <Text style={styles.sectionTitle}>Elenco</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
            >
              {enrichment.cast.map((actor) => (
                <View key={`sr-actor-${actor.id}`} style={styles.actorCard}>
                  {actor.profileUrl ? (
                    <Image
                      source={{ uri: actor.profileUrl }}
                      style={styles.actorAvatar}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={[styles.actorAvatar, styles.actorAvatarFallback]}>
                      <Ionicons name="person" size={20} color={colors.textDim} />
                    </View>
                  )}
                  <Text style={styles.actorName} numberOfLines={1}>
                    {actor.name}
                  </Text>
                  {!!actor.character && (
                    <Text style={styles.actorRole} numberOfLines={1}>
                      {actor.character}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* SELETOR DE TEMPORADAS */}
        {seasons.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
            style={{ marginTop: spacing.sm, paddingVertical: 4 }}
          >
            {seasons.map((s) => (
              <SeasonChipItem
                key={s}
                seasonName={s}
                active={season === s}
                onSelect={() => setSeason(s)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.root} testID="series-details">
      {loading ? (
        <>
          {Header}
          <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
        </>
      ) : (
        <FlatList
          data={episodes}
          keyExtractor={(e) => String(e.id)}
          ListHeaderComponent={Header}
          ListEmptyComponent={
            <Text style={styles.hint}>
              {error || "Nenhum episódio disponível nesta temporada."}
            </Text>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
          renderItem={({ item: ep, index }) => {
            const p = progress[`ep:${ep.id}`];
            const pct = p && p.duration > 0 ? p.position / p.duration : 0;
            return (
              <TVEpisodeRowItem
                ep={ep}
                pct={pct}
                index={index}
                onPress={() => playEpisode(index)}
              />
            );
          }}
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews={false}
        />
      )}

      {/* BOTÃO VOLTAR */}
      <TVBackButton onPress={() => router.back()} top={insets.top + 8} />
    </View>
  );
}

function TVSeriesFavBtn({ fav, onPress }: { fav: boolean; onPress: () => void }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      accessible={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[styles.favBtn, fav && styles.favBtnActive, isFocused && styles.favBtnFocused]}
    >
      <Ionicons
        name={fav ? "star" : "star-outline"}
        size={16}
        color={isFocused ? "#000000" : colors.gold}
      />
      <Text style={[styles.favText, isFocused && { color: "#000000", fontWeight: "900" }]}>
        {fav ? "FAVORITO" : "FAVORITAR"}
      </Text>
    </Pressable>
  );
}

function SeasonChipItem({
  seasonName,
  active,
  onSelect,
}: {
  seasonName: string;
  active: boolean;
  onSelect: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      accessible={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onSelect}
      style={[styles.chip, active && styles.chipActive, isFocused && styles.chipFocused]}
    >
      <Text
        style={[
          styles.chipText,
          (active || isFocused) && { color: "#000000", fontWeight: "900" },
        ]}
      >
        Temporada {seasonName}
      </Text>
    </Pressable>
  );
}

function TVEpisodeRowItem({
  ep,
  pct,
  index,
  onPress,
}: {
  ep: Episode;
  pct: number;
  index: number;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      accessible={true}
      hasTVPreferredFocus={index === 0}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[styles.epRow, isFocused && styles.epRowFocused]}
    >
      <View style={styles.epThumb}>
        {ep.info?.movie_image ? (
          <Image
            source={{ uri: ep.info.movie_image }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <Ionicons
            name="play-circle"
            size={26}
            color={isFocused ? colors.gold : colors.textDim}
          />
        )}
        {pct > 0.01 && (
          <View style={styles.progTrack}>
            <View style={[styles.progFill, { width: `${Math.min(100, pct * 100)}%` }]} />
          </View>
        )}
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[styles.epTitle, isFocused && { color: "#FFFFFF", fontWeight: "900" }]}
          numberOfLines={1}
        >
          {ep.episode_num}. {ep.title || `Episódio ${ep.episode_num}`}
        </Text>
        {!!ep.info?.duration && (
          <Text style={[styles.epMeta, isFocused && { color: "#FFD700" }]}>
            {ep.info.duration}
          </Text>
        )}
        {!!ep.info?.plot && (
          <Text style={styles.epPlot} numberOfLines={2}>
            {ep.info.plot}
          </Text>
        )}
      </View>

      <View style={[styles.epPlay, isFocused && styles.epPlayFocused]}>
        <Ionicons name="play" size={16} color={isFocused ? "#000000" : colors.onGold} />
      </View>
    </Pressable>
  );
}

function TVBackButton({ onPress, top }: { onPress: () => void; top: number }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      accessible={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      hitSlop={10}
      style={[styles.backBtn, { top }, isFocused && styles.backBtnFocused]}
    >
      <Ionicons name="chevron-back" size={22} color={isFocused ? "#000000" : colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { minHeight: 320, overflow: "hidden" },
  topWidgetsLayer: { zIndex: 2 },
  heroRow: { flexDirection: "row", gap: spacing.lg, padding: spacing.lg, paddingTop: 106, zIndex: 3 },
  posterWrap: {
    width: 130,
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(212,175,55,0.4)",
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  metaLine: { color: colors.textMuted, fontSize: 13 },
  metaKey: { color: colors.gold, fontWeight: "600" },
  favBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    height: 36,
    marginTop: 4,
  },
  favBtnActive: { backgroundColor: "rgba(229, 169, 59, 0.2)" },
  favBtnFocused: {
    backgroundColor: "#FFD700",
    borderColor: "#FFFFFF",
    borderWidth: 2.5,
    transform: [{ scale: 1.08 }],
    elevation: 10,
  },
  favText: { color: colors.gold, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  body: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
  plot: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  resetBgBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  resetBgText: { color: colors.textMuted, fontSize: 10.5, fontWeight: "700" },
  sceneCard: {
    width: 132,
    height: 74,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  sceneCardActive: { borderColor: colors.gold },
  sceneCardFocused: {
    borderColor: "#FFD700",
    borderWidth: 3,
    transform: [{ scale: 1.05 }],
  },
  actorCard: { width: 86, alignItems: "center", gap: 4 },
  actorAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.surface2,
  },
  actorAvatarFallback: { alignItems: "center", justifyContent: "center" },
  actorName: { color: colors.text, fontSize: 11, fontWeight: "700", textAlign: "center" },
  actorRole: { color: colors.textDim, fontSize: 9.5, textAlign: "center" },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: "rgba(229, 169, 59, 0.3)", borderColor: colors.gold },
  chipFocused: {
    backgroundColor: "#FFD700",
    borderColor: "#FFFFFF",
    borderWidth: 2,
    transform: [{ scale: 1.08 }],
    elevation: 8,
  },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  epRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  epRowFocused: {
    borderColor: "#FFD700",
    borderWidth: 3.5,
    backgroundColor: "#202534",
    transform: [{ scale: 1.03 }],
    elevation: 14,
    zIndex: 99,
  },
  epThumb: {
    width: 96,
    aspectRatio: 16 / 9,
    borderRadius: radius.sm,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  epTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
  epMeta: { color: colors.gold, fontSize: 11 },
  epPlot: { color: colors.textDim, fontSize: 11, lineHeight: 15 },
  epPlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  epPlayFocused: { backgroundColor: "#FFD700", borderColor: "#FFFFFF", transform: [{ scale: 1.15 }] },
  progTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  progFill: { height: 3, backgroundColor: colors.gold },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: "center", padding: spacing.xl },
  backBtn: {
    position: "absolute",
    left: spacing.md,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  backBtnFocused: {
    backgroundColor: "#FFD700",
    borderColor: "#FFFFFF",
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
    elevation: 14,
    zIndex: 999,
  },
});
