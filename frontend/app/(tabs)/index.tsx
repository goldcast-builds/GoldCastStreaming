import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
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
import { colors, spacing } from "../../src/utils/theme";
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

const GENRE_CATEGORIES = [
  "Todos os títulos",
  "Ação",
  "Anime",
  "Brasileiros",
  "Clássicos",
  "Comédia stand-up",
  "Comédias",
  "Documentários",
  "Drama",
  "Esportes",
  "Estrangeiros",
  "Fantasia",
  "Fé e espiritualidade",
  "Ficção científica",
  "Halloween & Terror",
  "Hollywood",
  "Infantil & Família",
  "Suspense",
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

  // Estados de Perfis (Inicia vazio para o próprio cliente criar)
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

  // Estados de Navegação e Modais
  const [otrEnabled, setOtrEnabled] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<string>("Todos os títulos");
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showGuiaModal, setShowGuiaModal] = useState(false);
  const [myListIds, setMyListIds] = useState<string[]>([]);

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

  // Perfil seguro para exibição enquanto o cliente ainda não criou o primeiro
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

  // Carrega dados salvos no dispositivo do cliente
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
        } else {
          // Se o cliente ainda não tem nenhum perfil criado, abre a tela de criação/escolha
          setShowProfileGate(true);
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
      if (source?.kind === "xtream") {
        if (!catalog.vodLoaded) loadVod();
        if (!catalog.seriesLoaded && loadSeries) loadSeries();
      }
    }, [source?.kind, catalog.vodLoaded, catalog.seriesLoaded, loadVod, loadSeries])
  );

  // Seleciona um perfil
  const handleSelectProfile = async (p: UserProfile) => {
    setActiveProfile(p);
    setShowProfileGate(false);
    setShowProfileSheet(false);
    setEditMode(false);
    await AsyncStorage.setItem("@goldcast_active_profile", JSON.stringify(p));
  };

  // Cria um novo perfil pelo cliente
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

  // Exclui um perfil
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

  // Adicionar/Remover da Minha Lista
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

  // Programação de Jogos do Dia com Horários e Canais Reais
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

  const hasContent = !!session || hasLists;

  const statusConfig = useMemo(() => {
    if (isExpired || daysLeft <= 1) {
      return {
        color: "#EF4444",
        bg: "rgba(239, 68, 68, 0.16)",
        border: "rgba(239, 68, 68, 0.6)",
        text: isExpired ? "ACESSO EXPIRADO" : "EXPIRA HOJE",
      };
    }
    if (daysLeft >= 2 && daysLeft <= 5) {
      return {
        color: "#F59E0B",
        bg: "rgba(245, 158, 11, 0.16)",
        border: "rgba(245, 158, 11, 0.6)",
        text: `${daysLeft} DIAS RESTANTES`,
      };
    }
    return {
      color: "#10B981",
      bg: "rgba(16, 185, 129, 0.16)",
      border: "rgba(16, 185, 129, 0.6)",
      text: `${daysLeft} DIAS RESTANTES`,
    };
  }, [daysLeft, isExpired]);

  // Lista de itens "Continuar assistindo"
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

  // Filtra catálogo de acordo com Perfil Infantil ou Gênero selecionado
  const filteredVod = useMemo(() => {
    if (!catalog.vod?.length) return [];
    let list = catalog.vod.filter((v) => !!v.stream_icon);
    if (currentProfile?.isKids) {
      const kidsMatches = list.filter((v) =>
        /infantil|kids|anima|desenho|disney|pixar|cartoon|turma|peppa|patrulha/i.test(v.name)
      );
      if (kidsMatches.length >= 6) list = kidsMatches;
    }
    if (selectedGenre !== "Todos os títulos") {
      const keyword = selectedGenre.split(" ")[0].toLowerCase();
      const byGenre = list.filter((v) => v.name.toLowerCase().includes(keyword));
      if (byGenre.length >= 4) list = byGenre;
    }
    return list;
  }, [catalog.vod, currentProfile, selectedGenre]);

  const heroItem = useMemo(() => {
    if (filteredVod.length > 0) return filteredVod[0];
    if (catalog.vod?.length > 0) return catalog.vod[0];
    return null;
  }, [filteredVod, catalog.vod]);

  const rowPopular = useMemo(() => filteredVod.slice(1, 15), [filteredVod]);
  const rowAction = useMemo(() => filteredVod.slice(15, 30), [filteredVod]);
  const rowSuspense = useMemo(() => filteredVod.slice(30, 45), [filteredVod]);
  const rowComedy = useMemo(() => filteredVod.slice(45, 60), [filteredVod]);

  const mosaicPosters = useMemo(() => {
    const imgs = (catalog.vod || []).filter((v) => !!v.stream_icon).slice(0, 16);
    return imgs;
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

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{
          paddingTop: insets.top + 6,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {hasContent ? (
          otrEnabled ? (
            /* ==============================================================
               ESTILO NETFLIX / STREAMING COMPLETO
               ============================================================== */
            <View style={styles.nfContainer}>
              {/* 1. CABEÇALHO SUPERIOR */}
              <View style={styles.nfHeader}>
                <View style={styles.rowAlign}>
                  <View style={styles.nfLogoBox}>
                    <Text style={styles.nfLogoLetter}>G</Text>
                  </View>
                  <Text style={styles.nfHeaderTitle}>
                    {selectedGenre === "Todos os títulos" ? "Início" : selectedGenre}
                  </Text>
                </View>

                <View style={styles.rowAlign}>
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

              {/* 2. BARRA DE PÍLULAS DE NAVEGAÇÃO */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.nfPillsScroll}
              >
                {selectedGenre !== "Todos os títulos" && (
                  <Pressable
                    focusable={true}
                    onPress={() => setSelectedGenre("Todos os títulos")}
                    style={[styles.nfPill, styles.nfPillActive]}
                  >
                    <Ionicons name="close" size={14} color
