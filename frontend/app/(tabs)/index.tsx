import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { TrendingMarquee, MarqueeItem } from "../../src/components/TrendingMarquee";
import { colors, radius, spacing } from "../../src/utils/theme";
import { listLists } from "../../src/utils/api";
import { useSession } from "../../src/store/session";

interface Jogo {
  id: string;
  campeonato: string;
  time_casa: string;
  time_fora: string;
  horario: string;
  ao_vivo: boolean;
  canal_nome: string;
}

const LIGAS = [
  { slug: "bra.1", nome: "Brasileirão", canal: "Premiere" },
  { slug: "bra.copa_do_brasil", nome: "Copa do Brasil", canal: "SporTV / Premiere" },
  { slug: "conmebol.libertadores", nome: "Libertadores", canal: "ESPN / Premiere" },
  { slug: "conmebol.sudamericana", nome: "Sul-Americana", canal: "ESPN" },
  { slug: "uefa.champions", nome: "Champions League", canal: "TNT Sports" },
  { slug: "eng.1", nome: "Premier League", canal: "ESPN" },
  { slug: "esp.1", nome: "La Liga", canal: "ESPN" },
  { slug: "ita.1", nome: "Serie A", canal: "ESPN" },
];

function getHoje(): string {
  const d = new Date(Date.now() - 3 * 3600000);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function buscarJogos(): Promise<Jogo[]> {
  const data = getHoje();
  let count = 1;
  try {
    const reqs = LIGAS.map(async (l) => {
      try {
        const res = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${l.slug}/scoreboard?dates=${data}`
        );
        if (!res.ok) return [];
        const json = await res.json();
        const lista: Jogo[] = [];
        for (const ev of json.events || []) {
          const comp = ev.competitions?.[0];
          if (!comp?.competitors || comp.competitors.length < 2) continue;
          let c = comp.competitors[0]?.team?.shortDisplayName || comp.competitors[0]?.team?.name || "Time 1";
          let f = comp.competitors[1]?.team?.shortDisplayName || comp.competitors[1]?.team?.name || "Time 2";
          if (comp.competitors[0]?.homeAway !== "home") {
            const t = c; c = f; f = t;
          }
          let hora = "A definir";
          if (ev.date) {
            try {
              hora = new Date(ev.date).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Sao_Paulo",
              });
            } catch {}
          }
          let canal = l.canal;
          if (comp.broadcasts?.[0]?.names?.length) canal = comp.broadcasts[0].names.join(" / ");
          lista.push({
            id: String(count++),
            campeonato: l.nome,
            time_casa: c,
            time_fora: f,
            horario: hora,
            ao_vivo: comp.status?.type?.state === "in",
            canal_nome: canal,
          });
        }
        return lista;
      } catch {
        return [];
      }
    });
    const res = (await Promise.all(reqs)).flat();
    if (res.length > 0) return res;
  } catch {}
  return [
    {
      id: "1",
      campeonato: "FUTEBOL NA TV",
      time_casa: "Sem grandes jogos",
      time_fora: "agendados para hoje",
      horario: "--:--",
      ao_vivo: false,
      canal_nome: "Canais Esportivos",
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
  const [jogos, setJogos] = useState<Jogo[]>([]);

  useEffect(() => {
    buscarJogos().then((j) => setJogos(j)).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      listLists().then((l) => setHasLists(l.length > 0)).catch(() => {});
      if (source?.kind === "xtream" && !catalog.vodLoaded) loadVod();
    }, [source?.kind, catalog.vodLoaded, loadVod])
  );

  const hasContent = !!session || hasLists;

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

          {/* Letreiro 1: Filmes em Destaque (Da Direita para a Esquerda) */}
          {marqueeItems.length > 0 && (
            <View style={styles.marqueeSection}>
              <View style={styles.marqueeHeaderRow}>
                <Text style={styles.sectionHeader}>NOVIDADES & DESTAQUES</Text>
                <Text style={styles.badgeTextSmall}>EM ALTA</Text>
              </View>
              <TrendingMarquee 
                items={marqueeItems} 
                onPressItem={(item) => router.push({ pathname: "/movie/[id]", params: { id: item.id } })} 
              />
            </View>
          )}

          {/* Letreiro 2: Jogos do Dia & Canais (Da Esquerda para a Direita - Área Rosa) */}
          {jogos.length > 0 && (
            <View style={styles.marqueeSection}>
              <View style={styles.marqueeHeaderRow}>
                <Text style={styles.sectionHeader}>CANAIS & JOGOS DO DIA</Text>
                <View style={styles.badgeLiveRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.badgeLiveText}>AO VIVO & HOJE</Text>
                </View>
              </View>
              <SportsMarqueeReverse 
                jogos={jogos} 
                onPressJogo={() => go("/(tabs)/live")} 
              />
            </View>
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

// Componente do Letreiro Esportivo Invertido (Esquerda -> Direita)
function SportsMarqueeReverse({ jogos, onPressJogo }: { jogos: Jogo[]; onPressJogo: (j: Jogo) => void }) {
  const CARD_WIDTH = 210;
  const GAP = 12;
  const STRIDE = CARD_WIDTH + GAP;
  const baseCount = Math.max(jogos.length, 1);
  const totalBaseWidth = baseCount * STRIDE;

  const loopItems = useMemo(() => {
    if (!jogos.length) return [];
    return [...jogos, ...jogos, ...jogos, ...jogos];
  }, [jogos]);

  const anim = useRef(new Animated.Value(-totalBaseWidth)).current;

  useEffect(() => {
    if (!jogos.length) return;
    anim.setValue(-totalBaseWidth);
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 0,
        duration: Math.max(totalBaseWidth * 32, 10000),
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [jogos, totalBaseWidth]);

  return (
    <View style={styles.sportsMarqueeContainer}>
      <Animated.View
        style={[
          styles.sportsMarqueeTrack,
          {
            transform: [{ translateX: anim }],
          },
        ]}
      >
        {loopItems.map((j, idx) => (
          <Pressable
            key={`${j.id}-${idx}`}
            onPress={() => onPressJogo(j)}
            style={({ pressed }) => [
              styles.sportsCard,
              pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
            ]}
          >
            <View style={styles.sportsCardHeader}>
              <Text style={styles.sportsCardLeague} numberOfLines={1}>
                {j.campeonato.toUpperCase()}
              </Text>
              {j.ao_vivo ? (
                <View style={styles.tagNoAr}>
                  <Text style={styles.tagNoArText}>NO AR</Text>
                </View>
              ) : (
                <Text style={styles.sportsCardTime}>{j.horario}</Text>
              )}
            </View>

            <View style={styles.sportsCardMatch}>
              <Text style={styles.sportsCardTeam} numberOfLines={1}>
                {j.time_casa}
              </Text>
              <Text style={styles.sportsCardVs}>VS</Text>
              <Text style={styles.sportsCardTeam} numberOfLines={1}>
                {j.time_fora}
              </Text>
            </View>

            <View style={styles.sportsCardFooter}>
              <Ionicons name="tv-outline" size={12} color={colors.gold} />
              <Text style={styles.sportsCardChannel} numberOfLines={1}>
                {j.canal_nome}
              </Text>
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
  badgeTextSmall: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  badgeLiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(229, 169, 59, 0.15)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.gold,
  },
  badgeLiveText: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: "800",
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

  marqueeSection: {
    gap: 8,
    marginTop: 4,
  },
  marqueeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  sportsMarqueeContainer: {
    overflow: "hidden",
    marginHorizontal: -spacing.lg,
    paddingVertical: 4,
  },
  sportsMarqueeTrack: {
    flexDirection: "row",
    paddingLeft: spacing.lg,
  },
  sportsCard: {
    width: 210,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.25)",
    padding: 10,
    marginRight: 12,
    gap: 6,
  },
  sportsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sportsCardLeague: {
    color: colors.gold,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
    flex: 1,
    marginRight: 4,
  },
  tagNoAr: {
    backgroundColor: "#D32F2F",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tagNoArText: {
    color: "#FFF",
    fontSize: 8,
    fontWeight: "900",
  },
  sportsCardTime: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  sportsCardMatch: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  sportsCardTeam: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  sportsCardVs: {
    color: colors.textDim,
    fontSize: 9.5,
    fontWeight: "800",
    paddingHorizontal: 4,
  },
  sportsCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  sportsCardChannel: {
    color: colors.textMuted,
    fontSize: 10.5,
    flex: 1,
  },

  loggedOutBox: { width: "100%", maxWidth: 420, gap: spacing.md, alignItems: "center", alignSelf: "center", marginTop: 40 },
  brand: { color: colors.gold, fontSize: 26, fontWeight: "800", letterSpacing: 0.6 },
  hint: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
                       
