import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { TrendingMarquee, MarqueeItem } from "../../src/components/TrendingMarquee";
import { colors, radius, spacing } from "../../src/utils/theme";
import { listLists } from "../../src/utils/api";
import { useSession } from "../../src/store/session";
import { xtream, LiveStream, Category } from "../../src/services/xtream";

const MAIN = [
  { key: "live", label: "TV AO VIVO", sub: "Canais em tempo real", icon: "tv", path: "/(tabs)/live", testID: "home-live" },
  { key: "movies", label: "FILMES", sub: "Catálogo On-Demand", icon: "film", path: "/(tabs)/movies", testID: "home-movies" },
  { key: "series", label: "SÉRIES", sub: "Temporadas completas", icon: "albums", path: "/(tabs)/series", testID: "home-series" },
] as const;

export default function HomeTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const source = useSession((s) => s.source);
  const setSource = useSession((s) => s.setSource);
  const catalog = useSession((s) => s.catalog);
  const loadVod = useSession((s) => s.loadVod);
  const [hasLists, setHasLists] = useState(false);

  // Canais da categoria "JOGOS DO DIA"
  const [jogosChannels, setJogosChannels] = useState<LiveStream[]>([]);
  const [jogosCatId, setJogosCatId] = useState<string | null>(null);

  // Busca os canais da categoria JOGOS DO DIA no servidor
  useEffect(() => {
    if (!session) return;
    let active = true;

    async function carregarCanaisJogos() {
      try {
        const categories: Category[] = await xtream.liveCategories(session);
        const catJogos = categories.find((c) =>
          /jogos?\s*do\s*dia/i.test(c.category_name)
        );

        if (catJogos) {
          if (active) setJogosCatId(catJogos.category_id);
          const streams: LiveStream[] = await xtream.liveStreams(
            session,
            catJogos.category_id
          );
          if (active && streams.length > 0) {
            setJogosChannels(streams);
          }
        }
      } catch {}
    }

    carregarCanaisJogos();
    return () => {
      active = false;
    };
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      listLists().then((l) => setHasLists(l.length > 0)).catch(() => {});
      if (source?.kind === "xtream" && !catalog.vodLoaded) {
        loadVod();
      }
    }, [source?.kind, catalog.vodLoaded, loadVod])
  );

  const hasContent = !!session || hasLists;

  // Filmes em destaque
  const marqueeItems: MarqueeItem[] = useMemo(() => {
    if (!catalog.vod || catalog.vod.length === 0) return [];
    return catalog.vod
      .filter((v) => !!v.stream_icon)
      .slice(0, 15)
      .map((v) => ({
        id: String(v.stream_id),
        name: v.name,
        poster: v.stream_icon,
        type: "movie",
      }));
  }, [catalog.vod]);

  const go = async (path: string) => {
    if (session && source?.kind !== "list") await setSource({ kind: "xtream" });
    router.push(path as any);
  };

  // Redireciona diretamente para o canal na categoria JOGOS DO DIA
  const handleOpenChannel = (channel: LiveStream) => {
    if (session && source?.kind !== "list") setSource({ kind: "xtream" });
    router.push({
      pathname: "/(tabs)/live",
      params: {
        cat: jogosCatId || undefined,
        channelId: String(channel.stream_id),
      },
    });
  };

  return (
    <ScrollView 
      style={styles.root} 
      contentContainerStyle={[
        styles.content, 
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 110 }
      ]} 
      testID="home-screen"
      showsVerticalScrollIndicator={false}
    >
      {hasContent ? (
        <View style={styles.mainContainer}>
          {/* Navegação Principal */}
          <Text style={styles.sectionHeader}>O QUE PRETENDE ASSISTIR?</Text>

          <View style={styles.gridNav}>
            {MAIN.map((m) => (
              <Pressable
                key={m.key}
                testID={m.testID}
                onPress={() => go(m.path)}
                hasTVPreferredFocus={m.key === "live"}
                style={({ focused, pressed }) => [
                  styles.navCard,
                  focused && styles.navCardFocused,
                  pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }
                ]}
              >
                <View style={styles.navCardIconBox}>
                  <Ionicons name={m.icon as any} size={28} color={colors.gold} />
                </View>
                <View style={styles.navCardTextBox}>
                  <Text style={styles.navCardTitle}>{m.label}</Text>
                  <Text style={styles.navCardSub}>{m.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
              </Pressable>
            ))}
          </View>

          {/* Atalhos Rápidos */}
          <View style={styles.quickActionsRow}>
            <SmallTile testID="home-favorites" icon="star-outline" label="Favoritos" onPress={() => router.push({ pathname: "/(tabs)/live", params: { cat: "__fav" } })} />
            <SmallTile testID="home-account" icon="person-outline" label="Conta" onPress={() => router.push(session ? "/(tabs)/settings" : "/login")} />
            <SmallTile testID="home-settings" icon="settings-outline" label="Ajustes" onPress={() => router.push("/(tabs)/settings")} />
          </View>

          {/* Letreiro 1: JOGOS DO DIA (Da Esquerda para a Direita) */}
          {jogosChannels.length > 0 && (
            <View style={styles.sectionBlock}>
              <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>⚽ JOGOS DO DIA</Text>
                <View style={styles.badgeLive}>
                  <View style={styles.liveDot} />
                  <Text style={styles.badgeLiveText}>AO VIVO</Text>
                </View>
              </View>
              <JogosMarqueeReverse 
                channels={jogosChannels} 
                onPressChannel={handleOpenChannel} 
              />
            </View>
          )}

          {/* Letreiro 2: Filmes e Séries (Da Direita para a Esquerda) */}
          {marqueeItems.length > 0 && (
            <TrendingMarquee 
              items={marqueeItems} 
              onPressItem={(item) => router.push({ pathname: "/movie/[id]", params: { id: item.id } })} 
            />
          )}
        </View>
      ) : (
        <View style={styles.loggedOutBox}>
          <Text style={styles.brand}>GoldCast Streaming</Text>
          <Text style={styles.hint}>Inicie sessão com os dados fornecidos pelo seu serviço para carregar a programação.</Text>
        </View>
      )}
    </ScrollView>
  );
}

// Componente do Letreiro de Canais (Deslizando da Esquerda para a Direita)
function JogosMarqueeReverse({
  channels,
  onPressChannel,
}: {
  channels: LiveStream[];
  onPressChannel: (c: LiveStream) => void;
}) {
  const CARD_WIDTH = 120;
  const GAP = 12;
  const STRIDE = CARD_WIDTH + GAP;
  const baseCount = Math.max(channels.length, 1);
  const totalBaseWidth = baseCount * STRIDE;

  const loopItems = useMemo(() => {
    if (!channels.length) return [];
    const repeat = Math.max(4, Math.ceil(8 / channels.length));
    return Array(repeat).fill(channels).flat();
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
  }, [channels.length, totalBaseWidth]);

  return (
    <View style={styles.marqueeOuter}>
      <Animated.View
        style={[
          styles.marqueeTrack,
          {
            transform: [{ translateX: anim }],
          },
        ]}
      >
        {loopItems.map((ch, idx) => (
          <Pressable
            key={`${ch.stream_id}-${idx}`}
            onPress={() => onPressChannel(ch)}
            style={({ pressed }) => [
              styles.channelCard,
              pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
            ]}
          >
            <View style={styles.posterBox}>
              {ch.stream_icon ? (
                <Image
                  source={{ uri: ch.stream_icon }}
                  style={styles.channelPoster}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.posterFallback}>
                  <Text style={{ fontSize: 32 }}>⚽</Text>
                </View>
              )}
              <View style={styles.tagFhd}>
                <Text style={styles.tagFhdText}>AO VIVO</Text>
              </View>
            </View>

            <View style={styles.channelMeta}>
              <Text style={styles.channelName} numberOfLines={2}>
                {ch.name}
              </Text>
              <Text style={styles.channelSub}>JOGOS DO DIA</Text>
            </View>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

function SmallTile({ icon, label, onPress, testID }: { icon: any; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ focused, pressed }) => [styles.tile, focused && styles.tileFocused, pressed && { opacity: 0.8 }]}>
      <Ionicons name={icon} size={20} color={colors.gold} />
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg },
  mainContainer: { gap: spacing.lg },

  sectionHeader: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  sectionBlock: {
    gap: 8,
    marginTop: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  badgeLive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(229, 169, 59, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EF4444",
  },
  badgeLiveText: {
    color: colors.gold,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },

  gridNav: { gap: 10 },
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  navCardFocused: { borderColor: colors.gold, borderWidth: 2, backgroundColor: colors.surface2 },
  navCardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "rgba(229, 169, 59, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  navCardTextBox: { flex: 1 },
  navCardTitle: { color: colors.text, fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  navCardSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },

  quickActionsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  tile: {
    flex: 1,
    flexDirection: "row",
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tileFocused: { borderColor: colors.gold, borderWidth: 2 },
  tileLabel: { color: colors.text, fontSize: 11.5, fontWeight: "600" },

  marqueeOuter: {
    overflow: "hidden",
    marginHorizontal: -spacing.lg,
    paddingVertical: 4,
  },
  marqueeTrack: {
    flexDirection: "row",
    paddingLeft: spacing.lg,
  },
  channelCard: {
    width: 120,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.22)",
    overflow: "hidden",
    marginRight: 12,
  },
  posterBox: {
    width: 120,
    height: 120,
    backgroundColor: "#161820",
    position: "relative",
  },
  channelPoster: {
    width: "100%",
    height: "100%",
  },
  posterFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tagFhd: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(239, 68, 68, 0.9)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagFhdText: {
    color: "#FFF",
    fontSize: 8,
    fontWeight: "900",
  },
  channelMeta: {
    padding: 8,
    gap: 2,
  },
  channelName: {
    color: colors.text,
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 14,
  },
  channelSub: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: "800",
  },

  loggedOutBox: { width: "100%", maxWidth: 420, gap: spacing.md, alignItems: "center", alignSelf: "center", marginTop: 40 },
  brand: { color: colors.gold, fontSize: 26, fontWeight: "800", letterSpacing: 0.6 },
  hint: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
                  
