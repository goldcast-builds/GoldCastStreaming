import { useCallback, useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Logo } from "../../src/components/Logo";
import { GoldButton } from "../../src/components/GoldButton";
import { TrendingMarquee, MarqueeItem } from "../../src/components/TrendingMarquee";
import { colors, radius, spacing } from "../../src/utils/theme";
import { listLists } from "../../src/utils/api";
import { useSession } from "../../src/store/session";

// Importa os jogos do ficheiro JSON criado com salvaguarda
let JOGOS_DATA: any[] = [];
try {
  JOGOS_DATA = require("../../src/data/jogos.json");
} catch {
  JOGOS_DATA = [
    {
      id: "1",
      campeonato: "Brasileirão Série A",
      time_casa: "Flamengo",
      time_fora: "Palmeiras",
      horario: "21:30",
      ao_vivo: false,
      canal_nome: "Premiere",
    },
  ];
}

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

  // Relógio digital em tempo real
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Cálculo dos dias restantes de acesso
  const expDays = useMemo(() => {
    const exp = session?.userInfo?.exp_date;
    if (!exp) return null;
    const ts = Number(exp);
    if (!ts || isNaN(ts)) return null;
    const diffMs = ts * 1000 - Date.now();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  }, [session?.userInfo?.exp_date]);

  // Carrega listas e catálogos em segundo plano
  useFocusEffect(
    useCallback(() => {
      listLists().then((l) => setHasLists(l.length > 0)).catch(() => {});
      if (source?.kind === "xtream" && !catalog.vodLoaded) {
        loadVod();
      }
    }, [source?.kind, catalog.vodLoaded, loadVod])
  );

  const hasContent = !!session || hasLists;

  // Filtra até 15 títulos com capas válidas para a animação flutuante
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

  const handleOpenMarqueeItem = (item: MarqueeItem) => {
    router.push({ pathname: "/movie/[id]", params: { id: item.id } });
  };

  return (
    <ScrollView 
      style={styles.root} 
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 110 }]} 
      testID="home-screen"
      showsVerticalScrollIndicator={false}
    >
      {/* Barra Superior Renovada */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Logo size={88} />
          {session && (
            <View style={styles.vipBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.vipBadgeText}>
                {expDays !== null ? `VIP: ${expDays}d` : "VIP Ativo"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.topBarRight}>
          <View style={styles.clockBox}>
            <Ionicons name="time-outline" size={13} color={colors.textDim} />
            <Text style={styles.clockText}>{currentTime}</Text>
          </View>

          <Pressable 
            testID="home-search" 
            onPress={() => router.push({ pathname: "/(tabs)/live", params: { focusSearch: "1" } })} 
            hitSlop={8} 
            style={({ pressed }) => [styles.searchPill, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="search" size={15} color={colors.gold} />
            <Text style={styles.searchPillText}>Buscar...</Text>
          </Pressable>
        </View>
      </View>

      {hasContent ? (
        <View style={styles.mainContainer}>
          {/* Central Esportiva: Jogos de Hoje */}
          <View style={styles.sportsSection}>
            <View style={styles.sportsHeaderRow}>
              <View style={styles.sportsHeaderTag}>
                <Ionicons name="football" size={13} color={colors.gold} />
                <Text style={styles.sportsHeaderTagText}>JOGOS DE HOJE & TRANSMISSÃO</Text>
              </View>
              <Text style={styles.sportsCountText}>{JOGOS_DATA.length} partidas</Text>
            </View>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.gamesScroll}
            >
              {JOGOS_DATA.map((jogo: any) => (
                <View key={jogo.id} style={styles.gameCard}>
                  <LinearGradient
                    colors={["#201B11", "#151722", "#0C0D12"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gameCardGradient}
                  />

                  <View style={styles.gameCardHeader}>
                    <Text style={styles.championshipText} numberOfLines={1}>
                      {String(jogo.campeonato || "FUTEBOL").toUpperCase()}
                    </Text>
                    {jogo.ao_vivo ? (
                      <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>AO VIVO</Text>
                      </View>
                    ) : (
                      <View style={styles.timeBadge}>
                        <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                        <Text style={styles.timeText}>{jogo.horario}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.matchRow}>
                    <View style={styles.teamCol}>
                      <Ionicons name="shield-outline" size={22} color={colors.gold} />
                      <Text style={styles.teamName} numberOfLines={1}>{jogo.time_casa}</Text>
                    </View>
                    <View style={styles.vsBox}>
                      <Text style={styles.vsText}>VS</Text>
                    </View>
                    <View style={styles.teamCol}>
                      <Ionicons name="shield-outline" size={22} color={colors.text} />
                      <Text style={styles.teamName} numberOfLines={1}>{jogo.time_fora}</Text>
                    </View>
                  </View>

                  <View style={styles.channelRow}>
                    <Ionicons name="tv-outline" size={13} color={colors.gold} />
                    <Text style={styles.channelText} numberOfLines={1}>
                      Canal: <Text style={styles.channelHighlight}>{jogo.canal_nome}</Text>
                    </Text>
                  </View>

                  <Pressable 
                    style={({ pressed }) => [styles.tuneBtn, pressed && { opacity: 0.85 }]}
                    onPress={() => go("/(tabs)/live")}
                  >
                    <Ionicons name="play" size={13} color={colors.onGold} />
                    <Text style={styles.tuneBtnText}>SINTONIZAR CANAL</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>

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

          {/* Letreiro Flutuante Animado com Capas em Movimento */}
          {marqueeItems.length > 0 && (
            <TrendingMarquee 
              items={marqueeItems} 
              onPressItem={handleOpenMarqueeItem} 
            />
          )}
        </View>
      ) : (
        <View style={styles.loggedOutBox}>
          <Text style={styles.brand}>GoldCast Streaming</Text>
          <Text style={styles.hint}>Inicie sessão com os dados fornecidos pelo seu serviço para carregar a programação.</Text>
          <GoldButton testID="home-login" label="ENTRAR NO SERVIÇO" icon={<Ionicons name="log-in-outline" size={20} color={colors.onGold} />} onPress={() => router.push("/login")} style={{ alignSelf: "stretch", marginTop: spacing.md }} />
          <GoldButton testID="add-list-primary" label="ADICIONAR LISTA M3U" variant="outline" icon={<Ionicons name="add-circle" size={20} color={colors.gold} />} onPress={() => router.push("/add-list")} style={{ alignSelf: "stretch" }} />
        </View>
      )}
    </ScrollView>
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
  
  // Barra Superior
  topBar: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    marginBottom: spacing.md 
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(229, 169, 59, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  vipBadgeText: {
    color: colors.gold,
    fontSize: 10.5,
    fontWeight: "700",
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  clockBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  clockText: {
    color: colors.text,
    fontSize: 11.5,
    fontWeight: "600",
  },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  searchPillText: {
    color: colors.textMuted,
    fontSize: 12,
  },

  mainContainer: { gap: spacing.lg },

  // Secção Desportiva
  sportsSection: {
    gap: 10,
  },
  sportsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sportsHeaderTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sportsHeaderTagText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  sportsCountText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "600",
  },
  gamesScroll: {
    gap: 12,
    paddingRight: spacing.md,
  },
  gameCard: {
    width: 285,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.25)",
    padding: 14,
    gap: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  gameCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  gameCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  championshipText: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    maxWidth: 180,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#EF4444",
  },
  liveText: {
    color: "#EF4444",
    fontSize: 9.5,
    fontWeight: "800",
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  timeText: {
    color: colors.textMuted,
    fontSize: 10.5,
    fontWeight: "600",
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 4,
  },
  teamCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  teamName: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: "700",
    textAlign: "center",
  },
  vsBox: {
    paddingHorizontal: 8,
  },
  vsText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "800",
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  channelText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  channelHighlight: {
    color: colors.gold,
    fontWeight: "700",
  },
  tuneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.gold,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  tuneBtnText: {
    color: colors.onGold,
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  sectionHeader: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 4,
    marginBottom: -6,
  },
  gridNav: {
    gap: 10,
  },
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
  navCardFocused: {
    borderColor: colors.gold,
    borderWidth: 2,
    backgroundColor: colors.surface2,
    transform: [{ scale: 1.02 }],
  },
  navCardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "rgba(229, 169, 59, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  navCardTextBox: {
    flex: 1,
  },
  navCardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  navCardSub: {
    color: colors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
  },

  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
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
  tileFocused: {
    borderColor: colors.gold,
    borderWidth: 2,
  },
  tileLabel: {
    color: colors.text,
    fontSize: 11.5,
    fontWeight: "600",
  },

  loggedOutBox: {
    width: "100%",
    maxWidth: 420,
    gap: spacing.md,
    alignItems: "center",
    alignSelf: "center",
    marginTop: 40,
  },
  brand: { color: colors.gold, fontSize: 26, fontWeight: "800", letterSpacing: 0.6 },
  hint: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
