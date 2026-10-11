import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Animated, Easing, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { TrendingMarquee, MarqueeItem } from "../../src/components/TrendingMarquee";
import { colors, radius, spacing } from "../../src/utils/theme";
import { listLists } from "../../src/utils/api";
import { useSession } from "../../src/store/session";
import { xtream, LiveStream, Category } from "../../src/services/xtream";

const MAIN = [
  { key: "live", label: "TV AO VIVO", sub: "Canais em tempo real", icon: "tv", path: "/(tabs)/live" },
  { key: "movies", label: "FILMES", sub: "Catálogo On-Demand", icon: "film", path: "/(tabs)/movies" },
  { key: "series", label: "SÉRIES", sub: "Temporadas completas", icon: "albums", path: "/(tabs)/series" },
] as const;

export default function HomeTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const source = useSession((s) => s.source);
  const setSource = useSession((s) => s.setSource);
  const catalog = useSession((s) => s.catalog);
  const loadVod = useSession((s) => s.loadVod);
  const progressMap = useSession((s) => s.ud?.progress);
  const setQueue = useSession((s) => (s as any).setQueue);
  const setQueueIndex = useSession((s) => s.setQueueIndex);

  const [hasLists, setHasLists] = useState(false);
  const [jogosChannels, setJogosChannels] = useState<LiveStream[]>([]);
  const [jogosCatId, setJogosCatId] = useState<string | null>(null);

  const blinkAnim = useRef(new Animated.Value(1)).current;

  // Localiza o último filme ou série em andamento
  const resumeItem = useMemo(() => {
    if (!progressMap) return null;
    const list = Object.values(progressMap).filter(
      (p: any) => p && p.duration > 60 && p.position > 25 && p.position < p.duration - 40
    );
    if (!list.length) return null;
    const latest: any = list[list.length - 1];
    const pct = Math.min(100, Math.round((latest.position / latest.duration) * 100));
    return { ...latest, pct };
  }, [progressMap]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    (async () => {
      try {
        const categories: Category[] = await xtream.liveCategories(session);
        const catJogos = categories.find((c) => /jogos?\s*do\s*dia/i.test(c.category_name));
        if (catJogos) {
          if (active) setJogosCatId(catJogos.category_id);
          const streams: LiveStream[] = await xtream.liveStreams(session, catJogos.category_id);
          if (active && streams.length > 0) setJogosChannels(streams);
        }
      } catch {}
    })();
    return () => { active = false; };
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      listLists().then((l) => setHasLists(l.length > 0)).catch(() => {});
      if (source?.kind === "xtream" && !catalog.vodLoaded) loadVod();
    }, [source?.kind, catalog.vodLoaded, loadVod])
  );

  const hasContent = !!session || hasLists;

  const { username, expFormatted, daysLeft, isExpired } = useMemo(() => {
    const user = session?.userInfo?.username || session?.username || "Cliente";
    const exp = session?.userInfo?.exp_date;
    if (!exp) return { username: user, expFormatted: "Ilimitado", daysLeft: 999, isExpired: false };
    const ts = Number(exp);
    if (!ts || isNaN(ts)) return { username: user, expFormatted: "Indisponível", daysLeft: 0, isExpired: false };
    const expDate = new Date(ts * 1000);
    const expFormatted = expDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
    const diffMs = expDate.getTime() - Date.now();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return { username: user, expFormatted, daysLeft, isExpired: daysLeft <= 0 };
  }, [session]);

  useEffect(() => {
    if (isExpired) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, { toValue: 0.25, duration: 650, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(blinkAnim, { toValue: 1, duration: 650, easing: Easing.linear, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      blinkAnim.setValue(1);
    }
  }, [isExpired, blinkAnim]);

  const statusConfig = useMemo(() => {
    if (isExpired || daysLeft <= 1) {
      return {
        color: "#EF4444", bg: "rgba(239, 68, 68, 0.16)", border: "rgba(239, 68, 68, 0.6)",
        text: isExpired ? "PLANO VENCIDO" : daysLeft === 1 ? "1 DIA RESTANTE" : "VENCE HOJE", icon: "alert-circle",
      };
    }
    if (daysLeft >= 2 && daysLeft <= 5) {
      return {
        color: "#F59E0B", bg: "rgba(245, 158, 11, 0.16)", border: "rgba(245, 158, 11, 0.6)",
        text: `${daysLeft} DIAS RESTANTES`, icon: "time",
      };
    }
    return {
      color: "#10B981", bg: "rgba(16, 185, 129, 0.16)", border: "rgba(16, 185, 129, 0.6)",
      text: `${daysLeft} DIAS RESTANTES`, icon: "checkmark-circle",
    };
  }, [daysLeft, isExpired]);

  const marqueeItems: MarqueeItem[] = useMemo(() => {
    if (!catalog.vod?.length) return [];
    return catalog.vod
      .filter((v) => !!v.stream_icon)
      .slice(0, 15)
      .map((v) => ({ id: String(v.stream_id), name: v.name, poster: v.stream_icon, type: "movie" }));
  }, [catalog.vod]);

  const go = async (path: string) => {
    if (session && source?.kind !== "list") await setSource({ kind: "xtream" });
    router.push(path as any);
  };

  const handleOpenChannel = (channel: LiveStream) => {
    if (session && source?.kind !== "list") setSource({ kind: "xtream" });
    router.push({ pathname: "/(tabs)/live", params: { cat: jogosCatId || undefined, channelId: String(channel.stream_id) } });
  };

  const handleResumePlayback = () => {
    if (!resumeItem) return;
    if (resumeItem.item && setQueue) {
      setQueue([resumeItem.item]);
      setQueueIndex(0);
      router.push("/player" as any);
    } else if (resumeItem.item?.id) {
      router.push({ pathname: "/movie/[id]", params: { id: resumeItem.item.id } });
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView 
        style={styles.root} 
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 80 }]} 
        showsVerticalScrollIndicator={false}
      >
        {hasContent ? (
          <View style={styles.mainContainer}>
            
            {/* CONTINUAR ASSISTINDO - FORMATO RETANGULAR PARA CONTROLE REMOTO */}
            {resumeItem && (
              <Pressable
                onPress={handleResumePlayback}
                hasTVPreferredFocus={true}
                style={({ focused, pressed }) => [
                  styles.resumeBanner,
                  focused && styles.resumeBannerFocused,
                  pressed && { opacity: 0.9 }
                ]}
              >
                <View style={styles.resumeThumbBox}>
                  {resumeItem.logo ? (
                    <Image source={{ uri: resumeItem.logo }} style={styles.fullSize} resizeMode="cover" />
                  ) : (
                    <View style={styles.center}><Ionicons name="film" size={28} color={colors.gold} /></View>
                  )}
                  <View style={styles.resumePlayIcon}>
                    <Ionicons name="play" size={16} color={colors.onGold} />
                  </View>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.resumeTag}>CONTINUAR ASSISTINDO</Text>
                  <Text style={styles.resumeTitle} numberOfLines={1}>{resumeItem.title}</Text>
                  <View style={styles.resumeTrack}>
                    <View style={[styles.resumeFill, { width: `${resumeItem.pct}%` }]} />
                  </View>
                  <Text style={styles.resumeSub}>{resumeItem.pct}% assistido • Pressione OK para continuar</Text>
                </View>
                <Ionicons name="play-circle" size={34} color={colors.gold} />
              </Pressable>
            )}

            <Text style={styles.sectionHeader}>O QUE PRETENDE ASSISTIR?</Text>

            {/* BOTÕES LADO A LADO PARA TELA HORIZONTAL */}
            <View style={styles.gridNav}>
              {MAIN.map((m) => (
                <Pressable
                  key={m.key}
                  onPress={() => go(m.path)}
                  hasTVPreferredFocus={!resumeItem && m.key === "live"}
                  style={({ focused, pressed }) => [
                    styles.navCard,
                    focused && styles.navCardFocused,
                    pressed && { transform: [{ scale: 0.98 }] }
                  ]}
                >
                  <View style={styles.navCardIconBox}>
                    <Ionicons name={m.icon as any} size={28} color={colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.navCardTitle}>{m.label}</Text>
                    <Text style={styles.navCardSub}>{m.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
                </Pressable>
              ))}
            </View>

            <View style={styles.quickRow}>
              <SmallTile icon="star-outline" label="Favoritos" onPress={() => router.push({ pathname: "/(tabs)/live", params: { cat: "__fav" } })} />
              <SmallTile icon="person-outline" label="Conta" onPress={() => router.push(session ? "/(tabs)/settings" : "/login")} />
              <SmallTile icon="settings-outline" label="Configurações" onPress={() => router.push("/(tabs)/settings")} />
            </View>

            {jogosChannels.length > 0 && (
              <View style={{ gap: 8 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.sectionTitle}>⚽ JOGOS DO DIA</Text>
                  <View style={styles.badgeLive}>
                    <View style={styles.liveDot} />
                    <Text style={styles.badgeLiveText}>AO VIVO</Text>
                  </View>
                </View>
                <JogosMarqueeReverse channels={jogosChannels} onPressChannel={handleOpenChannel} />
              </View>
            )}

            {marqueeItems.length > 0 && (
              <View style={{ gap: 8 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.sectionTitle}>🔥 NOVIDADES & DESTAQUES</Text>
                  <Text style={styles.badgeTextSmall}>EM ALTA</Text>
                </View>
                <TrendingMarquee items={marqueeItems} onPressItem={(item) => router.push({ pathname: "/movie/[id]", params: { id: item.id } })} />
              </View>
            )}

            {session && (
              <View style={styles.planCard}>
                <View style={styles.rowBetween}>
                  <View style={{ gap: 2 }}>
                    <Text style={styles.planLabel}>USUÁRIO</Text>
                    <View style={styles.rowAlign}>
                      <Ionicons name="person-circle-outline" size={16} color={colors.gold} />
                      <Text style={styles.planVal}>{username}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Text style={styles.planLabel}>VENCIMENTO</Text>
                    <View style={styles.rowAlign}>
                      <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.planVal}>{expFormatted}</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.daysBadge, { backgroundColor: statusConfig.bg, borderColor: statusConfig.border }]}>
                  <Ionicons name={statusConfig.icon as any} size={18} color={statusConfig.color} />
                  <Text style={[styles.daysBadgeText, { color: statusConfig.color }]}>{statusConfig.text}</Text>
                </View>

                {isExpired && (
                  <Animated.View style={[styles.expiredBanner, { opacity: blinkAnim }]}>
                    <Ionicons name="warning" size={20} color="#EF4444" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.expiredTitle}>PLANO EXPIRADO!</Text>
                      <Text style={styles.expiredSub}>Entre em contato com o suporte para renovar seu acesso.</Text>
                    </View>
                  </Animated.View>
                )}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.loggedOutBox}>
            <Text style={styles.brand}>GoldCast Streaming</Text>
            <Text style={styles.hint}>Inicie sessão para carregar a programação.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function JogosMarqueeReverse({ channels, onPressChannel }: { channels: LiveStream[]; onPressChannel: (c: LiveStream) => void }) {
  const STRIDE = 150;
  const totalBaseWidth = Math.max(channels.length, 1) * STRIDE;
  const loopItems = useMemo(() => {
    if (!channels.length) return [];
    return Array(Math.max(4, Math.ceil(8 / channels.length))).fill(channels).flat();
  }, [channels]);

  const anim = useRef(new Animated.Value(-totalBaseWidth)).current;

  useEffect(() => {
    if (!channels.length) return;
    anim.setValue(-totalBaseWidth);
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 0,
        duration: Math.max(totalBaseWidth * 34, 9000),
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [channels.length, totalBaseWidth, anim]);

  return (
    <View style={styles.marqueeOuter}>
      <Animated.View style={[styles.marqueeTrack, { transform: [{ translateX: anim }] }]}>
        {loopItems.map((ch, idx) => (
          <Pressable
            key={`${ch.stream_id}-${idx}`}
            onPress={() => onPressChannel(ch)}
            style={({ focused }) => [styles.channelCard, focused && styles.focusedCard]}
          >
            <View style={styles.posterBox}>
              {ch.stream_icon ? (
                <Image source={{ uri: ch.stream_icon }} style={styles.fullSize} resizeMode="cover" />
              ) : (
                <View style={styles.center}><Text style={{ fontSize: 32 }}>⚽</Text></View>
              )}
              <View style={styles.tagFhd}><Text style={styles.tagFhdText}>AO VIVO</Text></View>
            </View>
            <View style={{ padding: 8, gap: 2 }}>
              <Text style={styles.channelName} numberOfLines={2}>{ch.name}</Text>
              <Text style={styles.channelSub}>JOGOS DO DIA</Text>
            </View>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

function SmallTile({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ focused }) => [styles.tile, focused && styles.tileFocused]}>
      <Ionicons name={icon} size={20} color={colors.gold} />
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl },
  mainContainer: { gap: spacing.md },
  sectionHeader: { color: colors.textDim, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  sectionTitle: { color: colors.gold, fontSize: 13, fontWeight: "800", letterSpacing: 0.8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowAlign: { flexDirection: "row", alignItems: "center", gap: 5 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  fullSize: { width: "100%", height: "100%" },
  badgeTextSmall: { color: colors.gold, fontSize: 10, fontWeight: "800" },
  badgeLive: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(229, 169, 59, 0.15)", paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" },
  badgeLiveText: { color: colors.gold, fontSize: 9.5, fontWeight: "800" },

  /* Banner Retangular de Continuar Assistindo para TV */
  resumeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161822",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(229,169,59,0.3)",
    padding: 12,
    gap: 14,
  },
  resumeBannerFocused: {
    borderColor: colors.gold,
    borderWidth: 2.5,
    backgroundColor: "#1E2230",
    transform: [{ scale: 1.015 }],
  },
  resumeThumbBox: { width: 84, height: 56, borderRadius: 8, overflow: "hidden", backgroundColor: "#0A0B0E", position: "relative" },
  resumePlayIcon: { position: "absolute", bottom: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  resumeTag: { color: colors.gold, fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  resumeTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  resumeTrack: { height: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2, overflow: "hidden", marginVertical: 2 },
  resumeFill: { height: "100%", backgroundColor: colors.gold },
  resumeSub: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },

  gridNav: { flexDirection: "row", gap: 12 },
  navCard: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 12 },
  navCardFocused: { borderColor: colors.gold, borderWidth: 2.5, backgroundColor: colors.surface2, transform: [{ scale: 1.03 }] },
  navCardIconBox: { width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(229, 169, 59, 0.12)", alignItems: "center", justifyContent: "center" },
  navCardTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  navCardSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  quickRow: { flexDirection: "row", gap: 12 },
  tile: { flex: 1, flexDirection: "row", height: 46, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 8 },
  tileFocused: { borderColor: colors.gold, borderWidth: 2.5, backgroundColor: colors.surface2, transform: [{ scale: 1.03 }] },
  tileLabel: { color: colors.text, fontSize: 12, fontWeight: "700" },

  marqueeOuter: { overflow: "hidden", marginHorizontal: -spacing.xl, paddingVertical: 4 },
  marqueeTrack: { flexDirection: "row", paddingLeft: spacing.xl },
  channelCard: { width: 140, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: "rgba(229, 169, 59, 0.22)", overflow: "hidden", marginRight: 12 },
  focusedCard: { borderColor: colors.gold, borderWidth: 2.5, transform: [{ scale: 1.04 }] },
  posterBox: { width: 140, height: 95, backgroundColor: "#161820", position: "relative" },
  tagFhd: { position: "absolute", top: 6, left: 6, backgroundColor: "rgba(239, 68, 68, 0.9)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  tagFhdText: { color: "#FFF", fontSize: 8, fontWeight: "900" },
  channelName: { color: colors.text, fontSize: 11, fontWeight: "700", lineHeight: 15 },
  channelSub: { color: colors.gold, fontSize: 9.5, fontWeight: "800" },

  planCard: { backgroundColor: "#111319", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.08)", padding: 16, gap: 12, marginTop: 4 },
  planLabel: { color: colors.textDim, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  planVal: { color: colors.text, fontSize: 13, fontWeight: "700" },
  daysBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5 },
  daysBadgeText: { fontSize: 13, fontWeight: "900", letterSpacing: 0.6 },
  expiredBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(239, 68, 68, 0.18)", borderWidth: 1, borderColor: "#EF4444", padding: 10, borderRadius: 10 },
  expiredTitle: { color: "#EF4444", fontSize: 11, fontWeight: "900" },
  expiredSub: { color: "#FCA5A5", fontSize: 11, lineHeight: 15 },

  loggedOutBox: { width: "100%", maxWidth: 460, gap: spacing.md, alignItems: "center", alignSelf: "center", marginTop: 40 },
  brand: { color: colors.gold, fontSize: 28, fontWeight: "800" },
  hint: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
});
