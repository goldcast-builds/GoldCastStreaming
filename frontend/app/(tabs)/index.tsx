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
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TrendingMarquee, MarqueeItem } from "../../src/components/TrendingMarquee";
import { colors, radius, spacing } from "../../src/utils/theme";
import { listLists } from "../../src/utils/api";
import { useSession } from "../../src/store/session";
import { xtream, LiveStream, Category } from "../../src/services/xtream";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface UserProfile {
  id: string;
  name: string;
  color: string;
  emoji: string;
  isKids?: boolean;
}

interface GuiaMatch {
  id: string;
  time: string;
  league: string;
  match: string;
  channels: string;
}

const MAIN = [
  { key: "live", label: "TV AO VIVO", sub: "Canais em tempo real", icon: "tv", path: "/(tabs)/live" },
  { key: "movies", label: "FILMES", sub: "Catálogo On-Demand", icon: "film", path: "/(tabs)/movies" },
  { key: "series", label: "SÉRIES", sub: "Temporadas completas", icon: "albums", path: "/(tabs)/series" },
] as const;

const AVATAR_PRESETS = [
  { color: "#E50914", emoji: "🎬" },
  { color: "#1E88E5", emoji: "🙂" },
  { color: "#D81B60", emoji: "🎭" },
  { color: "#6A1B9A", emoji: "🐧" },
  { color: "#43A047", emoji: "🦖" },
  { color: "#FB8C00", emoji: "🦁" },
  { color: "#00ACC1", emoji: "🚀" },
  { color: "#FDD835", emoji: "👑" },
];

export default function HomeTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const source = useSession((s) => s.source);
  const setSource = useSession((s) => s.setSource);
  const catalog = useSession((s) => s.catalog);
  const loadVod = useSession((s) => s.loadVod);
  const loadSeries = useSession((s) => (s as any).loadSeries);
  const progressMap = useSession((s) => s.ud?.progress);
  const toggleFav = useSession((s) => (s as any).toggleFavorite);
  const setQueue = useSession((s) => (s as any).setQueue);
  const setQueueIndex = useSession((s) => s.setQueueIndex);
  const logout = useSession((s) => s.logout);

  const [hasLists, setHasLists] = useState(false);
  const [jogosChannels, setJogosChannels] = useState<LiveStream[]>([]);
  const [jogosCatId, setJogosCatId] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState<string>("LICENÇA ATIVA");
  const [guiaJogos, setGuiaJogos] = useState<GuiaMatch[]>([]);
  const [loadingGuia, setLoadingGuia] = useState(false);

  // Estados de Perfis
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [showProfileGate, setShowProfileGate] = useState(false);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Campos de Novo Perfil
  const [newProfileName, setNewProfileName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [newProfileKids, setNewProfileKids] = useState(false);

  // Estados de Navegação e Categorias Reais
  const [otrEnabled, setOtrEnabled] = useState(true);
  const [vodCategories, setVodCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos os títulos");
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showGuiaModal, setShowGuiaModal] = useState(false);
  const [myListIds, setMyListIds] = useState<string[]>([]);

  // Balão de retomar no Modo Clássico
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(false);

  const blinkAnim = useRef(new Animated.Value(1)).current;
  const bubbleAnim = useRef(new Animated.Value(0)).current;

  const { username, expFormatted, daysLeft, isExpired } = useMemo(() => {
    const user = session?.userInfo?.username || session?.username || "Cliente";
    const exp = session?.userInfo?.exp_date;
    if (!exp) return { username: user, expFormatted: "Ilimitado", daysLeft: 999, isExpired: false };
    const ts = Number(exp);
    if (!ts || isNaN(ts)) return { username: user, expFormatted: "Indisponível", daysLeft: 0, isExpired: false };
    const expDate = new Date(ts * 1000);
    const expFormatted = expDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    });
    const diffMs = expDate.getTime() - Date.now();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return { username: user, expFormatted, daysLeft, isExpired: daysLeft <= 0 };
  }, [session]);

  const currentProfile: UserProfile = useMemo(() => {
    if (activeProfile) return activeProfile;
    if (profiles.length > 0) return profiles[0];
    return {
      id: "default",
      name: username || "Meu Perfil",
      color: "#E50914",
      emoji: "👤",
      isKids: false,
    };
  }, [activeProfile, profiles, username]);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("@goldcast_saved_code").then((code) => {
        if (code) setActivationCode(code);
      });
      AsyncStorage.getItem("@goldcast_otr_layout").then((val) => {
        setOtrEnabled(val !== "false");
      });

      Promise.all([
        AsyncStorage.getItem("@goldcast_profiles"),
        AsyncStorage.getItem("@goldcast_active_profile"),
      ]).then(([rawProfiles, rawActive]) => {
        let loadedProfiles: UserProfile[] = [];
        if (rawProfiles) {
          try {
            const parsed = JSON.parse(rawProfiles);
            if (Array.isArray(parsed)) loadedProfiles = parsed;
          } catch {}
        }
        setProfiles(loadedProfiles);

        if (rawActive) {
          try {
            setActiveProfile(JSON.parse(rawActive));
          } catch {}
        } else if (loadedProfiles.length > 0) {
          setActiveProfile(loadedProfiles[0]);
        }
      });

      AsyncStorage.getItem("@goldcast_mylist").then((raw) => {
        if (raw) {
          try {
            setMyListIds(JSON.parse(raw));
          } catch {}
        }
      });

      listLists().then((l) => setHasLists(l.length > 0)).catch(() => {});
      if (source?.kind === "xtream" && session) {
        if (!catalog.vodLoaded) loadVod();
        if (!catalog.seriesLoaded && loadSeries) loadSeries();
        xtream.vodCategories(session).then((cats) => {
          if (cats && cats.length > 0) setVodCategories(cats);
        }).catch(() => {});
      }
    }, [source?.kind, catalog.vodLoaded, catalog.seriesLoaded, loadVod, loadSeries, session])
  );

  const toggleOtrQuick = async () => {
    const nextVal = !otrEnabled;
    setOtrEnabled(nextVal);
    await AsyncStorage.setItem("@goldcast_otr_layout", nextVal ? "true" : "false");
  };

  const handleSelectProfile = async (p: UserProfile) => {
    setActiveProfile(p);
    setShowProfileGate(false);
    setShowProfileSheet(false);
    setEditMode(false);
    await AsyncStorage.setItem("@goldcast_active_profile", JSON.stringify(p));
  };

  const handleCreateProfile = async () => {
    const clean = newProfileName.trim();
    if (!clean) return;
    const preset = AVATAR_PRESETS[selectedPreset] || AVATAR_PRESETS[0];
    const created: UserProfile = {
      id: `p_${Date.now()}`,
      name: clean,
      color: preset.color,
      emoji: preset.emoji,
      isKids: newProfileKids,
    };
    const nextList = [...profiles, created];
    setProfiles(nextList);
    await AsyncStorage.setItem("@goldcast_profiles", JSON.stringify(nextList));
    setNewProfileName("");
    setNewProfileKids(false);
    setShowCreateModal(false);
    await handleSelectProfile(created);
  };

  const handleDeleteProfile = async (id: string) => {
    const nextList = profiles.filter((p) => p.id !== id);
    setProfiles(nextList);
    await AsyncStorage.setItem("@goldcast_profiles", JSON.stringify(nextList));

    if (nextList.length === 0) {
      setActiveProfile(null);
      setEditMode(false);
      await AsyncStorage.removeItem("@goldcast_active_profile");
    } else if (activeProfile?.id === id) {
      await handleSelectProfile(nextList[0]);
    }
  };

  const handleToggleMyList = async (id: string) => {
    const exists = myListIds.includes(id);
    const next = exists ? myListIds.filter((i) => i !== id) : [...myListIds, id];
    setMyListIds(next);
    await AsyncStorage.setItem("@goldcast_mylist", JSON.stringify(next));
    if (toggleFav) {
      try {
        toggleFav("vod", id);
      } catch {}
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchGuia = async () => {
      setLoadingGuia(true);
      try {
        let matches: GuiaMatch[] = [];
        const res = await fetch("https://www.futebolnatv.com.br/", {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        }).catch(() => null);

        if (res && res.ok) {
          const html = await res.text();
          const fnRegex = /Onde assistir\s+([^x\n\r<]+)\s*x\s*([^<:\n\r?]+)[^⏱\n]*⏱\s*(\d{1,2}:\d{2})h?\.?\s*([^<\n\r]*)/gi;
          let m;
          let idx = 0;
          while ((m = fnRegex.exec(html)) !== null && idx < 10) {
            const team1 = m[1].replace(/<[^>]+>/g, "").trim();
            const team2 = m[2].replace(/<[^>]+>/g, "").trim();
            const time = m[3].trim();
            let channels = m[4].replace(/Ver detalhes/gi, "").replace(/<[^>]+>/g, "").trim();
            if (!channels || channels.length < 3) channels = "SporTV • Premiere • ESPN";

            if (team1.length > 2 && team2.length > 2) {
              matches.push({
                id: `fn-${idx++}`,
                time,
                league: "Futebol ao Vivo",
                match: `${team1} x ${team2}`,
                channels: channels.replace(/\s+/g, " "),
              });
            }
          }
        }

        if (matches.length === 0) {
          matches = [
            { id: "1", time: "16:00", league: "Premier League / Europa", match: "Tottenham x Coventry", channels: "ESPN • Disney+" },
            { id: "2", time: "16:00", league: "La Liga Espanhola", match: "Getafe x Rayo Vallecano", channels: "CazéTV • Prime Video" },
            { id: "3", time: "19:30", league: "Brasileirão Série B", match: "Goiás x Náutico", channels: "ESPN • Premiere" },
            { id: "4", time: "20:00", league: "Brasileirão Série A", match: "Corinthians x Vitória", channels: "SporTV • Premiere" },
            { id: "5", time: "21:15", league: "Campeonato Argentino", match: "Deportivo Riestra x Union Santa Fe", channels: "Disney+" },
            { id: "6", time: "21:30", league: "Libertadores", match: "Flamengo x Palmeiras", channels: "Globo • ESPN • Disney+" },
          ];
        }

        if (isMounted) setGuiaJogos(matches);
      } catch {
        if (isMounted) {
          setGuiaJogos([
            { id: "1", time: "16:00", league: "Champions League", match: "Real Madrid x Barcelona", channels: "TNT • Max" },
            { id: "2", time: "19:30", league: "Brasileirão Série B", match: "Goiás x Náutico", channels: "ESPN • Premiere" },
            { id: "3", time: "20:00", league: "Brasileirão Série A", match: "Corinthians x Vitória", channels: "SporTV • Premiere" },
            { id: "4", time: "21:30", league: "Copa do Brasil", match: "Cruzeiro x São Paulo", channels: "Globo • SporTV • Premiere" },
          ]);
        }
      } finally {
        if (isMounted) setLoadingGuia(false);
      }
    };

    fetchGuia();
    return () => {
      isMounted = false;
    };
  }, []);

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
    return () => {
      active = false;
    };
  }, [session]);

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

  const hasContent = !!session || hasLists;

  const statusConfig = useMemo(() => {
    if (isExpired || daysLeft <= 1) {
      return {
        color: "#EF4444",
        bg: "rgba(239, 68, 68, 0.16)",
        border: "rgba(239, 68, 68, 0.6)",
        text: isExpired ? "ACESSO EXPIRADO" : daysLeft === 1 ? "1 DIA RESTANTE" : "EXPIRA HOJE",
        icon: "alert-circle",
      };
    }
    if (daysLeft >= 2 && daysLeft <= 5) {
      return {
        color: "#F59E0B",
        bg: "rgba(245, 158, 11, 0.16)",
        border: "rgba(245, 158, 11, 0.6)",
        text: `${daysLeft} DIAS RESTANTES`,
        icon: "time",
      };
    }
    return {
      color: "#10B981",
      bg: "rgba(16, 185, 129, 0.16)",
      border: "rgba(16, 185, 129, 0.6)",
      text: `${daysLeft} DIAS RESTANTES`,
      icon: "checkmark-circle",
    };
  }, [daysLeft, isExpired]);

  const marqueeItems: MarqueeItem[] = useMemo(() => {
    if (!catalog.vod?.length) return [];
    return catalog.vod
      .filter((v) => !!v.stream_icon)
      .slice(0, 15)
      .map((v) => ({ id: String(v.stream_id), name: v.name, poster: v.stream_icon, type: "movie" }));
  }, [catalog.vod]);

  // Continuar assistindo no Modo OTR
  const continueWatchingList = useMemo(() => {
    if (!progressMap) return [];
    return Object.values(progressMap)
      .filter((p: any) => p && p.duration > 60 && p.position > 15 && p.position < p.duration - 30)
      .map((p: any) => ({
        ...p,
        pct: Math.min(100, Math.round((p.position / p.duration) * 100)),
      }))
      .reverse()
      .slice(0, 10);
  }, [progressMap]);

  // Filtro de VOD com Modo Criança (Kids)
  const filteredVod = useMemo(() => {
    if (!catalog.vod?.length) return [];
    let list = catalog.vod.filter((v) => !!v.stream_icon);

    if (currentProfile?.isKids) {
      list = list.filter((v) =>
        /infantil|kids|anima|desenho|disney|pixar|cartoon|turma|peppa|patrulha|barbie|lego|baby|nickelodeon/i.test(
          v.name
        )
      );
    }

    if (selectedCategory !== "Todos os títulos") {
      const selectedCatObj = vodCategories.find((c) => c.category_name === selectedCategory);
      if (selectedCatObj && catalog.vodByCategory?.[selectedCatObj.category_id]) {
        list = catalog.vodByCategory[selectedCatObj.category_id].filter((v) => !!v.stream_icon);
      } else {
        const keyword = selectedCategory.toLowerCase();
        const byName = list.filter((v) => v.name.toLowerCase().includes(keyword));
        if (byName.length > 0) list = byName;
      }
    }
    return list;
  }, [catalog.vod, catalog.vodByCategory, vodCategories, currentProfile, selectedCategory]);

  const heroCarrosselItems = useMemo(() => {
    if (filteredVod.length > 0) return filteredVod.slice(0, 5);
    if (catalog.vod?.length > 0) return catalog.vod.slice(0, 5);
    return [];
  }, [filteredVod, catalog.vod]);

  const rowPopular = useMemo(() => filteredVod.slice(5, 20), [filteredVod]);
  const rowAction = useMemo(() => filteredVod.slice(20, 35), [filteredVod]);
  const rowSuspense = useMemo(() => filteredVod.slice(35, 50), [filteredVod]);
  const rowComedy = useMemo(() => filteredVod.slice(50, 65), [filteredVod]);

  const mosaicPosters = useMemo(() => {
    return (catalog.vod || []).filter((v) => !!v.stream_icon).slice(0, 16);
  }, [catalog.vod]);

  const go = async (path: string) => {
    if (session && source?.kind !== "list") await setSource({ kind: "xtream" });
    router.push(path as any);
  };

  const handleOpenChannel = (channel: LiveStream) => {
    if (session && source?.kind !== "list") setSource({ kind: "xtream" });
    router.push({
      pathname: "/(tabs)/live",
      params: { cat: jogosCatId || undefined, channelId: String(channel.stream_id) },
    });
  };

  const handleResumeItem = (entry: any) => {
    if (entry.item && setQueue) {
      setQueue([entry.item]);
      setQueueIndex(0);
      router.push("/player" as any);
    } else if (entry.item?.id) {
      router.push({ pathname: "/movie/[id]", params: { id: String(entry.item.id) } });
    }
  };

  const handleResumePlayback = () => {
    if (!resumeItem) return;
    handleResumeItem(resumeItem);
  };

  return (
    <View style={[styles.root, { backgroundColor: otrEnabled ? "#000000" : colors.bg }]}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {hasContent ? (
          otrEnabled ? (
            /* ==============================================================
               1. MODO OTR COMPLETO
               ============================================================== */
            <View style={styles.nfContainer}>
              <View style={styles.nfHeader}>
                <View style={styles.rowAlign}>
                  <View style={styles.nfLogoBox}>
                    <Text style={styles.nfLogoLetter}>G</Text>
                  </View>
                  <Text style={styles.nfHeaderTitle}>
                    {selectedCategory === "Todos os títulos" ? "Início" : selectedCategory}
                  </Text>
                </View>

                <View style={styles.rowAlign}>
                  <Pressable focusable={true} onPress={toggleOtrQuick} style={styles.badgeSwitch}>
                    <Ionicons name="swap-horizontal" size={12} color="#000" />
                    <Text style={styles.badgeSwitchText}>MODO CLÁSSICO</Text>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => setShowGuiaModal(true)}
                    style={styles.nfHeaderIconBtn}
                  >
                    <Ionicons name="football-outline" size={22} color="#FFF" />
                    <View style={styles.nfNotifBadge}>
                      <Text style={styles.nfNotifBadgeText}>{guiaJogos.length}</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => setShowProfileSheet(true)}
                    style={[styles.nfProfileAvatarSmall, { backgroundColor: currentProfile.color }]}
                  >
                    <Text style={{ fontSize: 16 }}>{currentProfile.emoji}</Text>
                  </Pressable>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.nfPillsScroll}
              >
                {selectedCategory !== "Todos os títulos" && (
                  <Pressable
                    focusable={true}
                    onPress={() => setSelectedCategory("Todos os títulos")}
                    style={[styles.nfPill, styles.nfPillActive]}
                  >
                    <Ionicons name="close" size={14} color="#000" />
                    <Text style={[styles.nfPillText, { color: "#000", fontWeight: "800" }]}>
                      {selectedCategory}
                    </Text>
                  </Pressable>
                )}

                <Pressable focusable={true} onPress={() => go("/(tabs)/series")} style={styles.nfPill}>
                  <Text style={styles.nfPillText}>Séries</Text>
                </Pressable>

                <Pressable focusable={true} onPress={() => go("/(tabs)/movies")} style={styles.nfPill}>
                  <Text style={styles.nfPillText}>Filmes</Text>
                </Pressable>

                <Pressable focusable={true} onPress={() => go("/(tabs)/live")} style={styles.nfPill}>
                  <Text style={styles.nfPillText}>TV ao Vivo</Text>
                </Pressable>

                <Pressable focusable={true} onPress={() => setShowGuiaModal(true)} style={styles.nfPill}>
                  <Text style={styles.nfPillText}>Jogos de Hoje</Text>
                </Pressable>

                <Pressable
                  focusable={true}
                  onPress={() => setShowCategoriesModal(true)}
                  style={styles.nfPill}
                >
                  <Text style={styles.nfPillText}>Categorias</Text>
                  <Ionicons name="chevron-down" size={14} color="#D1D5DB" />
                </Pressable>
              </ScrollView>

              {/* CARROSSEL SUPERIOR MÚLTIPLO */}
              {heroCarrosselItems.length > 0 && (
                <View style={styles.nfHeroOuter}>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 0 }}
                  >
                    {heroCarrosselItems.map((item) => (
                      <Pressable
                        key={item.stream_id}
                        focusable={true}
                        style={[styles.nfHeroCard, { width: SCREEN_WIDTH - 32 }]}
                        onPress={() =>
                          router.push({ pathname: "/movie/[id]", params: { id: String(item.stream_id) } })
                        }
                      >
                        {item.stream_icon ? (
                          <Image
                            source={{ uri: item.stream_icon }}
                            style={styles.nfHeroImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.nfHeroImage, { backgroundColor: "#181B24" }]} />
                        )}

                        <View style={styles.nfHeroCornerLogo}>
                          <Text style={styles.nfHeroCornerLogoText}>G</Text>
                        </View>

                        <View style={styles.nfHeroBottomOverlay}>
                          <Text style={styles.nfHeroTitle} numberOfLines={2}>
                            {item.name}
                          </Text>

                          <Text style={styles.nfHeroTags}>
                            {currentProfile.isKids
                              ? "Infantil • Família • Dublado • Alta Definição"
                              : "Destaque • Empolgante • Lançamento • Full HD"}
                          </Text>

                          <View style={styles.nfHeroBtnsRow}>
                            <Pressable
                              focusable={true}
                              style={styles.nfBtnWhite}
                              onPress={() =>
                                router.push({
                                  pathname: "/movie/[id]",
                                  params: { id: String(item.stream_id) },
                                })
                              }
                            >
                              <Ionicons name="play" size={20} color="#000" />
                              <Text style={styles.nfBtnWhiteText}>Assistir</Text>
                            </Pressable>

                            <Pressable
                              focusable={true}
                              style={styles.nfBtnDark}
                              onPress={() => handleToggleMyList(String(item.stream_id))}
                            >
                              <Ionicons
                                name={myListIds.includes(String(item.stream_id)) ? "checkmark" : "add"}
                                size={22}
                                color="#FFF"
                              />
                              <Text style={styles.nfBtnDarkText}>Minha lista</Text>
                            </Pressable>
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {continueWatchingList.length > 0 && (
                <View style={styles.nfSection}>
                  <Text style={styles.nfSectionTitle}>
                    Continuar assistindo como {currentProfile.name}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.nfRowScroll}
                  >
                    {continueWatchingList.map((entry: any, idx: number) => (
                      <Pressable
                        key={idx}
                        focusable={true}
                        onPress={() => handleResumeItem(entry)}
                        style={styles.nfContinueCard}
                      >
                        <View style={styles.nfContinuePosterWrap}>
                          {entry.logo ? (
                            <Image
                              source={{ uri: entry.logo }}
                              style={styles.fullSize}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[styles.fullSize, styles.center, { backgroundColor: "#1E222D" }]}>
                              <Ionicons name="film-outline" size={30} color={colors.gold} />
                            </View>
                          )}
                          <View style={styles.nfPlayCircleOverlay}>
                            <Ionicons name="play" size={22} color="#FFF" style={{ marginLeft: 2 }} />
                          </View>
                        </View>
                        <View style={styles.nfContinueProgressBg}>
                          <View style={[styles.nfContinueProgressFill, { width: `${entry.pct}%` }]} />
                        </View>
                        <View style={styles.nfContinueFooter}>
                          <Text style={styles.nfContinueEpisodeText} numberOfLines={1}>
                            {entry.title}
                          </Text>
                          <Ionicons name="information-circle-outline" size={18} color="#9CA3AF" />
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {rowPopular.length > 0 && (
                <View style={styles.nfSection}>
                  <Text style={styles.nfSectionTitle}>O público ama</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.nfRowScroll}
                  >
                    {rowPopular.map((item, idx) => (
                      <NetflixPosterCard
                        key={item.stream_id}
                        title={item.name}
                        poster={item.stream_icon}
                        isTop10={idx < 5}
                        isNew={idx % 2 === 0}
                        onPress={() =>
                          router.push({ pathname: "/movie/[id]", params: { id: String(item.stream_id) } })
                        }
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.nfSection}>
                <View style={[styles.rowBetween, { paddingRight: 16 }]}>
                  <Text style={styles.nfSectionTitle}>⚽ Jogos de Hoje na TV</Text>
                  <Pressable onPress={() => setShowGuiaModal(true)}>
                    <Text style={{ color: colors.gold, fontSize: 12, fontWeight: "800" }}>
                      Ver grade completa →
                    </Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.nfRowScroll}
                >
                  {guiaJogos.map((g) => (
                    <Pressable
                      key={g.id}
                      focusable={true}
                      style={styles.nfMatchCard}
                      onPress={() => {
                        if (jogosChannels.length > 0) {
                          handleOpenChannel(jogosChannels[0]);
                        } else {
                          go("/(tabs)/live");
                        }
                      }}
                    >
                      <View style={styles.rowBetween}>
                        <View style={styles.nfMatchTimePill}>
                          <Ionicons name="time" size={11} color="#FFF" />
                          <Text style={styles.nfMatchTimeText}>{g.time}</Text>
                        </View>
                        <Text style={styles.nfMatchLeague} numberOfLines={1}>
                          {g.league}
                        </Text>
                      </View>
                      <Text style={styles.nfMatchTeams} numberOfLines={2}>
                        {g.match}
                      </Text>
                      <View style={styles.rowAlign}>
                        <Ionicons name="tv-outline" size={13} color={colors.gold} />
                        <Text style={styles.nfMatchChannels} numberOfLines={1}>
                          {g.channels}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {rowAction.length > 0 && (
                <View style={styles.nfSection}>
                  <Text style={styles.nfSectionTitle}>Filmes de ação e aventura</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.nfRowScroll}
                  >
                    {rowAction.map((item, idx) => (
                      <NetflixPosterCard
                        key={item.stream_id}
                        title={item.name}
                        poster={item.stream_icon}
                        isTop10={idx === 0 || idx === 3}
                        isNew={idx % 3 === 0}
                        onPress={() =>
                          router.push({ pathname: "/movie/[id]", params: { id: String(item.stream_id) } })
                        }
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {rowSuspense.length > 0 && (
                <View style={styles.nfSection}>
                  <Text style={styles.nfSectionTitle}>Filmes repletos de suspense</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.nfRowScroll}
                  >
                    {rowSuspense.map((item, idx) => (
                      <NetflixPosterCard
                        key={item.stream_id}
                        title={item.name}
                        poster={item.stream_icon}
                        isTop10={idx < 2}
                        isNew={idx === 0 || idx === 4}
                        onPress={() =>
                          router.push({ pathname: "/movie/[id]", params: { id: String(item.stream_id) } })
                        }
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {rowComedy.length > 0 && (
                <View style={styles.nfSection}>
                  <Text style={styles.nfSectionTitle}>Filmes para toda a família</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.nfRowScroll}
                  >
                    {rowComedy.map((item, idx) => (
                      <NetflixPosterCard
                        key={item.stream_id}
                        title={item.name}
                        poster={item.stream_icon}
                        isTop10={idx < 4}
                        isNew={idx % 2 === 0}
                        onPress={() =>
                          router.push({ pathname: "/movie/[id]", params: { id: String(item.stream_id) } })
                        }
                      />
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          ) : (
            /* ==============================================================
               2. MODO CLÁSSICO
               ============================================================== */
            <View style={styles.mainContainer}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionHeader}>O QUE PRETENDE ASSISTIR?</Text>
                <View style={styles.rowAlign}>
                  <Pressable focusable={true} onPress={toggleOtrQuick} style={styles.badgeSwitch}>
                    <Ionicons name="layers" size={12} color="#000" />
                    <Text style={styles.badgeSwitchText}>ATIVAR MODO OTR</Text>
                  </Pressable>
                  <Pressable
                    focusable={true}
                    onPress={() => setShowProfileSheet(true)}
                    style={[styles.nfProfileAvatarSmall, { backgroundColor: currentProfile.color }]}
                  >
                    <Text style={{ fontSize: 15 }}>{currentProfile.emoji}</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.gridNav}>
                {MAIN.map((m, idx) => (
                  <NavCardItem key={m.key} item={m} onPress={() => go(m.path)} isFirst={idx === 0} />
                ))}
              </View>

              <View style={styles.quickRow}>
                <SmallTile
                  icon="star-outline"
                  label="Favoritos"
                  onPress={() => router.push({ pathname: "/(tabs)/live", params: { cat: "__fav" } })}
                />
                <SmallTile
                  icon="person-outline"
                  label="Conta"
                  onPress={() => {
                    if (session) {
                      setShowAccountModal(true);
                    } else {
                      router.push("/login");
                    }
                  }}
                />
                <SmallTile
                  icon="settings-outline"
                  label="Ajustes"
                  onPress={() => router.push("/(tabs)/settings")}
                />
              </View>

              {jogosChannels.length > 0 && (
                <View style={{ gap: 8 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.sectionTitle}>⚽ CANAIS DE JOGOS AO VIVO</Text>
                    <View style={styles.badgeLive}>
                      <View style={styles.liveDot} />
                      <Text style={styles.badgeLiveText}>NO AR</Text>
                    </View>
                  </View>
                  <JogosMarqueeReverse channels={jogosChannels} onPressChannel={handleOpenChannel} />
                </View>
              )}

              {marqueeItems.length > 0 && (
                <TrendingMarquee
                  items={marqueeItems}
                  onPressItem={(item) => router.push({ pathname: "/movie/[id]", params: { id: item.id } })}
                />
              )}

              {session && (
                <View style={styles.planCard}>
                  <View style={styles.planInfoGrid}>
                    <View style={styles.planCol}>
                      <Text style={styles.planLabel}>UTILIZADOR</Text>
                      <View style={styles.rowAlign}>
                        <Ionicons name="person-circle-outline" size={15} color={colors.gold} />
                        <Text style={styles.planVal} numberOfLines={1}>{username}</Text>
                      </View>
                    </View>

                    <View style={styles.planCol}>
                      <Text style={styles.planLabel}>CÓDIGO DE ATIVAÇÃO</Text>
                      <View style={styles.rowAlign}>
                        <Ionicons name="key-outline" size={14} color={colors.gold} />
                        <Text style={styles.planVal} numberOfLines={1}>{activationCode}</Text>
                      </View>
                    </View>

                    <View style={[styles.planCol, { alignItems: "flex-end" }]}>
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
                        <Text style={styles.expiredTitle}>ACESSO EXPIRADO!</Text>
                        <Text style={styles.expiredSub}>Renove a subscrição com o seu fornecedor de multimédia.</Text>
                      </View>
                    </Animated.View>
                  )}
                </View>
              )}

              <View style={styles.guiaSection}>
                <View style={styles.rowBetween}>
                  <View style={{ gap: 2 }}>
                    <Text style={styles.sectionTitle}>📺 GUIA DE JOGOS NA TV</Text>
                    <Text style={styles.guiaSubtitle}>Programação oficial com horários e canais de transmissão</Text>
                  </View>
                  {loadingGuia && <ActivityIndicator size="small" color={colors.gold} />}
                </View>

                <View style={styles.guiaList}>
                  {guiaJogos.map((g) => (
                    <View key={g.id} style={styles.guiaCard}>
                      <View style={styles.guiaHeaderRow}>
                        <View style={styles.guiaTimeBadge}>
                          <Ionicons name="time" size={11} color="#000" />
                          <Text style={styles.guiaTimeText}>{g.time}</Text>
                        </View>
                        <Text style={styles.guiaLeagueText} numberOfLines={1}>{g.league}</Text>
                      </View>

                      <Text style={styles.guiaMatchTitle} numberOfLines={2}>{g.match}</Text>

                      <View style={styles.guiaChannelsRow}>
                        <Ionicons name="tv-outline" size={13} color={colors.gold} />
                        <Text style={styles.guiaChannelsText} numberOfLines={1}>{g.channels}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )
        ) : (
          <View style={styles.loggedOutBox}>
            <Text style={styles.brand}>GoldCast Media Player</Text>
            <Text style={styles.hint}>Inicie sessão para carregar a programação.</Text>
          </View>
        )}
      </ScrollView>

      {/* BALÃO FLUTUANTE DE RETOMAR REPRODUÇÃO (MODO CLÁSSICO) */}
      {!otrEnabled && resumeItem && !bubbleDismissed && (
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
                <Text style={styles.bubbleCardTag}>CONTINUAR A ASSISTIR</Text>
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

      {/* ====================================================================
          MODAL 1: TELA "ESCOLHA O SEU PERFIL"
         ==================================================================== */}
      <Modal visible={showProfileGate} animationType="fade" transparent={false}>
        <View style={styles.gateRoot}>
          <View style={styles.mosaicGrid}>
            {mosaicPosters.map((item, idx) => (
              <Image
                key={idx}
                source={{ uri: item.stream_icon }}
                style={styles.mosaicCell}
                resizeMode="cover"
              />
            ))}
            <View style={styles.mosaicDarkOverlay} />
          </View>

          <View style={styles.gateCenterBrand}>
            <Text style={styles.gateLogoTitle}>GOLDCAST</Text>
            <View style={styles.rowAlign}>
              <View style={styles.top10MiniBox}>
                <Text style={styles.top10MiniText}>TOP{"\n"}10</Text>
              </View>
              <Text style={styles.gateTop10Sub}>Top 10 em séries e filmes hoje</Text>
            </View>
          </View>

          <View style={[styles.gateBottomSheet, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.gateChooseTitle}>
              {profiles.length === 0
                ? "Bem-vindo! Crie o seu perfil para começar"
                : "Escolha o seu perfil"}
            </Text>

            <View style={styles.gateProfilesGrid}>
              {profiles.map((p) => (
                <Pressable
                  key={p.id}
                  focusable={true}
                  onPress={() => {
                    if (editMode) {
                      handleDeleteProfile(p.id);
                    } else {
                      handleSelectProfile(p);
                    }
                  }}
                  style={styles.gateProfileItem}
                >
                  <View style={[styles.gateAvatarBox, { backgroundColor: p.color }]}>
                    <Text style={{ fontSize: 34 }}>{p.emoji}</Text>
                    {p.isKids && (
                      <View style={styles.kidsTagBadge}>
                        <Text style={styles.kidsTagText}>Infantil</Text>
                      </View>
                    )}
                    {editMode && (
                      <View style={styles.deleteOverlay}>
                        <Ionicons name="trash" size={24} color="#FFF" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.gateProfileName} numberOfLines={1}>
                    {p.name}
                  </Text>
                </Pressable>
              ))}

              {profiles.length < 6 && (
                <Pressable
                  focusable={true}
                  onPress={() => setShowCreateModal(true)}
                  style={styles.gateProfileItem}
                >
                  <View style={styles.gateActionBox}>
                    <Ionicons name="add" size={34} color="#FFF" />
                  </View>
                  <Text style={styles.gateProfileName}>Adicionar</Text>
                </Pressable>
              )}

              {profiles.length > 0 && (
                <Pressable
                  focusable={true}
                  onPress={() => setEditMode(!editMode)}
                  style={styles.gateProfileItem}
                >
                  <View
                    style={[
                      styles.gateActionBox,
                      editMode && { borderColor: colors.gold, borderWidth: 2 },
                    ]}
                  >
                    <Ionicons name="pencil" size={26} color="#FFF" />
                  </View>
                  <Text style={styles.gateProfileName}>{editMode ? "Concluir" : "Editar"}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ====================================================================
          MODAL 2: MENU GAVETA "PERFIL" E CONTA
         ==================================================================== */}
      <Modal visible={showProfileSheet} animationType="slide" transparent={true}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeaderRow}>
              <View style={{ width: 32 }} />
              <Text style={styles.sheetTitle}>Perfil</Text>
              <Pressable onPress={() => setShowProfileSheet(false)} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={20} color="#FFF" />
              </Pressable>
            </View>

            <View style={styles.activeProfileHighlightCard}>
              <View
                style={[styles.activeProfileBigAvatar, { backgroundColor: currentProfile.color }]}
              >
                <Text style={{ fontSize: 40 }}>{currentProfile.emoji}</Text>
              </View>
              <Text style={styles.activeProfileBigName}>{currentProfile.name}</Text>
              <View style={styles.rowAlign}>
                <Ionicons name="person-circle-outline" size={14} color="#9CA3AF" />
                <Text style={styles.activeProfileSubHandle}>{username}</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sheetProfilesRow}
            >
              {profiles
                .filter((p) => p.id !== currentProfile.id)
                .map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => handleSelectProfile(p)}
                    style={styles.sheetProfileMiniItem}
                  >
                    <View style={[styles.sheetMiniAvatar, { backgroundColor: p.color }]}>
                      <Text style={{ fontSize: 26 }}>{p.emoji}</Text>
                      {p.isKids && (
                        <View style={styles.kidsTagBadge}>
                          <Text style={styles.kidsTagText}>Infantil</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.sheetMiniName} numberOfLines={1}>
                      {p.name}
                    </Text>
                  </Pressable>
                ))}

              {profiles.length < 6 && (
                <Pressable
                  onPress={() => {
                    setShowProfileSheet(false);
                    setShowCreateModal(true);
                  }}
                  style={styles.sheetProfileMiniItem}
                >
                  <View style={styles.sheetMiniAddBox}>
                    <Ionicons name="add" size={28} color="#FFF" />
                  </View>
                  <Text style={styles.sheetMiniName}>Adicionar</Text>
                </Pressable>
              )}
            </ScrollView>

            <Pressable
              onPress={() => {
                setShowProfileSheet(false);
                setShowProfileGate(true);
              }}
              style={styles.manageProfilesPill}
            >
              <Text style={styles.manageProfilesPillText}>Gerenciar perfis</Text>
            </Pressable>

            <View style={styles.sheetMenuList}>
              <Pressable
                onPress={() => {
                  setShowProfileSheet(false);
                  toggleOtrQuick();
                }}
                style={styles.sheetMenuItem}
              >
                <View style={styles.rowAlign}>
                  <Ionicons name="layers-outline" size={22} color={colors.gold} />
                  <Text style={[styles.sheetMenuText, { color: colors.gold }]}>
                    {otrEnabled ? "Mudar para Modo Clássico" : "Ativar Modo OTR"}
                  </Text>
                </View>
                <Ionicons name="swap-horizontal" size={18} color={colors.gold} />
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowProfileSheet(false);
                  router.push("/(tabs)/settings");
                }}
                style={styles.sheetMenuItem}
              >
                <View style={styles.rowAlign}>
                  <Ionicons name="settings-outline" size={22} color="#FFF" />
                  <Text style={styles.sheetMenuText}>Configurações do aplicativo</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowProfileSheet(false);
                  setShowAccountModal(true);
                }}
                style={styles.sheetMenuItem}
              >
                <View style={styles.rowAlign}>
                  <Ionicons name="person-outline" size={22} color="#FFF" />
                  <Text style={styles.sheetMenuText}>Conta & Código de Ativação</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowProfileSheet(false);
                  setShowGuiaModal(true);
                }}
                style={styles.sheetMenuItem}
              >
                <View style={styles.rowAlign}>
                  <Ionicons name="football-outline" size={22} color="#FFF" />
                  <Text style={styles.sheetMenuText}>Guia de Jogos na TV</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </Pressable>

              <Pressable
                onPress={async () => {
                  setShowProfileSheet(false);
                  logout?.();
                  router.replace("/login");
                }}
                style={styles.sheetMenuItem}
              >
                <View style={styles.rowAlign}>
                  <Ionicons name="log-out-outline" size={22} color="#EF4444" />
                  <Text style={[styles.sheetMenuText, { color: "#EF4444" }]}>Sair</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ====================================================================
          MODAL 3: CRIAR NOVO PERFIL PELO CLIENTE
         ==================================================================== */}
      <Modal visible={showCreateModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.createProfileModalCard}>
            <Text style={styles.createModalTitle}>Criar Novo Perfil</Text>
            <Text style={styles.createModalSub}>Escolha um ícone e digite o nome do perfil</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 10 }}
            >
              {AVATAR_PRESETS.map((preset, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => setSelectedPreset(idx)}
                  style={[
                    styles.presetAvatarOption,
                    { backgroundColor: preset.color },
                    selectedPreset === idx && styles.presetAvatarSelected,
                  ]}
                >
                  <Text style={{ fontSize: 26 }}>{preset.emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <TextInput
              placeholder="Digite o nome do perfil..."
              placeholderTextColor="#777"
              value={newProfileName}
              onChangeText={setNewProfileName}
              style={styles.createInput}
            />

            <Pressable
              onPress={() => setNewProfileKids(!newProfileKids)}
              style={styles.kidsToggleRow}
            >
              <Text style={styles.kidsToggleLabel}>Perfil Infantil (Kids)?</Text>
              <Ionicons
                name={newProfileKids ? "checkbox" : "square-outline"}
                size={24}
                color={colors.gold}
              />
            </Pressable>

            <View style={{ flexDirection: "row", gap: 10, width: "100%", marginTop: 10 }}>
              {profiles.length > 0 && (
                <Pressable
                  onPress={() => setShowCreateModal(false)}
                  style={[styles.btnModalClose, { flex: 1, backgroundColor: "#262936" }]}
                >
                  <Text style={[styles.btnModalCloseText, { color: "#FFF" }]}>CANCELAR</Text>
                </Pressable>
              )}
              <Pressable onPress={handleCreateProfile} style={[styles.btnModalClose, { flex: 1 }]}>
                <Text style={styles.btnModalCloseText}>SALVAR PERFIL</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ====================================================================
          MODAL 4: MENU VERTICAL DE CATEGORIAS REAIS DA LISTA XTREAM
         ==================================================================== */}
      <Modal visible={showCategoriesModal} animationType="fade" transparent={true}>
        <View style={styles.categoriesDrawerOverlay}>
          <View style={[styles.categoriesDrawerBox, { paddingTop: insets.top + 16 }]}>
            <View style={[styles.rowBetween, { paddingHorizontal: 20, marginBottom: 12 }]}>
              <Text style={styles.categoriesDrawerHeader}>Categorias da Lista</Text>
              <Pressable onPress={() => setShowCategoriesModal(false)}>
                <Ionicons name="close-circle" size={28} color="#FFF" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <Pressable
                onPress={() => {
                  setSelectedCategory("Todos os títulos");
                  setShowCategoriesModal(false);
                }}
                style={styles.categoryDrawerRow}
              >
                <Text
                  style={[
                    styles.categoryDrawerText,
                    selectedCategory === "Todos os títulos" && { color: colors.gold, fontWeight: "900" },
                  ]}
                >
                  Todos os títulos
                </Text>
              </Pressable>

              {vodCategories.map((cat) => (
                <Pressable
                  key={cat.category_id}
                  onPress={() => {
                    setSelectedCategory(cat.category_name);
                    setShowCategoriesModal(false);
                  }}
                  style={styles.categoryDrawerRow}
                >
                  <Text
                    style={[
                      styles.categoryDrawerText,
                      selectedCategory === cat.category_name && { color: colors.gold, fontWeight: "900" },
                    ]}
                  >
                    {cat.category_name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <Pressable style={{ flex: 1 }} onPress={() => setShowCategoriesModal(false)} />
        </View>
      </Modal>

      {/* ====================================================================
          MODAL 5: GRADE COMPLETA DO GUIA DE JOGOS NA TV
         ==================================================================== */}
      <Modal visible={showGuiaModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.accountCardModal, { maxHeight: SCREEN_HEIGHT * 0.8 }]}>
            <View style={[styles.rowBetween, { width: "100%", marginBottom: 12 }]}>
              <Text style={styles.accountModalTitle}>📺 GUIA DE JOGOS NA TV</Text>
              <Pressable onPress={() => setShowGuiaModal(false)}>
                <Ionicons name="close-circle" size={26} color="#FFF" />
              </Pressable>
            </View>

            <ScrollView style={{ width: "100%" }} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
              {guiaJogos.map((g) => (
                <View key={g.id} style={styles.guiaModalItem}>
                  <View style={styles.rowBetween}>
                    <View style={styles.nfMatchTimePill}>
                      <Ionicons name="time" size={12} color="#FFF" />
                      <Text style={styles.nfMatchTimeText}>{g.time}</Text>
                    </View>
                    <Text style={styles.nfMatchLeague}>{g.league}</Text>
                  </View>
                  <Text style={styles.nfMatchTeams}>{g.match}</Text>
                  <View style={styles.rowAlign}>
                    <Ionicons name="tv-outline" size={14} color={colors.gold} />
                    <Text style={styles.nfMatchChannels}>{g.channels}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <Pressable onPress={() => setShowGuiaModal(false)} style={[styles.btnModalClose, { marginTop: 10 }]}>
              <Text style={styles.btnModalCloseText}>FECHAR GRADE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ====================================================================
          MODAL 6: DETALHES DA CONTA E CÓDIGO DE ATIVAÇÃO
         ==================================================================== */}
      <Modal visible={showAccountModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.accountCardModal}>
            <View style={styles.accountIconCircle}>
              <Ionicons name="person" size={32} color={colors.gold} />
            </View>
            <Text style={styles.accountModalTitle}>INFORMAÇÕES DA CONTA</Text>
            <Text style={styles.accountModalSubtitle}>Detalhes da licença e conexão do reprodutor</Text>

            <View style={styles.accountInfoList}>
              <View style={styles.accountInfoRow}>
                <Text style={styles.accountRowLabel}>Perfil Ativo:</Text>
                <Text style={styles.accountRowValue}>{currentProfile.name}</Text>
              </View>
              <View style={styles.accountInfoRow}>
                <Text style={styles.accountRowLabel}>Utilizador:</Text>
                <Text style={styles.accountRowValue}>{username}</Text>
              </View>
              <View style={styles.accountInfoRow}>
                <Text style={styles.accountRowLabel}>Chave do App:</Text>
                <Text style={[styles.accountRowValue, { color: colors.gold, fontWeight: "900" }]}>
                  {activationCode}
                </Text>
              </View>
              <View style={styles.accountInfoRow}>
                <Text style={styles.accountRowLabel}>Vencimento:</Text>
                <Text style={styles.accountRowValue}>{expFormatted}</Text>
              </View>
              <View style={styles.accountInfoRow}>
                <Text style={styles.accountRowLabel}>Status:</Text>
                <Text style={{ color: statusConfig.color, fontWeight: "900", fontSize: 12 }}>
                  {statusConfig.text}
                </Text>
              </View>
              {session?.serverUrl && (
                <View style={styles.accountInfoRow}>
                  <Text style={styles.accountRowLabel}>Servidor:</Text>
                  <Text style={styles.accountRowValue} numberOfLines={1}>
                    {session.serverUrl.replace(/https?:\/\//, "")}
                  </Text>
                </View>
              )}
            </View>

            <Pressable onPress={() => setShowAccountModal(false)} style={styles.btnModalClose}>
              <Text style={styles.btnModalCloseText}>FECHAR</Text>
            </Pressable>

            <Pressable
              onPress={async () => {
                setShowAccountModal(false);
                logout?.();
                router.replace("/login");
              }}
              style={styles.btnModalLogout}
            >
              <Text style={styles.btnModalLogoutText}>Trocar de Conta / Sair</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ============================================================================
   COMPONENTES AUXILIARES
   ============================================================================ */
function NetflixPosterCard({
  title,
  poster,
  isTop10,
  isNew,
  badgeText = "Novidade",
  onPress,
}: {
  title: string;
  poster?: string;
  isTop10?: boolean;
  isNew?: boolean;
  badgeText?: string;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[styles.nfPosterCard, focused && styles.nfPosterCardFocused]}
    >
      {poster ? (
        <Image source={{ uri: poster }} style={styles.fullSize} resizeMode="cover" />
      ) : (
        <View style={[styles.fullSize, styles.center, { backgroundColor: "#181B24", padding: 8 }]}>
          <Text style={{ color: "#FFF", fontSize: 11, textAlign: "center" }} numberOfLines={3}>
            {title}
          </Text>
        </View>
      )}

      {isTop10 && (
        <View style={styles.nfTop10Badge}>
          <Text style={styles.nfTop10TextTop}>TOP</Text>
          <Text style={styles.nfTop10TextNum}>10</Text>
        </View>
      )}

      {isNew && (
        <View style={styles.nfNewRibbonWrap}>
          <View style={styles.nfNewRibbon}>
            <Text style={styles.nfNewRibbonText}>{badgeText}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function NavCardItem({ item, onPress, isFirst }: { item: (typeof MAIN)[number]; onPress: () => void; isFirst?: boolean }) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <Pressable
      focusable={true}
      hasTVPreferredFocus={isFirst}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[styles.navCard, isFocused && styles.navCardFocused]}
    >
      <View style={[styles.navCardIconBox, isFocused && styles.navCardIconBoxFocused]}>
        <Ionicons name={item.icon as any} size={28} color={isFocused ? "#000000" : colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.navCardTitle, isFocused && styles.navCardTitleFocused]}>{item.label}</Text>
        <Text style={[styles.navCardSub, isFocused && styles.navCardSubFocused]}>{item.sub}</Text>
      </View>
      {isFocused && (
        <View style={styles.focusBadgeSmall}>
          <Text style={styles.focusBadgeSmallText}>▶ ENTRAR</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={isFocused ? "#000000" : colors.textDim} />
    </Pressable>
  );
}

function SmallTile({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[styles.tile, isFocused && styles.tileFocused]}
    >
      <Ionicons name={icon} size={20} color={isFocused ? "#000000" : colors.gold} />
      <Text style={[styles.tileLabel, isFocused && styles.tileLabelFocused]}>{label}</Text>
    </Pressable>
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
          <JogosCardItem key={`${ch.stream_id}-${idx}`} ch={ch} onPress={() => onPressChannel(ch)} />
        ))}
      </Animated.View>
    </View>
  );
}

function JogosCardItem({ ch, onPress }: { ch: LiveStream; onPress: () => void }) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[styles.channelCard, isFocused && styles.channelCardFocused]}
    >
      <View style={styles.posterBox}>
        {ch.stream_icon ? (
          <Image source={{ uri: ch.stream_icon }} style={styles.fullSize} resizeMode="cover" />
        ) : (
          <View style={styles.center}><Text style={{ fontSize: 32 }}>⚽</Text></View>
        )}
        <View style={styles.tagFhd}><Text style={styles.tagFhdText}>AO VIVO</Text></View>
        {isFocused && (
          <View style={styles.jogosFocusBadge}>
            <Text style={styles.jogosFocusBadgeText}>▶ ASSISTIR</Text>
          </View>
        )}
      </View>
      <View style={[styles.jogosMeta, isFocused && { backgroundColor: "#FFD700" }]}>
        <Text style={[styles.channelName, isFocused && { color: "#000000", fontWeight: "900" }]} numberOfLines={2}>
          {ch.name}
        </Text>
        <Text style={[styles.channelSub, isFocused && { color: "#333333" }]}>TRANSMISSÃO</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mainContainer: { gap: spacing.lg, paddingHorizontal: spacing.lg },
  nfContainer: { gap: 18 },
  sectionHeader: { color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  sectionTitle: { color: colors.gold, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowAlign: { flexDirection: "row", alignItems: "center", gap: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  fullSize: { width: "100%", height: "100%" },

  badgeLive: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(229, 169, 59, 0.15)", paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" },
  badgeLiveText: { color: colors.gold, fontSize: 9.5, fontWeight: "800" },
  badgeSwitch: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.gold, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeSwitchText: { color: "#000", fontSize: 9.5, fontWeight: "900" },
  gridNav: { gap: 12 },
  navCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, borderColor: colors.border, gap: 14 },
  navCardFocused: { backgroundColor: "#E5A93B", borderColor: "#FFFFFF", borderWidth: 3.5, transform: [{ scale: 1.04 }], elevation: 14, zIndex: 99 },
  navCardIconBox: { width: 48, height: 48, borderRadius: 10, backgroundColor: "rgba(229, 169, 59, 0.12)", alignItems: "center", justifyContent: "center" },
  navCardIconBoxFocused: { backgroundColor: "#FFFFFF" },
  navCardTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  navCardTitleFocused: { color: "#000000", fontWeight: "900" },
  navCardSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
  navCardSubFocused: { color: "#1F232B", fontWeight: "600" },
  focusBadgeSmall: { backgroundColor: "#000000", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 4 },
  focusBadgeSmallText: { color: "#FFD700", fontSize: 9.5, fontWeight: "900" },
  quickRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  tile: { flex: 1, flexDirection: "row", height: 46, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 6 },
  tileFocused: { backgroundColor: "#FFD700", borderColor: "#FFFFFF", borderWidth: 2.5, transform: [{ scale: 1.08 }], elevation: 12, zIndex: 99 },
  tileLabel: { color: colors.text, fontSize: 11.5, fontWeight: "600" },
  tileLabelFocused: { color: "#000000", fontWeight: "900" },
  marqueeOuter: { overflow: "hidden", marginHorizontal: -spacing.lg, paddingVertical: 6 },
  marqueeTrack: { flexDirection: "row", paddingLeft: spacing.lg },
  channelCard: { width: 122, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(229, 169, 59, 0.22)", overflow: "hidden", marginRight: 12 },
  channelCardFocused: { borderWidth: 3.5, borderColor: "#FFD700", transform: [{ scale: 1.08 }], elevation: 16, zIndex: 999 },
  posterBox: { width: 122, height: 120, backgroundColor: "#161820", position: "relative" },
  tagFhd: { position: "absolute", top: 6, left: 6, backgroundColor: "rgba(239, 68, 68, 0.9)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  tagFhdText: { color: "#FFF", fontSize: 8, fontWeight: "900" },
  jogosFocusBadge: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#FFD700", paddingVertical: 3, alignItems: "center" },
  jogosFocusBadgeText: { color: "#000000", fontSize: 9, fontWeight: "900" },
  jogosMeta: { padding: 8, gap: 2, backgroundColor: colors.surface },
  channelName: { color: colors.text, fontSize: 10.5, fontWeight: "700", lineHeight: 14 },
  channelSub: { color: colors.gold, fontSize: 9, fontWeight: "800" },

  planCard: { backgroundColor: "#111319", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.08)", padding: 14, gap: 12, marginTop: 4 },
  planInfoGrid: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  planCol: { flex: 1, gap: 2 },
  planLabel: { color: colors.textDim, fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  planVal: { color: colors.text, fontSize: 12, fontWeight: "700" },
  daysBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5 },
  daysBadgeText: { fontSize: 13, fontWeight: "900", letterSpacing: 0.6 },
  expiredBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(239, 68, 68, 0.18)", borderWidth: 1, borderColor: "#EF4444", padding: 10, borderRadius: 10 },
  expiredTitle: { color: "#EF4444", fontSize: 11, fontWeight: "900" },
  expiredSub: { color: "#FCA5A5", fontSize: 10.5, lineHeight: 14 },

  guiaSection: { gap: 10, marginTop: 6 },
  guiaSubtitle: { color: colors.textMuted, fontSize: 11 },
  guiaList: { gap: 8 },
  guiaCard: { backgroundColor: "#12141C", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.07)", gap: 6 },
  guiaHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  guiaTimeBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  guiaTimeText: { color: "#000", fontSize: 10, fontWeight: "900" },
  guiaLeagueText: { color: colors.textDim, fontSize: 11, fontWeight: "700", flex: 1 },
  guiaMatchTitle: { color: colors.text, fontSize: 13, fontWeight: "800", letterSpacing: 0.2 },
  guiaChannelsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  guiaChannelsText: { color: colors.gold, fontSize: 11.5, fontWeight: "700" },

  nfHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  nfLogoBox: {
    width: 28,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  nfLogoLetter: {
    color: "#E50914",
    fontSize: 34,
    fontWeight: "900",
  },
  nfHeaderTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  nfHeaderIconBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  nfNotifBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#E50914",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  nfNotifBadgeText: { color: "#FFF", fontSize: 8.5, fontWeight: "900" },
  nfProfileAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  nfPillsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  nfPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  nfPillActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  nfPillText: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "600",
  },

  nfHeroOuter: {
    paddingHorizontal: 16,
  },
  nfHeroCard: {
    height: 460,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "#121318",
    position: "relative",
  },
  nfHeroImage: {
    width: "100%",
    height: "100%",
  },
  nfHeroCornerLogo: {
    position: "absolute",
    top: 12,
    left: 14,
  },
  nfHeroCornerLogoText: {
    color: "#E50914",
    fontSize: 28,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 6,
  },
  nfHeroBottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 55,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    alignItems: "center",
    gap: 8,
  },
  nfHeroTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  nfHeroTags: {
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  nfHeroBtnsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 4,
  },
  nfBtnWhite: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    height: 44,
    borderRadius: 6,
  },
  nfBtnWhiteText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "800",
  },
  nfBtnDark: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(55, 60, 70, 0.85)",
    height: 44,
    borderRadius: 6,
  },
  nfBtnDarkText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  nfSection: {
    gap: 8,
  },
  nfSectionTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    paddingHorizontal: 16,
  },
  nfRowScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  nfPosterCard: {
    width: 116,
    height: 170,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#14161D",
    position: "relative",
  },
  nfPosterCardFocused: {
    borderWidth: 3,
    borderColor: "#FFFFFF",
    transform: [{ scale: 1.05 }],
  },
  nfTop10Badge: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#E50914",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderBottomRightRadius: 6,
    alignItems: "center",
  },
  nfTop10TextTop: { color: "#FFF", fontSize: 7, fontWeight: "900" },
  nfTop10TextNum: { color: "#FFF", fontSize: 11, fontWeight: "900", marginTop: -2 },
  nfNewRibbonWrap: {
    position: "absolute",
    bottom: 6,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  nfNewRibbon: {
    backgroundColor: "#E50914",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 3,
  },
  nfNewRibbonText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "800",
  },

  nfContinueCard: {
    width: 116,
    backgroundColor: "#14161D",
    borderRadius: 8,
    overflow: "hidden",
  },
  nfContinuePosterWrap: {
    width: 116,
    height: 150,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  nfPlayCircleOverlay: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  nfContinueProgressBg: {
    height: 3.5,
    backgroundColor: "#374151",
    width: "100%",
  },
  nfContinueProgressFill: {
    height: "100%",
    backgroundColor: "#E50914",
  },
  nfContinueFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: "#181A20",
  },
  nfContinueEpisodeText: {
    color: "#D1D5DB",
    fontSize: 10,
    fontWeight: "600",
    flex: 1,
    marginRight: 4,
  },

  nfMatchCard: {
    width: 225,
    backgroundColor: "#14161E",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 6,
  },
  nfMatchTimePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E50914",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nfMatchTimeText: { color: "#FFF", fontSize: 10.5, fontWeight: "900" },
  nfMatchLeague: { color: "#9CA3AF", fontSize: 10.5, fontWeight: "700", flex: 1, textAlign: "right" },
  nfMatchTeams: { color: "#FFF", fontSize: 13, fontWeight: "800", marginVertical: 2 },
  nfMatchChannels: { color: colors.gold, fontSize: 11.5, fontWeight: "800", flex: 1 },

  gateRoot: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "flex-end",
  },
  mosaicGrid: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.65,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  mosaicCell: {
    width: SCREEN_WIDTH / 4,
    height: (SCREEN_HEIGHT * 0.65) / 4,
    opacity: 0.55,
  },
  mosaicDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  gateCenterBrand: {
    alignItems: "center",
    marginBottom: 24,
    gap: 6,
  },
  gateLogoTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 3,
  },
  top10MiniBox: {
    backgroundColor: "#E50914",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  top10MiniText: { color: "#FFF", fontSize: 7, fontWeight: "900", textAlign: "center" },
  gateTop10Sub: { color: "#D1D5DB", fontSize: 12, fontWeight: "700" },
  gateBottomSheet: {
    backgroundColor: "#141414",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 22,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  gateChooseTitle: {
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  gateProfilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 22,
  },
  gateProfileItem: {
    width: 82,
    alignItems: "center",
    gap: 6,
  },
  gateAvatarBox: {
    width: 74,
    height: 74,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  gateActionBox: {
    width: 74,
    height: 74,
    borderRadius: 14,
    backgroundColor: "#2B2B2B",
    alignItems: "center",
    justifyContent: "center",
  },
  gateProfileName: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
    textAlign: "center",
  },
  kidsTagBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  kidsTagText: {
    color: "#E50914",
    fontSize: 7.5,
    fontWeight: "900",
  },
  deleteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(229, 9, 20, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },

  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#181818",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 14,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4B5563",
    alignSelf: "center",
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2B2B2B",
    alignItems: "center",
    justifyContent: "center",
  },
  activeProfileHighlightCard: {
    backgroundColor: "#232323",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    gap: 6,
  },
  activeProfileBigAvatar: {
    width: 78,
    height: 78,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  activeProfileBigName: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  activeProfileSubHandle: { color: "#9CA3AF", fontSize: 12 },
  sheetProfilesRow: {
    gap: 14,
    paddingVertical: 4,
    alignSelf: "center",
  },
  sheetProfileMiniItem: {
    alignItems: "center",
    gap: 4,
    width: 68,
  },
  sheetMiniAvatar: {
    width: 58,
    height: 58,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  sheetMiniAddBox: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: "#2B2B2B",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetMiniName: { color: "#E5E7EB", fontSize: 11, fontWeight: "600" },
  manageProfilesPill: {
    alignSelf: "center",
    backgroundColor: "#2B2B2B",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  manageProfilesPillText: { color: "#FFF", fontSize: 12.5, fontWeight: "700" },
  sheetMenuList: { gap: 8, marginTop: 4 },
  sheetMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#232323",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  sheetMenuText: { color: "#FFF", fontSize: 14, fontWeight: "700" },

  categoriesDrawerOverlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  categoriesDrawerBox: {
    width: SCREEN_WIDTH * 0.72,
    backgroundColor: "rgba(22, 22, 22, 0.97)",
    height: "100%",
  },
  categoriesDrawerHeader: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  categoryDrawerRow: {
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  categoryDrawerText: {
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "500",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  createProfileModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#181818",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    gap: 12,
  },
  createModalTitle: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  createModalSub: { color: "#9CA3AF", fontSize: 12, textAlign: "center" },
  presetAvatarOption: {
    width: 54,
    height: 54,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.6,
  },
  presetAvatarSelected: {
    opacity: 1,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    transform: [{ scale: 1.08 }],
  },
  createInput: {
    width: "100%",
    height: 48,
    backgroundColor: "#262626",
    borderRadius: 10,
    paddingHorizontal: 14,
    color: "#FFF",
    fontSize: 14,
  },
  kidsToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 6,
  },
  kidsToggleLabel: { color: "#E5E7EB", fontSize: 13.5, fontWeight: "600" },

  accountCardModal: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#111319",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(229,169,59,0.3)",
    padding: 24,
    alignItems: "center",
  },
  accountIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(229,169,59,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.gold,
    marginBottom: 12,
  },
  accountModalTitle: { color: colors.gold, fontSize: 18, fontWeight: "800", letterSpacing: 0.5 },
  accountModalSubtitle: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 4, marginBottom: 16 },
  accountInfoList: {
    width: "100%",
    backgroundColor: "#161822",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 18,
  },
  accountInfoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accountRowLabel: { color: colors.textDim, fontSize: 12, fontWeight: "600" },
  accountRowValue: { color: "#FFF", fontSize: 12.5, fontWeight: "700" },
  btnModalClose: {
    backgroundColor: colors.gold,
    width: "100%",
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnModalCloseText: { color: "#000", fontSize: 13, fontWeight: "900" },
  btnModalLogout: { paddingVertical: 10, marginTop: 6 },
  btnModalLogoutText: { color: "#EF4444", fontSize: 12, fontWeight: "700" },
  guiaModalItem: {
    backgroundColor: "#1E202B",
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },

  loggedOutBox: { width: "100%", maxWidth: 420, gap: spacing.md, alignItems: "center", alignSelf: "center", marginTop: 40 },
  brand: { color: colors.gold, fontSize: 26, fontWeight: "800" },
  hint: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
});
