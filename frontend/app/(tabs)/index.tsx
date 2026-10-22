import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, radius, spacing } from "../../src/utils/theme";
import { useSession } from "../../src/store/session";
import { xtream, LiveStream } from "../../src/services/xtream";
import { liveUrls } from "../../src/services/xtream";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function HomeTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const source = useSession((s) => s.source);
  const setSource = useSession((s) => s.setSource);
  const catalog = useSession((s) => s.catalog);
  const loadVod = useSession((s) => s.loadVod);
  const loadSeries = useSession((s) => s.loadSeries);
  const setQueue = useSession((s) => s.setQueue);
  const liveFormat = useSession((s) => s.prefs.liveFormat);

  const [cachedChannels, setCachedChannels] = useState<LiveStream[]>([]);
  const [activationCode, setActivationCode] = useState<string>("LICENÇA ATIVA");
  const [searchQuery, setSearchQuery] = useState("");

  const { username, expFormatted } = useMemo(() => {
    const user = session?.userInfo?.username || session?.username || "Cliente";
    const exp = session?.userInfo?.exp_date;
    if (!exp) return { username: user, expFormatted: "Ilimitado" };
    const ts = Number(exp);
    if (!ts || isNaN(ts)) return { username: user, expFormatted: "Indisponível" };
    const expDate = new Date(ts * 1000);
    const expFormatted = expDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    });
    return { username: user, expFormatted };
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      AsyncStorage.getItem("@goldcast_saved_code").then((code) => { if (code && isMounted) setActivationCode(code); });

      if (session) {
        if (loadVod) loadVod(true).catch(() => {});
        if (loadSeries) loadSeries(true).catch(() => {});
      }
      return () => { isMounted = false; };
    }, [session, loadVod, loadSeries])
  );

  // Carregamento geral destravado de canais ao vivo
  useEffect(() => {
    if (!session) return;
    let active = true;
    (async () => {
      try {
        const streams: LiveStream[] = await xtream.liveStreams(session);
        if (active && streams.length > 0) setCachedChannels(streams);
      } catch {}
    })();
    return () => { active = false; };
  }, [session]);

  const handlePlayLiveChannel = (ch: LiveStream, index: number) => {
    if (session && source?.kind !== "list") setSource({ kind: "xtream" });
    const urls = liveUrls(session, ch.stream_id, liveFormat === "auto" ? undefined : liveFormat);

    const items: PlayItem[] = cachedChannels.map((c) => ({
      kind: "live",
      id: String(c.stream_id),
      title: c.name,
      subtitle: "Geral",
      logo: c.stream_icon,
      urls: liveUrls(session, c.stream_id, liveFormat === "auto" ? undefined : liveFormat),
      streamId: c.stream_id,
      raw: c,
    }));
    setQueue(items, index);

    router.push({
      pathname: "/player",
      params: {
        url: urls?.[0] || "",
        streamUrl: urls?.[0] || "",
        title: ch.name || "Canal",
        name: ch.name || "",
        id: String(ch.stream_id),
        stream_id: String(ch.stream_id),
        type: "live",
      },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.layoutRoot}>
        {/* MENU LATERAL ESQUERDO UNIFICADO (COM EPG / GUIA DE PROGRAMAÇÃO) */}
        <View style={styles.sidebar}>
          <Pressable onPress={() => router.push("/(tabs)")} style={[styles.sidebarIconBtn, { backgroundColor: colors.gold }]} focusable={true}>
            <Ionicons name="home" size={20} color="#000" />
          </Pressable>

          <Pressable onPress={() => router.push("/(tabs)/live")} style={styles.sidebarIconBtn} focusable={true}>
            <Ionicons name="tv" size={20} color="#FFF" />
          </Pressable>

          <Pressable onPress={() => router.push("/(tabs)/movies")} style={styles.sidebarIconBtn} focusable={true}>
            <Ionicons name="film" size={20} color="#FFF" />
          </Pressable>

          <Pressable onPress={() => router.push("/(tabs)/series")} style={styles.sidebarIconBtn} focusable={true}>
            <Ionicons name="albums" size={20} color="#FFF" />
          </Pressable>

          {/* GUIA DE PROGRAMAÇÃO (EPG) */}
          <Pressable onPress={() => router.push("/(tabs)/live")} style={styles.sidebarIconBtn} focusable={true} title="Guia de Programação EPG">
            <Ionicons name="calendar" size={20} color="#FFF" />
          </Pressable>

          <View style={{ flex: 1 }} />

          <Pressable onPress={() => router.replace("/login")} style={styles.sidebarExitBtn} focusable={true}>
            <Ionicons name="exit-outline" size={16} color="#EF4444" />
            <Text style={styles.sidebarExitText}>SAIR</Text>
          </Pressable>
        </View>

        {/* ÁREA PRINCIPAL DA DIREITA */}
        <View style={styles.mainContent}>
          <View style={styles.topBar}>
            <View style={{ gap: 2 }}>
              <Text style={styles.headerTitle}>GOLDCAST STREAMING</Text>
              <View style={styles.rowAlign}>
                <View style={styles.userInfoBadge}>
                  <Ionicons name="person-circle" size={13} color={colors.gold} />
                  <Text style={styles.userInfoText}>{username}</Text>
                </View>
                <View style={styles.userInfoBadge}>
                  <Ionicons name="key" size={12} color="#000" />
                  <Text style={[styles.userInfoText, { color: "#000", fontWeight: "900" }]}>{activationCode}</Text>
                </View>
                <View style={styles.userInfoBadge}>
                  <Ionicons name="time" size={12} color={colors.textDim} />
                  <Text style={styles.userInfoText}>Exp: {expFormatted}</Text>
                </View>
              </View>
            </View>

            <Pressable onPress={() => router.push("/(tabs)/settings")} style={styles.settingsBtn} focusable={true}>
              <Ionicons name="settings-outline" size={20} color={colors.gold} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 50 }}>
            {/* Banner Destaque Filmes */}
            {catalog.vod?.length > 0 && (
              <Pressable
                focusable={true}
                onPress={() => router.push({ pathname: "/movie/[id]", params: { id: String(catalog.vod[0].stream_id) } })}
                style={styles.heroBanner}
              >
                <Image source={{ uri: catalog.vod[0].stream_icon }} style={styles.fullSize} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                <View style={styles.heroOverlay}>
                  <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>⭐ DESTAQUE</Text></View>
                  <Text style={styles.heroTitle} numberOfLines={1}>{catalog.vod[0].name}</Text>
                </View>
              </Pressable>
            )}

            {/* Carrossel de Filmes */}
            {catalog.vod?.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={styles.sectionLabel}>🎬 FILMES RECENTES</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.postersRow}>
                  {catalog.vod.slice(0, 12).map((item) => (
                    <Pressable
                      key={item.stream_id}
                      focusable={true}
                      onPress={() => router.push({ pathname: "/movie/[id]", params: { id: String(item.stream_id) } })}
                      style={styles.posterCard}
                    >
                      <Image source={{ uri: item.stream_icon }} style={styles.fullSize} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                      <View style={styles.posterGradient}>
                        <Text style={styles.posterTitle} numberOfLines={2}>{item.name}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Carrossel de Séries */}
            {catalog.series?.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={styles.sectionLabel}>🍿 SÉRIES RECENTES</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.postersRow}>
                  {catalog.series.slice(0, 12).map((s) => (
                    <Pressable
                      key={s.series_id}
                      focusable={true}
                      onPress={() => router.push({ pathname: "/series/[id]", params: { id: String(s.series_id) } })}
                      style={styles.posterCard}
                    >
                      <Image source={{ uri: s.cover }} style={styles.fullSize} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                      <View style={styles.posterGradient}>
                        <Text style={styles.posterTitle} numberOfLines={2}>{s.name}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Canais ao Vivo */}
            <View style={{ gap: 8 }}>
              <Text style={styles.sectionLabel}>📺 CANAIS AO VIVO EM DESTAQUE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {cachedChannels.slice(0, 12).map((ch, idx) => (
                  <Pressable
                    key={ch.stream_id}
                    focusable={true}
                    onPress={() => handlePlayLiveChannel(ch, idx)}
                    style={styles.liveThumbCard}
                  >
                    {ch.stream_icon ? (
                      <Image source={{ uri: ch.stream_icon }} style={styles.fullSize} contentFit="contain" cachePolicy="memory-disk" transition={200} />
                    ) : (
                      <Ionicons name="tv" size={28} color="#FFF" />
                    )}
                    <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>AO VIVO</Text></View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  layoutRoot: { flex: 1, flexDirection: "row" },
  sidebar: { width: 72, paddingVertical: 18, alignItems: "center", justifyContent: "flex-start", gap: 14, borderRightWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "#12141C" },
  sidebarIconBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  sidebarExitBtn: { alignItems: "center", gap: 2, paddingBottom: 10 },
  sidebarExitText: { color: "#EF4444", fontSize: 8, fontWeight: "900" },

  mainContent: { flex: 1, paddingHorizontal: 16, paddingTop: 14, gap: 14 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 0.6, color: colors.gold },
  rowAlign: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  userInfoBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  userInfoText: { color: "#FFF", fontSize: 9.5, fontWeight: "700" },
  settingsBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },

  heroBanner: { width: "100%", height: 150, borderRadius: 16, overflow: "hidden", position: "relative", backgroundColor: "#1A1D29" },
  heroOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.82)", padding: 12, gap: 4 },
  heroBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start", backgroundColor: colors.gold },
  heroBadgeText: { color: "#000", fontSize: 8.5, fontWeight: "900" },
  heroTitle: { color: "#FFF", fontSize: 15, fontWeight: "900" },

  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, color: colors.gold },
  postersRow: { gap: 12, paddingVertical: 2 },
  posterCard: { width: 120, height: 180, borderRadius: 14, overflow: "hidden", position: "relative", backgroundColor: "#1A1D29" },
  posterGradient: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.8)", padding: 6 },
  posterTitle: { color: "#FFF", fontSize: 10.5, fontWeight: "900" },

  liveThumbCard: { width: 105, height: 68, borderRadius: 10, backgroundColor: "#1E293B", overflow: "hidden", position: "relative", alignItems: "center", justifyContent: "center" },
  liveBadge: { position: "absolute", top: 3, left: 3, backgroundColor: "#EF4444", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  liveBadgeText: { color: "#FFF", fontSize: 6.5, fontWeight: "900" },

  fullSize: { width: "100%", height: "100%" },
});
