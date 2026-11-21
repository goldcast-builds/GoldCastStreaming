import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  Animated,
  Easing,
  TextInput,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import YoutubePlayer from "react-native-youtube-iframe";
import { useSession } from "../../src/store/session";
import { xtream } from "../../src/services/xtream";

type MatchStatus = "AO VIVO" | "EM BREVE" | "ENCERRADO";
type FilterTab = "todos" | "ao_vivo" | "proximos";

interface GuiaMatch {
  id: string;
  time: string;
  league: string;
  teamA: string;
  teamB: string;
  logoA?: string;
  logoB?: string;
  score: string;
  status: MatchStatus;
  channels: string;
}

interface EpgProgramInfo {
  title: string;
  startLabel: string;
  endLabel: string;
  progress: number;
  nextTitle?: string;
}

const FUTEBOL_CACHE_KEY = "@goldcast_home_futebol_v2";

const LEAGUE_ENDPOINTS = [
  {
    url: "https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard",
    label: "CAMPEONATO BRASILEIRO — SÉRIE A",
  },
  {
    url: "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard",
    label: "UEFA CHAMPIONS LEAGUE",
  },
  {
    url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard",
    label: "PREMIER LEAGUE",
  },
];

function formatHoraBR(iso?: string): string {
  if (!iso) return "Hoje";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Hoje";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "Hoje";
  }
}

function parseEpgTimestamp(raw: any): number {
  if (!raw) return 0;
  const num = Number(raw);
  if (Number.isFinite(num) && num > 0) {
    return num < 2_000_000_000 ? num * 1000 : num;
  }
  const parsed = Date.parse(String(raw));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatEpgTime(raw: any): string {
  if (!raw) return "";
  const num = Number(raw);
  const date =
    Number.isFinite(num) && num > 0
      ? new Date(num < 2_000_000_000 ? num * 1000 : num)
      : new Date(String(raw));
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

function decodeBase64Safe(val: any): string {
  if (!val || typeof val !== "string") return "";
  if (/^[A-Za-z0-9+/=]+$/.test(val) && val.length % 4 === 0) {
    try {
      if (typeof globalThis.atob === "function") {
        return decodeURIComponent(escape(globalThis.atob(val)));
      }
    } catch {}
  }
  return val;
}

async function buscarMelhoresMomentosVideoId(query: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://www.youtube.com/results?search_query=${encoded}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function buscarJogosFutebolHoje(): Promise<GuiaMatch[]> {
  const lista: GuiaMatch[] = [];

  for (const ep of LEAGUE_ENDPOINTS) {
    try {
      const res = await fetch(ep.url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const json = await res.json();
      const events = Array.isArray(json?.events) ? json.events : [];

      for (const ev of events) {
        const comp = ev?.competitions?.[0];
        const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
        const home = competitors.find((c: any) => c?.homeAway === "home") || competitors[0];
        const away = competitors.find((c: any) => c?.homeAway === "away") || competitors[1];

        const teamA = home?.team?.shortDisplayName || home?.team?.displayName;
        const teamB = away?.team?.shortDisplayName || away?.team?.displayName;
        if (!teamA || !teamB) continue;

        const logoA = home?.team?.logo || home?.team?.logos?.[0]?.href || "";
        const logoB = away?.team?.logo || away?.team?.logos?.[0]?.href || "";

        const state = ev?.status?.type?.state;
        let status: MatchStatus = "EM BREVE";
        let time = formatHoraBR(ev?.date);
        let score = "VS";

        if (state === "in") {
          status = "AO VIVO";
          time = ev?.status?.displayClock ? `${ev.status.displayClock}'` : "AO VIVO";
          score = `${home?.score ?? 0} - ${away?.score ?? 0}`;
        } else if (state === "post") {
          status = "ENCERRADO";
          time = "FIM";
          score = `${home?.score ?? 0} - ${away?.score ?? 0}`;
        }

        const broadcastNames = comp?.broadcasts
          ?.flatMap((b: any) => (Array.isArray(b?.names) ? b.names : []))
          ?.filter(Boolean);
        const channels =
          broadcastNames && broadcastNames.length > 0
            ? [...new Set(broadcastNames)].join(" • ")
            : "Premiere • SporTV • ESPN";

        lista.push({
          id: String(ev?.id || `${ep.label}-${teamA}-${teamB}`),
          time,
          league: ep.label,
          teamA,
          teamB,
          logoA,
          logoB,
          score,
          status,
          channels,
        });
      }
    } catch {}
  }

  if (lista.length > 0) {
    await AsyncStorage.setItem(FUTEBOL_CACHE_KEY, JSON.stringify(lista)).catch(() => {});
    return lista;
  }

  const cached = await AsyncStorage.getItem(FUTEBOL_CACHE_KEY).catch(() => null);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }

  return [
    {
      id: "fallback-1",
      time: "19:30",
      league: "CAMPEONATO BRASILEIRO — SÉRIE A",
      teamA: "Fluminense",
      teamB: "Internacional",
      score: "VS",
      status: "EM BREVE",
      channels: "RECORD • Premiere",
    },
    {
      id: "fallback-2",
      time: "19:30",
      league: "CAMPEONATO BRASILEIRO — SÉRIE A",
      teamA: "Santos",
      teamB: "Palmeiras",
      score: "VS",
      status: "EM BREVE",
      channels: "SPORTV • Premiere",
    },
  ];
}

export default function HomeTab() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tvScale = width >= 900 ? Math.min(1.3, Math.max(1.16, width / 1050)) : 1;

  const session = useSession((s) => s.session);
  const catalog = useSession((s) => s.catalog);
  const loadVod = useSession((s) => s.loadVod);
  const loadSeries = useSession((s) => s.loadSeries);
  const loadLive = useSession((s) => s.loadLive);

  const [activationCode, setActivationCode] = useState("LICENÇA ATIVA");
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  const [showJogosModal, setShowJogosModal] = useState(false);
  const [showEpgModal, setShowEpgModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [guiaJogos, setGuiaJogos] = useState<GuiaMatch[]>([]);
  const [jogoFilter, setJogoFilter] = useState<FilterTab>("todos");
  const [loadingJogos, setLoadingJogos] = useState(false);
  const [refreshingJogos, setRefreshingJogos] = useState(false);

  const [highlightsMatch, setHighlightsMatch] = useState<GuiaMatch | null>(null);
  const [highlightsVideoId, setHighlightsVideoId] = useState<string | null>(null);
  const [loadingHighlights, setLoadingHighlights] = useState(false);

  const [epgCategories, setEpgCategories] = useState<any[]>([]);
  const [selectedEpgCat, setSelectedEpgCat] = useState<string>("all");
  const [epgChannels, setEpgChannels] = useState<any[]>([]);
  const [epgByChannel, setEpgByChannel] = useState<Record<string, EpgProgramInfo>>({});

  const scrollAnimMovies = useRef(new Animated.Value(0)).current;
  const scrollAnimSeries = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const dateStr = now
        .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
        .toUpperCase();
      setCurrentTime(timeStr);
      setCurrentDate(dateStr);
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      AsyncStorage.getItem("@goldcast_saved_code")
        .then((code) => {
          if (code && isMounted) setActivationCode(code);
        })
        .catch(() => {});
      if (session) {
        if (loadVod) loadVod(true).catch(() => {});
        if (loadSeries) loadSeries(true).catch(() => {});
        if (loadLive) loadLive().catch(() => {});
      }
      return () => {
        isMounted = false;
      };
    }, [session, loadVod, loadSeries, loadLive])
  );

  useEffect(() => {
    const animMovies = Animated.loop(
      Animated.timing(scrollAnimMovies, {
        toValue: 1,
        duration: 26000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animMovies.start();

    const animSeries = Animated.loop(
      Animated.timing(scrollAnimSeries, {
        toValue: 1,
        duration: 26000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animSeries.start();

    return () => {
      animMovies.stop();
      animSeries.stop();
    };
  }, [scrollAnimMovies, scrollAnimSeries]);

  useEffect(() => {
    if (catalog?.liveCats) {
      setEpgCategories(catalog.liveCats);
    }
    if (catalog?.live) {
      setEpgChannels(catalog.live);
    }
  }, [catalog]);

  const filteredEpgChannels = useMemo(() => {
    if (selectedEpgCat === "all") return epgChannels.slice(0, 40);
    return epgChannels
      .filter((c) => String(c?.category_id) === String(selectedEpgCat))
      .slice(0, 40);
  }, [epgChannels, selectedEpgCat]);

  useEffect(() => {
    if (!showEpgModal || !session || filteredEpgChannels.length === 0) return;
    let isMounted = true;

    const fetchEpgData = async () => {
      const newMap: Record<string, EpgProgramInfo> = {};
      const visibleSlice = filteredEpgChannels.slice(0, 16);

      await Promise.all(
        visibleSlice.map(async (ch: any) => {
          const chId = String(ch?.stream_id || ch?.id || "");
          if (!chId) return;

          try {
            let entries: any[] = [];
            if (typeof (xtream as any)?.getShortEpg === "function") {
              const res = await (xtream as any).getShortEpg(session, chId, 4);
              entries = Array.isArray(res?.epg_listings)
                ? res.epg_listings
                : Array.isArray(res)
                ? res
                : [];
            } else if (typeof (xtream as any)?.getEpg === "function") {
              const res = await (xtream as any).getEpg(session, chId);
              entries = Array.isArray(res?.epg_listings)
                ? res.epg_listings
                : Array.isArray(res)
                ? res
                : [];
            }

            if (!entries.length) return;

            const nowMs = Date.now();
            const currentIdx = entries.findIndex((e: any) => {
              const start = parseEpgTimestamp(e?.start_timestamp || e?.start);
              const stop = parseEpgTimestamp(e?.stop_timestamp || e?.end);
              return start > 0 && stop > start && nowMs >= start && nowMs <= stop;
            });

            const currentEntry = currentIdx >= 0 ? entries[currentIdx] : entries[0];
            const nextEntry = currentIdx >= 0 ? entries[currentIdx + 1] : entries[1];

            const startMs = parseEpgTimestamp(currentEntry?.start_timestamp || currentEntry?.start);
            const stopMs = parseEpgTimestamp(currentEntry?.stop_timestamp || currentEntry?.end);
            const progress =
              startMs > 0 && stopMs > startMs
                ? Math.min(1, Math.max(0, (nowMs - startMs) / (stopMs - startMs)))
                : 0.35;

            const progTitle =
              decodeBase64Safe(currentEntry?.title) || currentEntry?.title || "Programação no Ar";
            const nextProgTitle =
              decodeBase64Safe(nextEntry?.title) || nextEntry?.title || undefined;

            newMap[chId] = {
              title: progTitle,
              startLabel: formatEpgTime(currentEntry?.start_timestamp || currentEntry?.start),
              endLabel: formatEpgTime(currentEntry?.stop_timestamp || currentEntry?.end),
              progress,
              nextTitle: nextProgTitle,
            };
          } catch {}
        })
      );

      if (isMounted) {
        setEpgByChannel((prev) => ({ ...prev, ...newMap }));
      }
    };

    fetchEpgData();
    return () => {
      isMounted = false;
    };
  }, [showEpgModal, session, filteredEpgChannels]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      return { movies: [], series: [], channels: [] };
    }
    const q = searchQuery.toLowerCase();

    const movies = (catalog?.vod || [])
      .filter((m: any) => (m?.name || "").toLowerCase().includes(q))
      .slice(0, 10);
    const series = (catalog?.series || [])
      .filter((s: any) => (s?.name || "").toLowerCase().includes(q))
      .slice(0, 10);
    const channels = (catalog?.live || [])
      .filter((c: any) => (c?.name || c?.title || "").toLowerCase().includes(q))
      .slice(0, 10);

    return { movies, series, channels };
  }, [searchQuery, catalog]);

  const carregarJogos = useCallback(async (isPull = false) => {
    if (isPull) setRefreshingJogos(true);
    else setLoadingJogos(true);

    try {
      const dados = await buscarJogosFutebolHoje();
      setGuiaJogos(dados);
    } finally {
      setLoadingJogos(false);
      setRefreshingJogos(false);
    }
  }, []);

  useEffect(() => {
    if (!showJogosModal) return;
    carregarJogos(false);
  }, [showJogosModal, carregarJogos]);

  const handleOpenHighlights = async (match: GuiaMatch) => {
    setHighlightsMatch(match);
    setHighlightsVideoId(null);
    setLoadingHighlights(true);

    const vid =
      (await buscarMelhoresMomentosVideoId(`${match.teamA} x ${match.teamB} melhores momentos`)) ||
      (await buscarMelhoresMomentosVideoId(`${match.teamA} ${match.teamB} highlights`));

    setHighlightsVideoId(vid);
    setLoadingHighlights(false);
  };

  const handleGoToMatchChannel = (match: GuiaMatch) => {
    setShowJogosModal(false);
    const canalSugerido = match.channels
      .split(/[•,|/]+/)
      .map((c) => c.trim())
      .find((c) => c.length > 1 && c.toLowerCase() !== "premiere • sportv • espn");

    router.push({
      pathname: "/(tabs)/live",
      params: { search: canalSugerido || match.teamA },
    });
  };

  const jogosFiltrados = useMemo(() => {
    if (jogoFilter === "ao_vivo") return guiaJogos.filter((j) => j.status === "AO VIVO");
    if (jogoFilter === "proximos") return guiaJogos.filter((j) => j.status === "EM BREVE");
    return guiaJogos;
  }, [guiaJogos, jogoFilter]);

  const isTestAccount = useMemo(() => {
    return !activationCode || activationCode.includes("TESTE") || activationCode.length < 5;
  }, [activationCode]);

  const moviesList = useMemo(() => (catalog?.vod || []).slice(0, 15), [catalog?.vod]);
  const seriesList = useMemo(() => (catalog?.series || []).slice(0, 15), [catalog?.series]);

  const translateXMovies = scrollAnimMovies.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -520],
  });

  const translateXSeries = scrollAnimSeries.interpolate({
    inputRange: [0, 1],
    outputRange: [-520, 0],
  });

  const cardW = Math.round(94 * tvScale);
  const cardH = Math.round(126 * tvScale);

  return (
    <View style={[styles.root, { backgroundColor: "#1B3B4B" }]}>
      <View style={styles.tvHeader}>
        <View style={styles.headerLeft}>
          <Pressable
            focusable={true}
            accessible={true}
            onPress={() => router.push("/(tabs)/settings")}
            style={({ focused }) => [styles.headerIconBtn, focused && styles.cardFocused]}
            hitSlop={10}
          >
            <Ionicons name="menu" size={Math.round(26 * tvScale)} color="#FFF" />
          </Pressable>
          <Text style={[styles.tvBrand, { fontSize: Math.round(16 * tvScale) }]}>
            GoldCast Media Player
          </Text>
        </View>

        <View style={styles.headerCenterCode}>
          <Ionicons name="key" size={14} color="#E9C46A" />
          <Text style={[styles.codeText, { fontSize: Math.round(11 * tvScale) }]}>
            {activationCode}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            focusable={true}
            accessible={true}
            onPress={() => setShowEpgModal(true)}
            style={({ focused }) => [styles.epgHeaderBtn, focused && styles.cardFocused]}
          >
            <Ionicons name="list" size={16} color="#E9C46A" />
            <Text style={[styles.epgBtnText, { fontSize: Math.round(11 * tvScale) }]}>EPG</Text>
          </Pressable>

          <Pressable
            focusable={true}
            accessible={true}
            style={({ focused }) => [styles.headerIconBtn, focused && styles.cardFocused]}
          >
            <Ionicons name="cart-outline" size={Math.round(22 * tvScale)} color="#FFF" />
          </Pressable>

          <Pressable
            focusable={true}
            accessible={true}
            style={({ focused }) => [styles.headerIconBtn, focused && styles.cardFocused]}
            onPress={() => setShowSearchModal(true)}
          >
            <Ionicons name="search-outline" size={Math.round(22 * tvScale)} color="#FFF" />
          </Pressable>

          <Text style={[styles.headerDate, { fontSize: Math.round(11 * tvScale) }]}>
            {currentDate}
          </Text>
          <Text style={[styles.headerTime, { fontSize: Math.round(12 * tvScale) }]}>
            {currentTime}
          </Text>
        </View>
      </View>

      <View style={styles.mainLayoutContainer}>
        <View style={styles.leftContainer}>
          <View style={styles.dynamicRowSection}>
            <Text
              style={[styles.sectionCategoryTitle, { fontSize: Math.round(12.5 * tvScale) }]}
            >
              🎬 Filmes | Novidades
            </Text>
            <View style={[styles.tickerWrapper, { height: cardH }]}>
              <Animated.View
                style={[styles.tickerTrack, { transform: [{ translateX: translateXMovies }] }]}
              >
                {moviesList.concat(moviesList).map((item, idx) => (
                  <Pressable
                    key={`mov-${item.stream_id}-${idx}`}
                    focusable={true}
                    accessible={true}
                    onPress={() =>
                      router.push({
                        pathname: "/movie/[id]",
                        params: { id: String(item.stream_id) },
                      })
                    }
                    style={({ focused }) => [
                      styles.tickerCard,
                      { width: cardW, height: cardH },
                      focused && styles.cardFocused,
                    ]}
                  >
                    <Image
                      source={{ uri: item.stream_icon }}
                      style={styles.fullSize}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                    />
                    <View style={styles.tickerGradient}>
                      <Text
                        style={[styles.tickerTitle, { fontSize: Math.round(9.5 * tvScale) }]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </Animated.View>
            </View>
          </View>

          <View style={styles.dynamicRowSection}>
            <Text
              style={[styles.sectionCategoryTitle, { fontSize: Math.round(12.5 * tvScale) }]}
            >
              🍿 Séries | Em Alta
            </Text>
            <View style={[styles.tickerWrapper, { height: cardH }]}>
              <Animated.View
                style={[styles.tickerTrack, { transform: [{ translateX: translateXSeries }] }]}
              >
                {seriesList.concat(seriesList).map((s, idx) => (
                  <Pressable
                    key={`ser-${s.series_id}-${idx}`}
                    focusable={true}
                    accessible={true}
                    onPress={() =>
                      router.push({
                        pathname: "/series/[id]",
                        params: { id: String(s.series_id) },
                      })
                    }
                    style={({ focused }) => [
                      styles.tickerCard,
                      { width: cardW, height: cardH },
                      focused && styles.cardFocused,
                    ]}
                  >
                    <Image
                      source={{ uri: s.cover }}
                      style={styles.fullSize}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                    />
                    <View style={styles.tickerGradient}>
                      <Text
                        style={[styles.tickerTitle, { fontSize: Math.round(9.5 * tvScale) }]}
                        numberOfLines={1}
                      >
                        {s.name}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </Animated.View>
            </View>
          </View>

          <View style={styles.bottomBarBelow}>
            <Pressable
              focusable={true}
              accessible={true}
              onPress={() => setShowJogosModal(true)}
              style={({ focused }) => [styles.bottomCard, focused && styles.cardFocused]}
            >
              <Ionicons name="football-outline" size={20} color="#FFF" />
              <Text style={[styles.bottomCardText, { fontSize: Math.round(11 * tvScale) }]}>
                JOGOS DE HOJE
              </Text>
            </Pressable>

            <Pressable
              focusable={true}
              accessible={true}
              onPress={() => router.push("/(tabs)/updates")}
              style={({ focused }) => [styles.bottomCard, focused && styles.cardFocused]}
            >
              <Ionicons name="logo-youtube" size={20} color="#FF0000" />
              <Text style={[styles.bottomCardText, { fontSize: Math.round(11 * tvScale) }]}>
                YOUTUBE
              </Text>
            </Pressable>

            <Pressable
              focusable={true}
              accessible={true}
              onPress={() => router.push("/continue")}
              style={({ focused }) => [styles.bottomCard, focused && styles.cardFocused]}
            >
              <Ionicons name="play-circle-outline" size={20} color="#E9C46A" />
              <Text
                style={[
                  styles.bottomCardText,
                  { color: "#E9C46A", fontSize: Math.round(11 * tvScale) },
                ]}
              >
                CONTINUAR
              </Text>
            </Pressable>

            <View style={styles.statusBadgeWrap}>
              <Text
                style={[
                  styles.premiumLabel,
                  { fontSize: Math.round(12 * tvScale) },
                  isTestAccount && { color: "#E76F51" },
                ]}
              >
                {isTestAccount ? "Teste" : "Premium"}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.rightColumn, { width: Math.round(190 * tvScale) }]}>
          <Pressable
            focusable={true}
            accessible={true}
            onPress={() => router.push("/(tabs)/movies")}
            style={({ focused }) => [
              styles.cardTriple,
              { backgroundColor: "#E76F51" },
              focused && styles.cardFocused,
            ]}
          >
            <View style={styles.cardTripleInner}>
              <Ionicons name="play-circle-outline" size={Math.round(34 * tvScale)} color="#FFF" />
              <Text style={[styles.cardTitleTriple, { fontSize: Math.round(14 * tvScale) }]}>
                FILMES
              </Text>
            </View>
          </Pressable>

          <Pressable
            focusable={true}
            accessible={true}
            onPress={() => router.push("/(tabs)/series")}
            style={({ focused }) => [
              styles.cardTriple,
              { backgroundColor: "#F4A261" },
              focused && styles.cardFocused,
            ]}
          >
            <View style={styles.cardTripleInner}>
              <Ionicons name="film-outline" size={Math.round(34 * tvScale)} color="#FFF" />
              <Text style={[styles.cardTitleTriple, { fontSize: Math.round(14 * tvScale) }]}>
                SÉRIES
              </Text>
            </View>
          </Pressable>

          <Pressable
            focusable={true}
            accessible={true}
            onPress={() => router.push("/(tabs)/live")}
            style={({ focused }) => [
              styles.cardTriple,
              { backgroundColor: "#2A9D8F" },
              focused && styles.cardFocused,
            ]}
          >
            <View style={styles.cardTripleInner}>
              <Ionicons name="tv-outline" size={Math.round(34 * tvScale)} color="#FFF" />
              <Text style={[styles.cardTitleTriple, { fontSize: Math.round(14 * tvScale) }]}>
                CANAIS
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* MODAL PREMIUM DE FUTEBOL */}
      <Modal
        visible={showJogosModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setHighlightsMatch(null);
          setHighlightsVideoId(null);
          setShowJogosModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="football" size={18} color="#E9C46A" />
                </View>
                <Text style={styles.modalTitle}>⚽ FUTEBOL PREMIUM — HOJE</Text>
              </View>

              <View style={styles.tabToggleRow}>
                <Pressable
                  focusable={true}
                  onPress={() => setJogoFilter("todos")}
                  style={[styles.tabBtn, jogoFilter === "todos" && styles.tabBtnActive]}
                >
                  <Text
                    style={[styles.tabBtnText, jogoFilter === "todos" && styles.tabBtnTextActive]}
                  >
                    Todos
                  </Text>
                </Pressable>
                <Pressable
                  focusable={true}
                  onPress={() => setJogoFilter("ao_vivo")}
                  style={[styles.tabBtn, jogoFilter === "ao_vivo" && styles.tabBtnActive]}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      jogoFilter === "ao_vivo" && styles.tabBtnTextActive,
                    ]}
                  >
                    🔴 Ao Vivo
                  </Text>
                </Pressable>
                <Pressable
                  focusable={true}
                  onPress={() => setJogoFilter("proximos")}
                  style={[styles.tabBtn, jogoFilter === "proximos" && styles.tabBtnActive]}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      jogoFilter === "proximos" && styles.tabBtnTextActive,
                    ]}
                  >
                    🕒 Próximos
                  </Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Pressable
                  onPress={() => carregarJogos(true)}
                  style={styles.closeBtn}
                  focusable={true}
                >
                  <Ionicons name="refresh" size={18} color="#E9C46A" />
                </Pressable>
                <Pressable
                  onPress={() => {
                    setHighlightsMatch(null);
                    setHighlightsVideoId(null);
                    setShowJogosModal(false);
                  }}
                  style={styles.closeBtn}
                  focusable={true}
                >
                  <Ionicons name="close" size={18} color="#FFF" />
                </Pressable>
              </View>
            </View>

            {highlightsMatch && (
              <View style={styles.highlightsBox}>
                <View style={styles.highlightsHeader}>
                  <Text style={styles.highlightsTitle} numberOfLines={1}>
                    🎬 Melhores Momentos: {highlightsMatch.teamA} x {highlightsMatch.teamB}
                  </Text>
                  <Pressable
                    focusable={true}
                    onPress={() => {
                      setHighlightsMatch(null);
                      setHighlightsVideoId(null);
                    }}
                    style={styles.smallCloseBtn}
                  >
                    <Ionicons name="close" size={14} color="#FFF" />
                  </Pressable>
                </View>

                {loadingHighlights ? (
                  <View style={styles.highlightsLoading}>
                    <ActivityIndicator size="small" color="#E9C46A" />
                    <Text style={styles.loadingText}>Buscando vídeo de melhores momentos...</Text>
                  </View>
                ) : highlightsVideoId ? (
                  <View style={styles.videoPlayerWrap}>
                    <YoutubePlayer
                      height={175}
                      width={520}
                      play={true}
                      videoId={highlightsVideoId}
                      webViewStyle={{ opacity: 0.99 }}
                    />
                  </View>
                ) : (
                  <Text style={styles.loadingText}>
                    Vídeo não encontrado no momento para este confronto.
                  </Text>
                )}
              </View>
            )}

            {loadingJogos ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#E9C46A" />
                <Text style={styles.loadingText}>
                  Carregando partidas, escudos e placares...
                </Text>
              </View>
            ) : jogosFiltrados.length === 0 ? (
              <View style={styles.centerBox}>
                <Ionicons name="football-outline" size={36} color="#E9C46A" />
                <Text style={styles.loadingText}>
                  Nenhuma partida encontrada neste filtro.
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshingJogos}
                    onRefresh={() => carregarJogos(true)}
                    tintColor="#E9C46A"
                  />
                }
              >
                {jogosFiltrados.map((g) => (
                  <View key={g.id} style={styles.guiaCard}>
                    <View style={styles.guiaCardTopRow}>
                      <View style={styles.guiaTimeBadge}>
                        <Ionicons name="time-outline" size={12} color="#000" />
                        <Text style={styles.guiaTimeText}>{g.time}</Text>
                      </View>
                      <View
                        style={[styles.statusBadge, g.status === "AO VIVO" && styles.statusLive]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            g.status === "AO VIVO" && { color: "#FFF" },
                          ]}
                        >
                          {g.status}
                        </Text>
                      </View>
                      <Text style={styles.guiaLeagueText} numberOfLines={1}>
                        {g.league}
                      </Text>
                    </View>

                    <View style={styles.guiaMatchRow}>
                      <View style={styles.teamWithBadge}>
                        {g.logoA ? (
                          <Image
                            source={{ uri: g.logoA }}
                            style={styles.teamCrest}
                            contentFit="contain"
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <Ionicons name="shield-outline" size={18} color="#E9C46A" />
                        )}
                        <Text style={styles.teamText} numberOfLines={1}>
                          {g.teamA}
                        </Text>
                      </View>

                      <View style={styles.scoreBox}>
                        <Text style={styles.scoreText}>{g.score}</Text>
                      </View>

                      <View style={[styles.teamWithBadge, styles.teamWithBadgeRight]}>
                        <Text
                          style={[styles.teamText, { textAlign: "right" }]}
                          numberOfLines={1}
                        >
                          {g.teamB}
                        </Text>
                        {g.logoB ? (
                          <Image
                            source={{ uri: g.logoB }}
                            style={styles.teamCrest}
                            contentFit="contain"
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <Ionicons name="shield-outline" size={18} color="#E9C46A" />
                        )}
                      </View>
                    </View>

                    <View style={styles.guiaFooterRow}>
                      <View style={styles.guiaChannelsRow}>
                        <Ionicons name="tv-outline" size={13} color="#E9C46A" />
                        <Text style={styles.guiaChannelsText} numberOfLines={1}>
                          {g.channels}
                        </Text>
                      </View>

                      <View style={styles.matchActionsRow}>
                        <Pressable
                          focusable={true}
                          onPress={() => handleOpenHighlights(g)}
                          style={({ focused }) => [
                            styles.actionPillBtn,
                            focused && styles.cardFocused,
                          ]}
                        >
                          <Ionicons name="play-circle" size={13} color="#E9C46A" />
                          <Text style={styles.actionPillText}>Melhores Momentos</Text>
                        </Pressable>

                        <Pressable
                          focusable={true}
                          onPress={() => handleGoToMatchChannel(g)}
                          style={({ focused }) => [
                            styles.actionPillGoldBtn,
                            focused && styles.cardFocused,
                          ]}
                        >
                          <Ionicons name="tv" size={13} color="#000" />
                          <Text style={styles.actionPillGoldText}>Canal</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL DE PESQUISA */}
      <Modal
        visible={showSearchModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔍 BUSCAR NO CATÁLOGO</Text>
              <Pressable
                onPress={() => setShowSearchModal(false)}
                style={styles.closeBtn}
                focusable={true}
              >
                <Ionicons name="close" size={18} color="#FFF" />
              </Pressable>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Digite o nome de um filme, série ou canal..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
            />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
              {searchResults.channels.map((c: any, idx: number) => (
                <Pressable
                  key={`sr-ch-${idx}`}
                  focusable={true}
                  onPress={() => {
                    setShowSearchModal(false);
                    router.push({
                      pathname: "/(tabs)/live",
                      params: { search: c?.name || c?.title || "" },
                    });
                  }}
                  style={styles.searchResultRow}
                >
                  <Ionicons name="tv-outline" size={16} color="#2A9D8F" />
                  <Text style={styles.searchResultText} numberOfLines={1}>
                    {c?.name || c?.title}
                  </Text>
                </Pressable>
              ))}

              {searchResults.movies.map((m: any, idx: number) => (
                <Pressable
                  key={`sr-mv-${idx}`}
                  focusable={true}
                  onPress={() => {
                    setShowSearchModal(false);
                    router.push({
                      pathname: "/movie/[id]",
                      params: { id: String(m?.stream_id || "") },
                    });
                  }}
                  style={styles.searchResultRow}
                >
                  <Ionicons name="film-outline" size={16} color="#E76F51" />
                  <Text style={styles.searchResultText} numberOfLines={1}>
                    {m?.name}
                  </Text>
                </Pressable>
              ))}

              {searchResults.series.map((s: any, idx: number) => (
                <Pressable
                  key={`sr-sr-${idx}`}
                  focusable={true}
                  onPress={() => {
                    setShowSearchModal(false);
                    router.push({
                      pathname: "/series/[id]",
                      params: { id: String(s?.series_id || "") },
                    });
                  }}
                  style={styles.searchResultRow}
                >
                  <Ionicons name="albums-outline" size={16} color="#F4A261" />
                  <Text style={styles.searchResultText} numberOfLines={1}>
                    {s?.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL EPG RICO EM TEMPO REAL */}
      <Modal
        visible={showEpgModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowEpgModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="tv" size={18} color="#E9C46A" />
                </View>
                <Text style={styles.modalTitle}>📺 GUIA DE PROGRAMAÇÃO (EPG AO VIVO)</Text>
              </View>

              <Pressable
                onPress={() => setShowEpgModal(false)}
                style={styles.closeBtn}
                focusable={true}
              >
                <Ionicons name="close" size={18} color="#FFF" />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ maxHeight: 38, marginBottom: 8 }}
              contentContainerStyle={{ gap: 8 }}
            >
              <Pressable
                focusable={true}
                onPress={() => setSelectedEpgCat("all")}
                style={[styles.tabBtn, selectedEpgCat === "all" && styles.tabBtnActive]}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    selectedEpgCat === "all" && styles.tabBtnTextActive,
                  ]}
                >
                  Todos
                </Text>
              </Pressable>
              {epgCategories.map((cat: any, idx: number) => {
                const catId = String(cat?.category_id || cat?.id || idx);
                const active = selectedEpgCat === catId;
                return (
                  <Pressable
                    key={`epg-cat-${catId}-${idx}`}
                    focusable={true}
                    onPress={() => setSelectedEpgCat(catId)}
                    style={[styles.tabBtn, active && styles.tabBtnActive]}
                  >
                    <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
                      {cat?.category_name || cat?.name || "Categoria"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
              {filteredEpgChannels.map((ch: any, idx: number) => {
                const chId = String(ch?.stream_id || ch?.id || idx);
                const chName = ch?.name || ch?.title || "Canal";
                const chLogo = ch?.stream_icon || "";
                const epg = epgByChannel[chId];

                return (
                  <Pressable
                    key={`epg-ch-${chId}-${idx}`}
                    focusable={true}
                    onPress={() => {
                      setShowEpgModal(false);
                      router.push({
                        pathname: "/(tabs)/live",
                        params: { search: chName },
                      });
                    }}
                    style={({ focused }) => [
                      styles.epgChannelCard,
                      focused && styles.cardFocused,
                    ]}
                  >
                    <View style={styles.epgChannelLeft}>
                      {chLogo ? (
                        <Image
                          source={{ uri: chLogo }}
                          style={styles.epgChannelLogo}
                          contentFit="contain"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View style={styles.epgLogoPlaceholder}>
                          <Ionicons name="tv-outline" size={18} color="#E9C46A" />
                        </View>
                      )}
                      <Text style={styles.epgChannelName} numberOfLines={1}>
                        {chName}
                      </Text>
                    </View>

                    <View style={styles.epgProgramCenter}>
                      <View style={styles.epgProgramHeader}>
                        <Text style={styles.epgProgramTitle} numberOfLines={1}>
                          {epg?.title || "Programação em direto"}
                        </Text>
                        {epg?.startLabel ? (
                          <Text style={styles.epgTimeRange}>
                            {epg.startLabel} {epg.endLabel ? `— ${epg.endLabel}` : ""}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.epgProgressTrack}>
                        <View
                          style={[
                            styles.epgProgressFill,
                            { width: `${Math.round((epg?.progress || 0.4) * 100)}%` },
                          ]}
                        />
                      </View>

                      {epg?.nextTitle ? (
                        <Text style={styles.epgNextProgram} numberOfLines={1}>
                          A seguir: {epg.nextTitle}
                        </Text>
                      ) : null}
                    </View>

                    <Ionicons name="chevron-forward" size={16} color="#E9C46A" />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingVertical: 14 },
  tvHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIconBtn: { padding: 6, borderRadius: 8, borderWidth: 2, borderColor: "transparent" },
  tvBrand: { color: "#FFF", fontSize: 16, fontWeight: "900" },
  headerCenterCode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.35)",
  },
  codeText: { color: "#E9C46A", fontSize: 11, fontWeight: "800" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  epgHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(233,196,106,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(233,196,106,0.35)",
  },
  epgBtnText: { color: "#E9C46A", fontSize: 11, fontWeight: "900" },
  headerDate: { color: "#D1D5DB", fontSize: 11, fontWeight: "700" },
  headerTime: { color: "#FFF", fontSize: 12, fontWeight: "900" },

  mainLayoutContainer: { flex: 1, flexDirection: "row", gap: 16 },
  leftContainer: { flex: 1, justifyContent: "space-between" },
  dynamicRowSection: { marginBottom: 6 },
  sectionCategoryTitle: { color: "#FFF", fontSize: 12.5, fontWeight: "800", marginBottom: 5 },
  tickerWrapper: { height: 126, overflow: "hidden", borderRadius: 12 },
  tickerTrack: { flexDirection: "row", gap: 10 },
  tickerCard: {
    width: 94,
    height: 126,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#152E3B",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.08)",
  },
  fullSize: { width: "100%", height: "100%" },
  tickerGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.78)",
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  tickerTitle: { color: "#FFF", fontSize: 9.5, fontWeight: "700" },

  bottomBarBelow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  bottomCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#152E3B",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  bottomCardText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  statusBadgeWrap: { marginLeft: "auto", paddingHorizontal: 8 },
  premiumLabel: { color: "#E9C46A", fontSize: 12, fontWeight: "900" },

  rightColumn: { width: 190, gap: 10 },
  cardTriple: {
    flex: 1,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardTripleInner: { alignItems: "center", gap: 6 },
  cardTitleTriple: { color: "#FFF", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  cardFocused: {
    borderColor: "#E9C46A",
    borderWidth: 3,
    transform: [{ scale: 1.03 }],
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.84)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 780,
    height: "88%",
    backgroundColor: "#141722",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(233,196,106,0.4)",
    padding: 18,
    gap: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  modalIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(233,196,106,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { color: "#E9C46A", fontSize: 14, fontWeight: "900" },
  tabToggleRow: { flexDirection: "row", gap: 6 },
  tabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#1E2230",
  },
  tabBtnActive: { backgroundColor: "#E9C46A" },
  tabBtnText: { color: "#D1D5DB", fontSize: 11, fontWeight: "700" },
  tabBtnTextActive: { color: "#000", fontWeight: "900" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#222634",
    alignItems: "center",
    justifyContent: "center",
  },
  smallCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#222634",
    alignItems: "center",
    justifyContent: "center",
  },
  highlightsBox: {
    backgroundColor: "#10131C",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.3)",
    alignItems: "center",
    gap: 8,
  },
  highlightsHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  highlightsTitle: { color: "#E9C46A", fontSize: 12, fontWeight: "800", flex: 1 },
  highlightsLoading: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14 },
  videoPlayerWrap: { borderRadius: 10, overflow: "hidden", backgroundColor: "#000" },

  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: "#9CA3AF", fontSize: 12.5, fontWeight: "600" },
  listContainer: { gap: 10, paddingBottom: 16 },
  guiaCard: {
    backgroundColor: "#1A1E2D",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  guiaCardTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  guiaTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E9C46A",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  guiaTimeText: { color: "#000", fontSize: 10, fontWeight: "900" },
  statusBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  statusLive: { backgroundColor: "#EF4444" },
  statusText: { color: "#D1D5DB", fontSize: 9.5, fontWeight: "800" },
  guiaLeagueText: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  guiaMatchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 2,
  },
  teamWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1,
  },
  teamWithBadgeRight: {
    justifyContent: "flex-end",
  },
  teamCrest: {
    width: 22,
    height: 22,
  },
  teamText: { color: "#FFF", fontSize: 13, fontWeight: "800", flexShrink: 1 },
  scoreBox: {
    backgroundColor: "rgba(0,0,0,0.38)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.2)",
  },
  scoreText: { color: "#E9C46A", fontSize: 12.5, fontWeight: "900" },

  guiaFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  guiaChannelsRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  guiaChannelsText: { color: "#D1D5DB", fontSize: 11, fontWeight: "700", flex: 1 },
  matchActionsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(233,196,106,0.14)",
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.35)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  actionPillText: { color: "#E9C46A", fontSize: 10.5, fontWeight: "800" },
  actionPillGoldBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E9C46A",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  actionPillGoldText: { color: "#000", fontSize: 10.5, fontWeight: "900" },

  searchInput: {
    backgroundColor: "#1A1E2D",
    color: "#FFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.25)",
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1A1E2D",
    padding: 12,
    borderRadius: 10,
  },
  searchResultText: { color: "#FFF", fontSize: 13, fontWeight: "700", flex: 1 },

  epgChannelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1A1E2D",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.06)",
  },
  epgChannelLeft: {
    width: 140,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  epgChannelLogo: {
    width: 32,
    height: 32,
  },
  epgLogoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  epgChannelName: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },
  epgProgramCenter: {
    flex: 1,
    gap: 4,
  },
  epgProgramHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  epgProgramTitle: {
    color: "#E9C46A",
    fontSize: 12.5,
    fontWeight: "800",
    flex: 1,
  },
  epgTimeRange: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "700",
  },
  epgProgressTrack: {
    width: "100%",
    height: 3.5,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  epgProgressFill: {
    height: "100%",
    backgroundColor: "#E9C46A",
  },
  epgNextProgram: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "600",
  },
});
