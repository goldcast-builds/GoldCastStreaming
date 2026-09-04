import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { GoldButton } from "../../src/components/GoldButton";
import { colors, radius, spacing } from "../../src/utils/theme";
import { useSession } from "../../src/store/session";
import { movieUrls, xtream } from "../../src/services/xtream";

export default function MovieDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const base = useSession((s) => s.catalog.vod.find((v) => String(v.stream_id) === String(id)));
  const fav = useSession((s) => s.ud.favorites.vod.includes(String(id)));
  const toggleFav = useSession((s) => s.toggleFav);
  const setQueue = useSession((s) => s.setQueue);
  const progress = useSession((s) => s.ud.progress[`vod:${id}`]);
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || !id) return;
    let cancelled = false;
    setLoading(true);
    xtream.vodInfo(session, id).then((d) => !cancelled && setInfo(d)).catch(() => {}).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [session?.server, id]);

  const meta = info?.info || {};
  const data = info?.movie_data || {};
  const title = data.name || base?.name || "Filme";
  const poster = meta.movie_image || meta.cover_big || base?.stream_icon;
  const ext = data.container_extension || base?.container_extension;
  const year = (meta.releasedate || meta.release_date || base?.year || "").toString().slice(0, 4) || null;
  const rows = useMemo(() => [
    ["Ano", year],
    ["Gênero", meta.genre || base?.genre],
    ["Duração", meta.duration],
    ["Avaliação", meta.rating ? String(meta.rating) : null],
    ["Direção", meta.director],
    ["Elenco", meta.cast],
  ].filter(([, v]) => !!v) as [string, string][], [meta, year, base]);

  const play = () => {
    if (!session) return;
    setQueue([{
      kind: "vod", id: String(id), title, subtitle: meta.genre || base?.genre, logo: poster, urls: movieUrls(session, id!, ext), progressKey: `vod:${id}`,
      raw: base || { stream_id: Number(id), name: title, stream_icon: poster },
    }], 0);
    router.push("/player");
  };

  const pct = progress && progress.duration > 0 ? progress.position / progress.duration : 0;

  return (
    <View style={styles.root} testID="movie-details">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={styles.hero}>
          {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={12} /> : null}
          <LinearGradient colors={["rgba(0,0,0,0.3)", colors.bg]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroRow, { paddingTop: insets.top + spacing.sm }]}>
            <View style={styles.posterWrap}>
              {poster ? <Image source={{ uri: poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Ionicons name="film" size={40} color={colors.textDim} />}
            </View>
            <View style={{ flex: 1, justifyContent: "flex-end", gap: 6 }}>
              <Text style={styles.title}>{title}</Text>
              {rows.slice(0, 3).map(([k, v]) => <Text key={k} style={styles.metaLine} numberOfLines={1}><Text style={styles.metaKey}>{k}: </Text>{v}</Text>)}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {pct > 0.01 && pct < 0.97 && (
            <View style={styles.progressBox} testID="movie-progress">
              <Text style={styles.progressText}>Continuar assistindo · {Math.round(pct * 100)}%</Text>
              <View style={styles.progTrack}><View style={[styles.progFill, { width: `${pct * 100}%` }]} /></View>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <GoldButton testID="movie-play" label={pct > 0.01 && pct < 0.97 ? "CONTINUAR" : "ASSISTIR"} icon={<Ionicons name="play" size={18} color={colors.onGold} />} onPress={play} style={{ flex: 1 }} />
            <Pressable testID="movie-fav" onPress={() => toggleFav("vod", String(id))} style={({ focused }) => [styles.favBtn, focused && styles.focused]}>
              <Ionicons name={fav ? "star" : "star-outline"} size={22} color={colors.gold} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
          ) : (
            <>
              {!!meta.plot && (<><Text style={styles.sectionTitle}>Sinopse</Text><Text style={styles.plot}>{meta.plot}</Text></>)}
              {rows.length > 0 && (
                <View style={styles.infoCard}>
                  {rows.map(([k, v]) => (
                    <View key={k} style={styles.infoRow}><Text style={styles.infoKey}>{k}</Text><Text style={styles.infoVal}>{v}</Text></View>
                  ))}
                </View>
              )}
              {!meta.plot && rows.length === 0 && <Text style={styles.hint}>Informações adicionais não informadas pelo servidor.</Text>}
            </>
          )}
        </View>
      </ScrollView>
      <Pressable testID="movie-back" onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + 8 }]} hitSlop={10}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { minHeight: 300, overflow: "hidden" },
  heroRow: { flexDirection: "row", gap: spacing.lg, padding: spacing.lg, paddingTop: 60 },
  posterWrap: { width: 130, aspectRatio: 2 / 3, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(212,175,55,0.4)" },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  metaLine: { color: colors.textMuted, fontSize: 13 },
  metaKey: { color: colors.gold, fontWeight: "600" },
  body: { padding: spacing.lg, gap: spacing.md },
  progressBox: { gap: 6 },
  progressText: { color: colors.textMuted, fontSize: 12 },
  progTrack: { height: 4, backgroundColor: colors.surface3, borderRadius: 2 },
  progFill: { height: 4, backgroundColor: colors.gold, borderRadius: 2 },
  favBtn: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: colors.gold, alignItems: "center", justifyContent: "center" },
  focused: { borderWidth: 2, borderColor: colors.text },
  sectionTitle: { color: colors.gold, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginTop: spacing.sm },
  plot: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  infoCard: { backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  infoRow: { flexDirection: "row", gap: spacing.md },
  infoKey: { color: colors.textDim, width: 90, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 },
  infoVal: { color: colors.text, fontSize: 13, flex: 1 },
  hint: { color: colors.textDim, fontSize: 12, fontStyle: "italic" },
  backBtn: { position: "absolute", left: spacing.md, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
});
