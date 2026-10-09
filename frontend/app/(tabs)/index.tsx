import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
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
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${l.slug}/scoreboard?dates=${data}`);
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
              hora = new Date(ev.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
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
      } catch { return []; }
    });
    const res = (await Promise.all(reqs)).flat();
    if (res.length > 0) return res;
  } catch {}
  return [{
    id: "1",
    campeonato: "FUTEBOL NA TV",
    time_casa: "Sem grandes jogos",
    time_fora: "agendados para hoje",
    horario: "--:--",
    ao_vivo: false,
    canal_nome: "Canais Esportivos",
  }];
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
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    buscarJogos().then((j) => { setJogos(j); setCarregando(false); }).catch(() => setCarregando(false));
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
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 110 }]} 
      testID="home-screen"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <Logo size={105} />
        <Pressable 
          testID="home-search" 
          onPress={() => router.push({ pathname: "/(tabs)/live", params: { focusSearch: "1" } })} 
          hitSlop={8} 
          style={({ focused, pressed }) => [styles.iconBtn, focused && styles.focused, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="search" size={22} color={colors.text} />
        </Pressable>
      </View>

      {hasContent ? (
        <View style={styles.mainContainer}>
          <View style={styles.heroBanner}>
            <LinearGradient
              colors={["#1C180E", "#151722", "#090A0E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            />
            <View style={styles.heroOverlayContent}>
              <View style={styles.heroTag}>
                <Ionicons name="sparkles" size={12} color={colors.gold} />
                <Text style={styles.heroTagText}>GOLDCAST PREMIUM</Text>
              </View>
              <Text style={styles.heroTitle}>Entretenimento Ilimitado</Text>
              <Text style={styles.heroSubtitle}>
                Aceda à grelha completa de canais ao vivo, filmes em alta definição e séries atualizadas.
              </Text>
              <View style={styles.heroActions}>
                <Pressable 
                  style={({ pressed }) => [styles.heroPrimaryBtn, pressed && { opacity: 0.85 }]} 
                  onPress={() => go("/(tabs)/live")}
                >
                  <Ionicons name="play" size={16} color={colors.onGold} />
                  <Text style={styles.heroPrimaryText}>Assistir TV</Text>
                </Pressable>
                <Pressable 
                  style={({ pressed }) => [styles.heroSecondaryBtn, pressed && { opacity: 0.85 }]} 
                  onPress={() => go("/(tabs)/movies")}
                >
                  <Ionicons name="film-outline" size={16} color={colors.text} />
                  <Text style={styles.heroSecondaryText}>Ver Filmes</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Programação dos Jogos do Dia */}
          <View style={styles.sportsSection}>
            <View style={styles.sportsHeaderRow}>
              <Text style={styles.sectionHeader}>JOGOS DE HOJE • ESPN</Text>
              <View style={styles.sportsBadgeLive}>
                <View style={styles.sportsLiveDot} />
                <Text style={styles.sportsBadgeLiveText}>AO VIVO & HOJE</Text>
              </View>
            </View>
            {carregando ? (
              <View style={styles.sportsLoadingBox}>
                <ActivityIndicator size="small" color={colors.gold} />
                <Text style={styles.sportsLoadingText}>Carregando jogos...</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportsScroll}>
                {jogos.map((j) => (
                  <Pressable
                    key={j.id}
                    onPress={() => go("/(tabs)/live")}
                    style={({ pressed }) => [styles.jogoCard, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
                  >
                    <View style={styles.jogoTop}>
                      <Text style={styles.jogoCampeonato} numberOfLines={1}>{j.campeonato}</Text>
                      {j.ao_vivo ? (
                        <View style={styles.tagAoVivo}><Text style={styles.tagAoVivoText}>NO AR</Text></View>
                      ) : (
                        <Text style={styles.jogoHorario}>{j.horario}</Text>
                      )}
                    </View>
                    <View style={styles.jogoConfronto}>
                      <Text style={styles.jogoEquipa} numberOfLines={1}>{j.time_casa}</Text>
                      <Text style={styles.jogoVersus}>VS</Text>
                      <Text style={styles.jogoEquipa} numberOfLines={1}>{j.time_fora}</Text>
                    </View>
                    <View style={styles.jogoRodape}>
                      <Ionicons name="tv-outline" size={12} color={colors.gold} />
                      <Text style={styles.jogoCanal} numberOfLines={1}>{j.canal_nome}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

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

          <View style={styles.quickActionsRow}>
            <SmallTile testID="home-favorites" icon="star-outline" label="Favoritos" onPress={() => router.push({ pathname: "/(tabs)/live", params: { cat: "__fav" } })} />
            <SmallTile testID="home-account" icon="person-outline" label="Conta" onPress={() => router.push(session ? "/(tabs)/settings" : "/login")} />
            <SmallTile testID="home-settings" icon="settings-outline" label="Ajustes" onPress={() => router.push("/(tabs)/settings")} />
          </View>

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
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  mainContainer: { gap: spacing.lg },
  heroBanner: { borderRadius: 14, overflow: "hidden", position: "relative", borderWidth: 1, borderColor: "rgba(229, 169, 59, 0.25)", elevation: 6 },
  heroGradient: { ...StyleSheet.absoluteFillObject },
  heroOverlayContent: { padding: 20, gap: 8 },
  heroTag: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(229, 169, 59, 0.15)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  heroTagText: { color: colors.gold, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: "800", letterSpacing: -0.4, marginTop: 2 },
  heroSubtitle: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, maxWidth: "92%" },
  heroActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  heroPrimaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.gold, paddingVertical: 10, paddingHorizontal: 18, borderRadius: radius.sm },
  heroPrimaryText: { color: colors.onGold, fontSize: 13, fontWeight: "800" },
  heroSecondaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255, 255, 255, 0.08)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.12)", paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.sm },
  heroSecondaryText: { color: colors.text, fontSize: 13, fontWeight: "600" },

  sportsSection: { gap: 10 },
  sportsHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sportsBadgeLive: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(229, 169, 59, 0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  sportsLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold },
  sportsBadgeLiveText: { color: colors.gold, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.5 },
  sportsLoadingBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.surface, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  sportsLoadingText: { color: colors.textMuted, fontSize: 12 },
  sportsScroll: { gap: 10, paddingVertical: 2 },
  jogoCard: { width: 220, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: "rgba(229, 169, 59, 0.22)", padding: 12, gap: 8 },
  jogoTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  jogoCampeonato: { color: colors.gold, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.4, flex: 1, marginRight: 6 },
  tagAoVivo: { backgroundColor: "#D32F2F", paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4 },
  tagAoVivoText: { color: "#FFF", fontSize: 8.5, fontWeight: "900" },
  jogoHorario: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  jogoConfronto: { gap: 3 },
  jogoEquipa: { color: colors.text, fontSize: 13, fontWeight: "700" },
  jogoVersus: { color: colors.textDim, fontSize: 9.5, fontWeight: "800", marginLeft: 2 },
  jogoRodape: { flexDirection: "row", alignItems: "center", gap: 5, paddingTop: 6, borderTopWidth: 1, borderTopColor: "rgba(255, 255, 255, 0.06)" },
  jogoCanal: { color: colors.textMuted, fontSize: 11, flex: 1 },

  sectionHeader: { color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 6, marginBottom: -6 },
  gridNav: { gap: 10 },
  navCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 14 },
  navCardFocused: { borderColor: colors.gold, borderWidth: 2, backgroundColor: colors.surface2 },
  navCardIconBox: { width: 48, height: 48, borderRadius: 10, backgroundColor: "rgba(229, 169, 59, 0.12)", alignItems: "center", justifyContent: "center" },
  navCardTextBox: { flex: 1 },
  navCardTitle: { color: colors.text, fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  navCardSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },

  quickActionsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  tile: { flex: 1, flexDirection: "row", height: 44, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 6 },
  tileFocused: { borderColor: colors.gold, borderWidth: 2 },
  tileLabel: { color: colors.text, fontSize: 11.5, fontWeight: "600" },

  loggedOutBox: { width: "100%", maxWidth: 420, gap: spacing.md, alignItems: "center", alignSelf: "center", marginTop: 40 },
  brand: { color: colors.gold, fontSize: 26, fontWeight: "800", letterSpacing: 0.6 },
  hint: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  focused: { borderWidth: 2, borderColor: colors.gold },
});
  
