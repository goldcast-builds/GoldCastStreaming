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
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(false);

  const blinkAnim = useRef(new Animated.Value(1)).current;
  const bubbleAnim = useRef(new Animated.Value(0)).current;

  // Localiza o último filme/série em andamento
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
    if (resumeItem && !bubbleDismissed) {
      Animated.spring(bubbleAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }).start();
    }
  }, [resumeItem, bubbleDismissed, bubbleAnim]);

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
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 120 }]} 
        showsVerticalScrollIndicator={false}
      >
        {hasContent ? (
          <View style={styles.mainContainer}>
            <Text style={styles.sectionHeader}>O QUE PRETENDE ASSISTIR?</Text>

            <View style={styles.gridNav}>
              {MAIN.map((m) => (
                <Pressable
                  key={m.key}
                  onPress={() => go(m.path)}
                  hasTVPreferredFocus={m.key === "live"}
                  style={({ focused, pressed }) => [styles.navCard, focused && styles.navCardFocused, pressed && { transform: [{ scale: 0.98 }] }]}
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
              <SmallTile icon="settings-outline" label="Ajustes" onPress={() => router.push("/(tabs)/settings")} />
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
                      <Text style={styles.expiredSub}>Entre em contato com o vendedor para renovar seu acesso.</Text>
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

      {/* BALÃO FLUTUANTE ESTILO MESSENGER: CONTINUAR ASSISTINDO */}
      {resumeItem && !bubbleDismissed && (
        <Animated.View
          style={[
            styles.floatingContainer,
            {
              bottom: insets.bottom + 90,
              transform: [{ scale: bubbleAnim }],
              opacity: bubbleAnim,
            },
          ]}
        >
          {bubbleOpen && (
            <View style={styles.bubbleCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.bubbleCardTag}>CONTINUAR ASSISTINDO</Text>
                <Pressable onPress={() => setBubbleOpen(false)} hitSlop={8}>
                  <Ionicons name="close" size={16} color={colors.textDim} />
                </Pressable>
              </View>
              <Text style={styles.bubbleCardTitle} numberOfLines={1}>{resumeItem.title}</Text>
              <View style={styles.bubbleProgressTrack}>
                <View style={[styles.bubbleProgressFill, { width: `${resumeItem.pct}%` }]} />
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.bubbleCardPct}>{resumeItem.pct}% concluído</Text>
                <Pressable onPress={handleResumePlayback} style={styles.bubblePlayBtn}>
                  <Ionicons name="play" size={13} color={colors.onGold} />
                  <Text style={styles.bubblePlayBtnText}>RETOMAR</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.bubbleRow}>
            <Pressable onPress={() => setBubbleOpen(!bubbleOpen)} style={styles.bubbleHead}>
              {resumeItem.logo ? (
                <Image source={{ uri: resumeItem.logo }} style={styles.bubbleImage} resizeMode="cover" />
              ) : (
                <View style={[styles.bubbleImage, styles.center, { backgroundColor: "#1C180E" }]}>
                  <Ionicons name="film" size={26} color={colors.gold} />
                </View>
              )}
              <View style={styles.bubbleBadgePlay}>
                <Ionicons name="play" size={10} color={colors.onGold} />
              </View>
              <View style={styles.bubbleBadgePct}>
                <Text style={styles.bubbleBadgePctText}>{resumeItem.pct}%</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => {
                setBubbleOpen(false);
                setBubbleDismissed(true);
              }}
              style={styles.bubbleCloseBtn}
              hitSlop={6}
            >
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function JogosMarqueeReverse({ channels, onPressChannel }: { channels: LiveStream[]; onPressChannel: (c: LiveStream) => void }) {
  const STRIDE = 132;
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
          <Pressable key={`${ch.stream_id}-${idx}`} onPress={() => onPressChannel(ch)} style={styles.channelCard}>
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
    <Pressable onPress={onPress} style={({ focused }) => [styles.tile, focused && { borderColor: colors.gold, borderWidth: 2 }]}>
      <Ionicons name={icon} size={20} color={colors.gold} />
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg },
  mainContainer: { gap: spacing.lg },
  sectionHeader: { color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  sectionTitle: { color: colors.gold, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowAlign: { flexDirection: "row", alignItems: "center", gap: 5 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  fullSize: { width: "100%", height: "100%" },
  badgeTextSmall: { color: colors.gold, fontSize: 10, fontWeight: "800" },
  badgeLive: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(229, 169, 59, 0.15)", paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" },
  badgeLiveText: { color: colors.gold, fontSize: 9.5, fontWeight: "800" },
  gridNav: { gap: 10 },
  navCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 14 },
  navCardFocused: { borderColor: colors.gold, borderWidth: 2, backgroundColor: colors.surface2 },
  navCardIconBox: { width: 48, height: 48, borderRadius: 10, backgroundColor: "rgba(229, 169, 59, 0.12)", alignItems: "center", justifyContent: "center" },
  navCardTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  navCardSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
  quickRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  tile: { flex: 1, flexDirection: "row", height: 44, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 6 },
  tileLabel: { color: colors.text, fontSize: 11.5, fontWeight: "600" },
  marqueeOuter: { overflow: "hidden", marginHorizontal: -spacing.lg, paddingVertical: 4 },
  marqueeTrack: { flexDirection: "row", paddingLeft: spacing.lg },
  channelCard: { width: 120, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: "rgba(229, 169, 59, 0.22)", overflow: "hidden", marginRight: 12 },
  posterBox: { width: 120, height: 120, backgroundColor: "#161820", position: "relative" },
  tagFhd: { position: "absolute", top: 6, left: 6, backgroundColor: "rgba(239, 68, 68, 0.9)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  tagFhdText: { color: "#FFF", fontSize: 8, fontWeight: "900" },
  channelName: { color: colors.text, fontSize: 10.5, fontWeight: "700", lineHeight: 14 },
  channelSub: { color: colors.gold, fontSize: 9, fontWeight: "800" },
  planCard: { backgroundColor: "#111319", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.08)", padding: 14, gap: 12, marginTop: 4 },
  planLabel: { color: colors.textDim, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8 },
  planVal: { color: colors.text, fontSize: 13, fontWeight: "700" },
  daysBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5 },
  daysBadgeText: { fontSize: 13, fontWeight: "900", letterSpacing: 0.6 },
  expiredBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(239, 68, 68, 0.18)", borderWidth: 1, borderColor: "#EF4444", padding: 10, borderRadius: 10 },
  expiredTitle: { color: "#EF4444", fontSize: 11, fontWeight: "900" },
  expiredSub: { color: "#FCA5A5", fontSize: 10.5, lineHeight: 14 },
  loggedOutBox: { width: "100%", maxWidth: 420, gap: spacing.md, alignItems: "center", alignSelf: "center", marginTop: 40 },
  brand: { color: colors.gold, fontSize: 26, fontWeight: "800" },
  hint: { color: colors.textMuted, fontSize: 14, textAlign: "center" },

  /* Balão Messenger Flutuante */
  floatingContainer: { position: "absolute", right: 18, alignItems: "flex-end", zIndex: 999 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  bubbleHead: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    borderColor: colors.gold,
    backgroundColor: "#161820",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 6,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  bubbleImage: { width: 56, height: 56, borderRadius: 28 },
  bubbleBadgePlay: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#090A0E",
  },
  bubbleBadgePct: {
    position: "absolute",
    top: -4,
    left: -4,
    backgroundColor: "#090A0E",
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  bubbleBadgePctText: { color: colors.gold, fontSize: 8.5, fontWeight: "800" },
  bubbleCloseBtn: { marginTop: -4, marginLeft: -4 },
  bubbleCard: {
    width: 220,
    backgroundColor: "#151722",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(229,169,59,0.3)",
    padding: 10,
    marginBottom: 8,
    gap: 6,
    elevation: 8,
  },
  bubbleCardTag: { color: colors.gold, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  bubbleCardTitle: { color: colors.text, fontSize: 12, fontWeight: "700" },
  bubbleProgressTrack: { height: 4, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" },
  bubbleProgressFill: { height: "100%", backgroundColor: colors.gold },
  bubbleCardPct: { color: colors.textMuted, fontSize: 10 },
  bubblePlayBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.gold, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  bubblePlayBtnText: { color: colors.onGold, fontSize: 10, fontWeight: "800" },
});
