import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Dimensions,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
  TextInput,
  Image as RNImage,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../../src/utils/theme";
import { useSession } from "../../src/store/session";
import { xtream, EpgEntry } from "../../src/services/xtream";

interface GuiaMatch {
  id: string;
  time: string;
  league: string;
  teamA: string;
  teamB: string;
  score?: string;
  status: "AO VIVO" | "EM BREVE" | "ENCERRADO";
  channels: string;
}

export default function HomeTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const catalog = useSession((s) => s.catalog);
  const loadVod = useSession((s) => s.loadVod);
  const loadSeries = useSession((s) => s.loadSeries);
  const loadLive = useSession((s) => s.loadLive);
  const setQueue = useSession((s) => s.setQueue);

  const [activationCode, setActivationCode] = useState("LICENÇA ATIVA");
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  const [showJogosModal, setShowJogosModal] = useState(false);
  const [showEpgModal, setShowEpgModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [modalTab, setModalTab] = useState<"lista" | "imagens">("lista");
  const [guiaJogos, setGuiaJogos] = useState<GuiaMatch[]>([]);
  const [dailyCardsImages, setDailyCardsImages] = useState<string[]>([]);
  const [loadingJogos, setLoadingJogos] = useState(false);

  // Estados para o EPG de Canais
  const [epgCategories, setEpgCategories] = useState<any[]>([]);
  const [selectedEpgCat, setSelectedEpgCat] = useState<string>("all");
  const [epgChannels, setEpgChannels] = useState<any[]>([]);

  const scrollAnimMovies = useRef(new Animated.Value(0)).current;
  const scrollAnimSeries = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).toUpperCase();
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
      AsyncStorage.getItem("@goldcast_saved_code").then((code) => { if (code && isMounted) setActivationCode(code); });
      if (session) {
        if (loadVod) loadVod(true).catch(() => {});
        if (loadSeries) loadSeries(true).catch(() => {});
        if (loadLive) loadLive().catch(() => {});
      }
      return () => { isMounted = false; };
    }, [session, loadVod, loadSeries, loadLive])
  );

  useEffect(() => {
    const animMovies = Animated.loop(
      Animated.timing(scrollAnimMovies, {
        toValue: 1,
        duration: 25000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animMovies.start();

    const animSeries = Animated.loop(
      Animated.timing(scrollAnimSeries, {
        toValue: 1,
        duration: 25000,
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

  // Carrega categorias e canais para o EPG
  useEffect(() => {
    if (catalog?.liveCats) {
      setEpgCategories(catalog.liveCats);
    }
    if (catalog?.live) {
      setEpgChannels(catalog.live);
    }
  }, [catalog]);

  const filteredEpgChannels = useMemo(() => {
    if (selectedEpgCat === "all") return epgChannels.slice(0, 30);
    return epgChannels.filter((c) => String(c?.category_id) === String(selectedEpgCat)).slice(0, 30);
  }, [epgChannels, selectedEpgCat]);

  // Pesquisa Global em Filmes, Séries e Canais
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return { movies: [], series: [], channels: [] };
    const q = searchQuery.toLowerCase();

    const movies = (catalog?.vod || []).filter((m: any) => (m?.name || "").toLowerCase().includes(q)).slice(0, 10);
    const series = (catalog?.series || []).filter((s: any) => (s?.name || "").toLowerCase().includes(q)).slice(0, 10);
    const channels = (catalog?.live || []).filter((c: any) => (c?.name || c?.title || "").toLowerCase().includes(q)).slice(0, 10);

    return { movies, series, channels };
  }, [searchQuery, catalog]);

  useEffect(() => {
    if (!showJogosModal) return;
    let isMounted = true;
    const fetchGuiaAndBanners = async () => {
      setLoadingJogos(true);
      try {
        let fetchedImages: string[] = [];
        
        try {
          const resImages = await fetch("https://lijsnoovwvxebzbaal.supabase.co/rest/v1/daily_matches?select=image_url", {
            headers: {
              "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpanNub292d3Z4ZWJ6YmFhbCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzY2OTY5NTI1LCJleHAiOjIwODI1NDU1MjV9.exemplo_chave",
              "Accept": "application/json"
            }
          });

          if (resImages.ok) {
            const json = await resImages.json();
            if (Array.isArray(json)) {
              fetchedImages = json.map((item: any) => item.image_url).filter(Boolean);
            }
          }
        } catch (e) {
          console.log("Erro ao buscar do Supabase:", e);
        }

        if (fetchedImages.length === 0) {
          fetchedImages = [
            "https://lijsnoovwvxebzbaal.supabase.co/storage/v1/object/public/jogos-diarios/1000611243.jpg",
            "https://lijsnoovwvxebzbaal.supabase.co/storage/v1/object/public/jogos-diarios/1000611244.jpg",
            "https://lijsnoovwvxebzbaal.supabase.co/storage/v1/object/public/jogos-diarios/1000611245.jpg",
            "https://lijsnoovwvxebzbaal.supabase.co/storage/v1/object/public/jogos-diarios/1000611246.jpg"
          ];
        }

        if (isMounted) setDailyCardsImages(fetchedImages);

        let matches: GuiaMatch[] = [
          { id: "br-1", time: "19:30", league: "CAMPEONATO BRASILEIRO — SÉRIE A", teamA: "Fluminense", teamB: "Internacional", score: "VS", status: "EM BREVE", channels: "RECORD • Premiere" },
          { id: "br-2", time: "19:30", league: "CAMPEONATO BRASILEIRO — SÉRIE A", teamA: "Santos", teamB: "Palmeiras", score: "VS", status: "EM BREVE", channels: "SPORTV • Premiere" },
          { id: "br-3", time: "19:30", league: "CAMPEONATO BRASILEIRO — SÉRIE A", teamA: "RB Bragantino", teamB: "Chapecoense", score: "VS", status: "EM BREVE", channels: "Premiere" },
          { id: "br-4", time: "21:30", league: "CAMPEONATO BRASILEIRO — SÉRIE A", teamA: "Bahia", teamB: "São Paulo", score: "VS", status: "EM BREVE", channels: "Globo • Premiere" },
          { id: "br-5", time: "21:30", league: "CAMPEONATO BRASILEIRO — SÉRIE A", teamA: "Remo", teamB: "Botafogo", score: "VS", status: "EM BREVE", channels: "Globo • Premiere" },
          { id: "int-1", time: "14:30", league: "FUTEBOL INTERNACIONAL", teamA: "AC Milan", teamB: "Bologna", score: "VS", status: "EM BREVE", channels: "ESPN 4 • Disney+" },
          { id: "int-2", time: "14:30", league: "FUTEBOL INTERNACIONAL", teamA: "Parma", teamB: "Udinese", score: "VS", status: "EM BREVE", channels: "Disney+" },
          { id: "int-3", time: "14:30", league: "FUTEBOL INTERNACIONAL", teamA: "Venezia", teamB: "Inter", score: "VS", status: "EM BREVE", channels: "Disney+" },
          { id: "int-4", time: "16:30", league: "FUTEBOL INTERNACIONAL", teamA: "Manchester City", teamB: "Brighton", score: "VS", status: "EM BREVE", channels: "Disney+" },
          { id: "int-5", time: "17:00", league: "FUTEBOL INTERNACIONAL", teamA: "Liverpool FC", teamB: "Chelsea", score: "VS", status: "ESPN • Disney+" },
        ];

        if (isMounted) setGuiaJogos(matches);
      } catch {
        // Fallback
      } finally {
        if (isMounted) setLoadingJogos(false);
      }
    };

    fetchGuiaAndBanners();
    return () => { isMounted = false; };
  }, [showJogosModal]);

  const isTestAccount = useMemo(() => {
    return !activationCode || activationCode.includes("TESTE") || activationCode.length < 5;
  }, [activationCode]);

  const moviesList = useMemo(() => (catalog.vod || []).slice(0, 15), [catalog.vod]);
  const seriesList = useMemo(() => (catalog.series || []).slice(0, 15), [catalog.series]);

  const translateXMovies = scrollAnimMovies.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -400],
  });

  const translateXSeries = scrollAnimSeries.interpolate({
    inputRange: [0, 1],
    outputRange: [-400, 0],
  });

  return (
    <View style={[styles.root, { backgroundColor: "#1B3B4B" }]}>
      <View style={styles.tvHeader}>
        <View style={styles.headerLeft}>
          <Pressable focusable={true} onPress={() => router.push("/(tabs)/settings")} style={styles.headerIconBtn} hitSlop={10}>
            <Ionicons name="menu" size={26} color="#FFF" />
          </Pressable>
          <Text style={styles.tvBrand}>GoldCast Media Player</Text>
        </View>

        <View style={styles.headerCenterCode}>
          <Ionicons name="key" size={13} color="#E9C46A" />
          <Text style={styles.codeText}>{activationCode}</Text>
        </View>

        <View style={styles.headerRight}>
          <Pressable 
            focusable={true} 
            onPress={() => setShowEpgModal(true)} 
            style={({ focused }) => [styles.epgHeaderBtn, focused && styles.cardFocused]}
          >
            <Ionicons name="list" size={16} color="#E9C46A" />
            <Text style={styles.epgBtnText}>EPG</Text>
          </Pressable>

          <Pressable focusable={true} style={styles.headerIconBtn}>
            <Ionicons name="cart-outline" size={22} color="#FFF" />
          </Pressable>

          <Pressable 
            focusable={true} 
            style={styles.headerIconBtn} 
            onPress={() => setShowSearchModal(true)}
          >
            <Ionicons name="search-outline" size={22} color="#FFF" />
          </Pressable>

          <Text style={styles.headerDate}>{currentDate}</Text>
          <Text style={styles.headerTime}>{currentTime}</Text>
        </View>
      </View>

      <View style={styles.mainLayoutContainer}>
        <View style={styles.leftContainer}>
          <View style={styles.dynamicRowSection}>
            <Text style={styles.sectionCategoryTitle}>🎬 Filmes | Novidades</Text>
            <View style={styles.tickerWrapper}>
              <Animated.View style={[styles.tickerTrack, { transform: [{ translateX: translateXMovies }] }]}>
                {moviesList.concat(moviesList).map((item, idx) => (
                  <Pressable
                    key={`mov-${item.stream_id}-${idx}`}
                    focusable={true}
                    onPress={() => router.push({ pathname: "/movie/[id]", params: { id: String(item.stream_id) } })}
                    style={styles.tickerCard}
                  >
                    <Image source={{ uri: item.stream_icon }} style={styles.fullSize} contentFit="cover" cachePolicy="memory-disk" />
                    <View style={styles.tickerGradient}>
                      <Text style={styles.tickerTitle} numberOfLines={1}>{item.name}</Text>
                    </View>
                  </Pressable>
                ))}
              </Animated.View>
            </View>
          </View>

          <View style={styles.dynamicRowSection}>
            <Text style={styles.sectionCategoryTitle}>🍿 Séries | Em Alta</Text>
            <View style={styles.tickerWrapper}>
              <Animated.View style={[styles.tickerTrack, { transform: [{ translateX: translateXSeries }] }]}>
                {seriesList.concat(seriesList).map((s, idx) => (
                  <Pressable
                    key={`ser-${s.series_id}-${idx}`}
                    focusable={true}
                    onPress={() => router.push({ pathname: "/series/[id]", params: { id: String(s.series_id) } })}
                    style={styles.tickerCard}
                  >
                    <Image source={{ uri: s.cover }} style={styles.fullSize} contentFit="cover" cachePolicy="memory-disk" />
                    <View style={styles.tickerGradient}>
                      <Text style={styles.tickerTitle} numberOfLines={1}>{s.name}</Text>
                    </View>
                  </Pressable>
                ))}
              </Animated.View>
            </View>
          </View>

          <View style={styles.bottomBarBelow}>
            <Pressable focusable={true} onPress={() => setShowJogosModal(true)} style={({ focused }) => [styles.bottomCard, focused && styles.cardFocused]}>
              <Ionicons name="football-outline" size={20} color="#FFF" />
              <Text style={styles.bottomCardText}>JOGOS DE HOJE</Text>
            </Pressable>

            <Pressable focusable={true} onPress={() => Alert.alert("Atualizações", "O aplicativo está na versão mais recente.")} style={({ focused }) => [styles.bottomCard, focused && styles.cardFocused]}>
              <Ionicons name="newspaper-outline" size={20} color="#FFF" />
              <Text style={styles.bottomCardText}>ATUALIZAÇÕES</Text>
            </Pressable>

            <Pressable focusable={true} onPress={() => router.push("/continue")} style={({ focused }) => [styles.bottomCard, focused && styles.cardFocused]}>
              <Ionicons name="play-circle-outline" size={20} color="#E9C46A" />
              <Text style={[styles.bottomCardText, { color: "#E9C46A" }]}>CONTINUAR</Text>
            </Pressable>

            <View style={styles.statusBadgeWrap}>
              <Text style={[styles.premiumLabel, isTestAccount && { color: "#E76F51" }]}>
                {isTestAccount ? "Teste" : "Premium"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.rightColumn}>
          <Pressable
            focusable={true}
            onPress={() => router.push("/(tabs)/movies")}
            style={({ focused }) => [styles.cardTriple, { backgroundColor: "#E76F51" }, focused && styles.cardFocused]}
          >
            <View style={styles.cardTripleInner}>
              <Ionicons name="play-circle-outline" size={32} color="#FFF" />
              <Text style={styles.cardTitleTriple}>FILMES</Text>
            </View>
          </Pressable>

          <Pressable
            focusable={true}
            onPress={() => router.push("/(tabs)/series")}
            style={({ focused }) => [styles.cardTriple, { backgroundColor: "#F4A261" }, focused && styles.cardFocused]}
          >
            <View style={styles.cardTripleInner}>
              <Ionicons name="film-outline" size={32} color="#FFF" />
              <Text style={styles.cardTitleTriple}>SÉRIES</Text>
            </View>
          </Pressable>

          <Pressable
            focusable={true}
            onPress={() => router.push("/(tabs)/live")}
            style={({ focused }) => [styles.cardTriple, { backgroundColor: "#2A9D8F" }, focused && styles.cardFocused]}
          >
            <View style={styles.cardTripleInner}>
              <Ionicons name="tv-outline" size={32} color="#FFF" />
              <Text style={styles.cardTitleTriple}>CANAIS</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* MODAL DE JOGOS DE HOJE */}
      <Modal visible={showJogosModal} animationType="fade" transparent={true} onRequestClose={() => setShowJogosModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="football" size={18} color="#E9C46A" />
                </View>
                <Text style={styles.modalTitle}>🔥 JOGOS DE HOJE — GUIA NA TV</Text>
              </View>

              <View style={styles.tabToggleRow}>
                <Pressable
                  focusable={true}
                  onPress={() => setModalTab("lista")}
                  style={[styles.tabBtn, modalTab === "lista" && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabBtnText, modalTab === "lista" && styles.tabBtnTextActive]}>📅 Horários</Text>
                </Pressable>
                <Pressable
                  focusable={true}
                  onPress={() => setModalTab("imagens")}
                  style={[styles.tabBtn, modalTab === "imagens" && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabBtnText, modalTab === "imagens" && styles.tabBtnTextActive]}>🖼️ Cards Oficiais</Text>
                </Pressable>
              </View>

              <Pressable onPress={() => setShowJogosModal(false)} style={styles.closeBtn} focusable={true}>
                <Ionicons name="close" size={18} color="#FFF" />
              </Pressable>
            </View>

            {loadingJogos ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#E9C46A" />
                <Text style={styles.loadingText}>Carregando programação oficial do dia...</Text>
              </View>
            ) : modalTab === "lista" ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
                {guiaJogos.map((g) => (
                  <View key={g.id} style={styles.guiaCard}>
                    <View style={styles.guiaCardTopRow}>
                      <View style={styles.guiaTimeBadge}>
                        <Ionicons name="time-outline" size={12} color="#000" />
                        <Text style={styles.guiaTimeText}>{g.time}</Text>
                      </View>
                      <View style={[styles.statusBadge, g.status === "AO VIVO" && styles.statusLive]}>
                        <Text style={[styles.statusText, g.status === "AO VIVO" && { color: "#FFF" }]}>{g.status}</Text>
                      </View>
                      <Text style={styles.guiaLeagueText} numberOfLines={1}>{g.league}</Text>
                    </View>

                    <View style={styles.guiaMatchRow}>
                      <Text style={styles.teamText} numberOfLines={1}>{g.teamA}</Text>
                      <View style={styles.scoreBox}>
                        <Text style={styles.scoreText}>{g.score}</Text>
                      </View>
                      <Text style={[styles.teamText, { textAlign: "right" }]} numberOfLines={1}>{g.teamB}</Text>
                    </View>

                    <View style={styles.guiaChannelsRow}>
                      <Ionicons name="tv-outline" size={13} color="#E9C46A" />
                      <Text style={styles.guiaChannelsText} numberOfLines={1}>Canais: {g.channels}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
                {dailyCardsImages.length === 0 ? (
                  <View style={styles.centerBox}>
                    <Ionicons name="images-outline" size={40} color="#E9C46A" />
                    <Text style={styles.loadingText}>Nenhum card oficial cadastrado para hoje.</Text>
                  </View>
                ) : (
                  dailyCardsImages.map((imgUrl, index) => (
                    <View key={`img-${index}`} style={styles.imageCardWrapperVertical}>
                      <RNImage 
                        source={{ uri: imgUrl }} 
                        style={styles.dailyCardImageVertical} 
                        resizeMode="contain"
                      />
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL DO GUIA EPG DE CANAIS REAL (ESTILO XCIPTV) */}
      <Modal visible={showEpgModal} animationType="fade" transparent={true} onRequestClose={() => setShowEpgModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.epgModalCard}>
            <View style={styles.epgHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="tv" size={20} color="#E9C46A" />
                <Text style={styles.modalTitle}>GUIA DE PROGRAMAÇÃO — EPG</Text>
              </View>
              <Pressable onPress={() => setShowEpgModal(false)} style={styles.closeBtn} focusable={true}>
                <Ionicons name="close" size={18} color="#FFF" />
              </Pressable>
            </View>

            {/* Sub-barra de Categorias EPG */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.epgCategoriesBar}>
              <Pressable
                focusable={true}
                onPress={() => setSelectedEpgCat("all")}
                style={[styles.epgCatTab, selectedEpgCat === "all" && styles.epgCatTabActive]}
              >
                <Text style={[styles.epgCatText, selectedEpgCat === "all" && styles.epgCatTextActive]}>TODAS</Text>
              </Pressable>
              {epgCategories.map((cat, idx) => {
                const catId = String(cat?.category_id || cat?.id || idx);
                const isSelected = selectedEpgCat === catId;
                return (
                  <Pressable
                    key={`epg-cat-${catId}-${idx}`}
                    focusable={true}
                    onPress={() => setSelectedEpgCat(catId)}
                    style={[styles.epgCatTab, isSelected && styles.epgCatTabActive]}
                  >
                    <Text style={[styles.epgCatText, isSelected && styles.epgCatTextActive]} numberOfLines={1}>
                      {cat?.category_name || cat?.name || "Categoria"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Grelha de Canais e Programação EPG Real */}
            <View style={styles.epgContentArea}>
              <View style={styles.epgTableHead}>
                <Text style={styles.epgHeadChannelCol}>CANAL</Text>
                <Text style={styles.epgHeadTimeCol}>PROGRAMAÇÃO AO VIVO (EPG)</Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.epgListScroll}>
                {filteredEpgChannels.length === 0 ? (
                  <View style={styles.centerBox}>
                    <Ionicons name="tv-outline" size={36} color="#E9C46A" />
                    <Text style={styles.loadingText}>Nenhum canal carregado nesta categoria.</Text>
                  </View>
                ) : (
                  filteredEpgChannels.map((item, idx) => (
                    <EpgRowItem
                      key={`epg-chan-${item?.stream_id || idx}`}
                      session={session}
                      item={item}
                      onSelect={() => {
                        setShowEpgModal(false);
                        router.push({ pathname: "/live/[id]", params: { id: String(item?.stream_id || item?.id) } });
                      }}
                    />
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE PESQUISA GLOBAL (FILMES, SÉRIES E CANAIS) */}
      <Modal visible={showSearchModal} animationType="fade" transparent={true} onRequestClose={() => setShowSearchModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.searchModalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="search" size={20} color="#E9C46A" />
                <Text style={styles.modalTitle}>PESQUISA GLOBAL</Text>
              </View>
              <Pressable onPress={() => setShowSearchModal(false)} style={styles.closeBtn} focusable={true}>
                <Ionicons name="close" size={18} color="#FFF" />
              </Pressable>
            </View>

            <View style={styles.searchModalInputRow}>
              <Ionicons name="search" size={18} color="#E9C46A" />
              <TextInput
                style={styles.searchModalTextInput}
                placeholder="Pesquisar filmes, séries e canais..."
                placeholderTextColor="#6B7280"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={true}
                blurOnSubmit={false}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.searchResultsContainer}>
              {searchQuery.trim().length < 2 ? (
                <View style={styles.centerBox}>
                  <Ionicons name="search-outline" size={40} color="#6B7280" />
                  <Text style={styles.loadingText}>Digite pelo menos 2 caracteres para pesquisar.</Text>
                </View>
              ) : (
                <>
                  {/* FILMES */}
                  {searchResults.movies.length > 0 && (
                    <View style={styles.searchGroup}>
                      <Text style={styles.searchGroupTitle}>🎬 Filmes</Text>
                      <View style={styles.searchGridRow}>
                        {searchResults.movies.map((m: any) => (
                          <Pressable
                            key={`s-mov-${m.stream_id}`}
                            focusable={true}
                            onPress={() => {
                              setShowSearchModal(false);
                              router.push({ pathname: "/movie/[id]", params: { id: String(m.stream_id) } });
                            }}
                            style={({ focused }) => [styles.searchItemCard, focused && styles.cardFocused]}
                          >
                            <RNImage source={{ uri: m.stream_icon || m.cover }} style={styles.searchPoster} resizeMode="cover" />
                            <Text style={styles.searchItemTitle} numberOfLines={1}>{m.name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* SÉRIES */}
                  {searchResults.series.length > 0 && (
                    <View style={styles.searchGroup}>
                      <Text style={styles.searchGroupTitle}>🍿 Séries</Text>
                      <View style={styles.searchGridRow}>
                        {searchResults.series.map((s: any) => (
                          <Pressable
                            key={`s-ser-${s.series_id}`}
                            focusable={true}
                            onPress={() => {
                              setShowSearchModal(false);
                              router.push({ pathname: "/series/[id]", params: { id: String(s.series_id) } });
                            }}
                            style={({ focused }) => [styles.searchItemCard, focused && styles.cardFocused]}
                          >
                            <RNImage source={{ uri: s.cover || s.stream_icon }} style={styles.searchPoster} resizeMode="cover" />
                            <Text style={styles.searchItemTitle} numberOfLines={1}>{s.name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* CANAIS */}
                  {searchResults.channels.length > 0 && (
                    <View style={styles.searchGroup}>
                      <Text style={styles.searchGroupTitle}>📺 Canais</Text>
                      <View style={styles.searchGridRow}>
                        {searchResults.channels.map((c: any) => {
                          const chanId = String(c?.stream_id || c?.id || "");
                          const chanName = c?.name || c?.title || "Canal";
                          const logo = c?.stream_icon || "";
                          return (
                            <Pressable
                              key={`s-chan-${chanId}`}
                              focusable={true}
                              onPress={() => {
                                if (!session) return;
                                const liveUrl = `${session.server.replace(/\/+$/, "")}/live/${session.username}/${session.password}/${chanId}.ts`;
                                setQueue([{
                                  kind: "live",
                                  id: chanId,
                                  title: chanName,
                                  subtitle: "Canal ao Vivo",
                                  logo,
                                  urls: [liveUrl],
                                  raw: c,
                                }], 0);
                                setShowSearchModal(false);
                                router.push("/player");
                              }}
                              style={({ focused }) => [styles.searchChannelCard, focused && styles.cardFocused]}
                            >
                              <RNImage source={{ uri: logo }} style={styles.searchChannelLogo} resizeMode="contain" />
                              <Text style={styles.searchItemTitle} numberOfLines={1}>{chanName}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {searchResults.movies.length === 0 && searchResults.series.length === 0 && searchResults.channels.length === 0 && (
                    <View style={styles.centerBox}>
                      <Ionicons name="alert-circle-outline" size={36} color="#E9C46A" />
                      <Text style={styles.loadingText}>Nenhum resultado encontrado para "{searchQuery}".</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Componente auxiliar blindado para carregar o EPG real de cada canal individualmente
function EpgRowItem({ session, item, onSelect }: { session: any; item: any; onSelect: () => void }) {
  const [epgList, setEpgList] = useState<EpgEntry[]>([]);
  const [loadingEpg, setLoadingEpg] = useState(true);

  const channelId = item?.stream_id || item?.id;
  const channelName = item?.name || item?.title || "Canal";
  const logoUri = item?.stream_icon || "";

  useEffect(() => {
    let isMounted = true;
    if (!session || !channelId || !xtream?.shortEpg) {
      setLoadingEpg(false);
      return;
    }

    xtream.shortEpg(session, channelId, 2)
      .then((entries) => {
        if (isMounted && Array.isArray(entries)) {
          setEpgList(entries);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingEpg(false);
      });

    return () => { isMounted = false; };
  }, [session, channelId]);

  const currentProgram = epgList && epgList.length > 0 ? epgList[0] : null;
  const formattedTime = currentProgram?.start_timestamp && typeof xtream?.fmtTimeSP === "function" 
    ? xtream.fmtTimeSP(currentProgram.start_timestamp) 
    : "";

  return (
    <Pressable
      focusable={true}
      onPress={onSelect}
      style={({ focused }) => [styles.epgRowItem, focused && styles.epgRowFocused]}
    >
      <View style={styles.epgChannelInfoCol}>
        {logoUri ? (
          <RNImage source={{ uri: logoUri }} style={styles.epgLogo} resizeMode="contain" />
        ) : (
          <Ionicons name="tv-outline" size={20} color="#E9C46A" />
        )}
        <Text style={styles.epgChannelName} numberOfLines={1}>{channelName}</Text>
      </View>

      <View style={styles.epgProgramInfoCol}>
        {loadingEpg ? (
          <Text style={styles.epgProgramSub}>A carregar EPG...</Text>
        ) : currentProgram ? (
          <>
            <Text style={styles.epgProgramTitle} numberOfLines={1}>
              {formattedTime ? `${formattedTime} — ` : ""}{currentProgram.title || "Programa ao vivo"}
            </Text>
            {!!currentProgram.description && (
              <Text style={styles.epgProgramSub} numberOfLines={1}>{currentProgram.description}</Text>
            )}
          </>
        ) : (
          <Text style={styles.epgProgramSub}>Transmitindo ao vivo na grade oficial</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 36, paddingVertical: 20, justifyContent: "space-between" },
  
  tvHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", position: "relative" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  tvBrand: { color: "#FFF", fontSize: 18, fontWeight: "900", letterSpacing: 1.2 },
  
  headerCenterCode: {
    position: "absolute",
    left: "50%",
    transform: [{ translateX: -75 }],
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(233,196,106,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.4)",
  },
  codeText: { color: "#E9C46A", fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },

  headerRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerIconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  epgHeaderBtn: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 6, 
    backgroundColor: "rgba(233,196,106,0.15)", 
    paddingHorizontal: 12, 
    height: 38, 
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(233,196,106,0.4)"
  },
  epgBtnText: { color: "#E9C46A", fontSize: 12, fontWeight: "900", letterSpacing: 0.8 },

  headerDate: { color: "#E9C46A", fontSize: 14, fontWeight: "700" },
  headerTime: { color: "#FFF", fontSize: 18, fontWeight: "900" },

  mainLayoutContainer: { flexDirection: "row", gap: 20, height: "76%" },
  leftContainer: { flex: 1.4, justifyContent: "space-between" },
  rightColumn: { flex: 1, justifyContent: "space-between" },
  
  dynamicRowSection: { gap: 6 },
  sectionCategoryTitle: { color: "#FFF", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  tickerWrapper: { height: 115, overflow: "hidden", position: "relative" },
  tickerTrack: { flexDirection: "row", gap: 10, position: "absolute", left: 0 },
  tickerCard: { width: 85, height: 115, borderRadius: 10, overflow: "hidden", backgroundColor: "#152E3B", position: "relative" },
  tickerGradient: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.85)", padding: 4 },
  tickerTitle: { color: "#FFF", fontSize: 9, fontWeight: "800", textAlign: "center" },

  cardTriple: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    maxHeight: "30%",
  },
  cardFocused: {
    borderColor: "#E9C46A",
    borderWidth: 3,
    transform: [{ scale: 1.02 }],
  },
  cardTripleInner: { flex: 1, flexDirection: "row", alignItems: "center", paddingLeft: 24, gap: 16 },
  cardTitleTriple: { color: "#FFF", fontSize: 18, fontWeight: "900", letterSpacing: 1.5 },

  bottomBarBelow: { flexDirection: "row", gap: 12, height: "18%" },
  bottomCard: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: "transparent",
  },
  bottomCardText: { color: "#FFF", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  statusBadgeWrap: { flex: 0.8, alignItems: "flex-end", justifyContent: "center", paddingRight: 4 },
  premiumLabel: { color: "#2A9D8F", fontSize: 14, fontWeight: "900", letterSpacing: 0.5 },

  fullSize: { width: "100%", height: "100%" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 850, height: "88%", backgroundColor: "#152E3B", borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(233,196,106,0.3)", padding: 22, gap: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", paddingBottom: 12 },
  modalIconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(233,196,106,0.15)", alignItems: "center", justifyContent: "center" },
  modalTitle: { color: "#E9C46A", fontSize: 15, fontWeight: "900", letterSpacing: 0.8 },
  
  tabToggleRow: { flexDirection: "row", gap: 8, backgroundColor: "#1B3B4B", padding: 4, borderRadius: 10 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tabBtnActive: { backgroundColor: "#E9C46A" },
  tabBtnText: { color: "#9CA3AF", fontSize: 11, fontWeight: "800" },
  tabBtnTextActive: { color: "#000", fontWeight: "900" },

  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#1B3B4B", alignItems: "center", justifyContent: "center" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: "#E9C46A", fontSize: 12, fontWeight: "600", textAlign: "center" },
  listContainer: { gap: 16, paddingVertical: 4 },
  
  guiaCard: { 
    backgroundColor: "#1B3B4B", 
    borderRadius: 14, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: "rgba(233,196,106,0.18)", 
    gap: 10 
  },
  guiaCardTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  guiaTimeBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E9C46A", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  guiaTimeText: { color: "#000", fontSize: 10, fontWeight: "900" },
  statusBadge: { backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusLive: { backgroundColor: "#E76F51" },
  statusText: { color: "#9CA3AF", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  guiaLeagueText: { color: "#E9C46A", fontSize: 11, fontWeight: "700", flex: 1, textAlign: "right" },
  
  guiaMatchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  teamText: { color: "#FFF", fontSize: 15, fontWeight: "900", flex: 1, letterSpacing: 0.3 },
  scoreBox: { backgroundColor: "#1B3B4B", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  scoreText: { color: "#E9C46A", fontSize: 14, fontWeight: "900", letterSpacing: 1 },

  guiaChannelsRow: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", paddingTop: 8 },
  guiaChannelsText: { color: "#E9C46A", fontSize: 11.5, fontWeight: "800" },

  imageCardWrapperVertical: { 
    width: "100%", 
    height: 720, 
    backgroundColor: "#000000", 
    borderRadius: 14, 
    overflow: "hidden", 
    borderWidth: 1.5, 
    borderColor: "rgba(233,196,106,0.3)", 
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  dailyCardImageVertical: { 
    width: "100%", 
    height: "100%" 
  },

  // Estilos do Modal EPG
  epgModalCard: { width: "94%", maxWidth: 1000, height: "88%", backgroundColor: "#152E3B", borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(233,196,106,0.3)", padding: 20, gap: 14 },
  epgHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", paddingBottom: 10 },
  epgCategoriesBar: { gap: 8, paddingVertical: 4, maxHeight: 42 },
  epgCatTab: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 8, height: 36, justifyContent: "center" },
  epgCatTabActive: { backgroundColor: "#E9C46A" },
  epgCatText: { color: "#9CA3AF", fontSize: 11, fontWeight: "800" },
  epgCatTextActive: { color: "#000", fontWeight: "900" },
  epgContentArea: { flex: 1, backgroundColor: "#10222B", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(233,196,106,0.15)" },
  epgTableHead: { flexDirection: "row", backgroundColor: "#1B3B4B", paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "rgba(233,196,106,0.2)" },
  epgHeadChannelCol: { width: "35%", color: "#E9C46A", fontSize: 11, fontWeight: "900" },
  epgHeadTimeCol: { flex: 1, color: "#E9C46A", fontSize: 11, fontWeight: "900" },
  epgListScroll: { padding: 6, gap: 6 },
  epgRowItem: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(27,59,75,0.6)", borderRadius: 8, padding: 10, borderWidth: 1.5, borderColor: "transparent" },
  epgRowFocused: { borderColor: "#E9C46A", backgroundColor: "#1B3B4B", transform: [{ scale: 1.01 }] },
  epgChannelInfoCol: { width: "35%", flexDirection: "row", alignItems: "center", gap: 10, paddingRight: 10 },
  epgLogo: { width: 36, height: 36, borderRadius: 6 },
  epgChannelName: { color: "#FFF", fontSize: 12, fontWeight: "800", flex: 1 },
  epgProgramInfoCol: { flex: 1, gap: 3 },
  epgProgramTitle: { color: "#E9C46A", fontSize: 12, fontWeight: "800" },
  epgProgramSub: { color: "#9CA3AF", fontSize: 10, fontWeight: "600" },

  // Estilos da Pesquisa Global
  searchModalCard: { width: "94%", maxWidth: 900, height: "85%", backgroundColor: "#152E3B", borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(233,196,106,0.3)", padding: 22, gap: 16 },
  searchModalInputRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#10222B", borderRadius: 12, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: "rgba(233,196,106,0.2)", gap: 10 },
  searchModalTextInput: { flex: 1, color: "#FFF", fontSize: 14, fontWeight: "700" },
  searchResultsContainer: { gap: 16, paddingBottom: 20 },
  searchGroup: { gap: 8 },
  searchGroupTitle: { color: "#E9C46A", fontSize: 13, fontWeight: "900", letterSpacing: 0.8 },
  searchGridRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  searchItemCard: { width: 100, height: 145, backgroundColor: "#10222B", borderRadius: 8, overflow: "hidden", borderWidth: 2, borderColor: "transparent", justifyContent: "space-between" },
  searchChannelCard: { width: 130, height: 85, backgroundColor: "#10222B", borderRadius: 8, padding: 6, borderWidth: 2, borderColor: "transparent", justifyContent: "space-between", alignItems: "center" },
  searchPoster: { width: "100%", height: 112 },
  searchChannelLogo: { width: "100%", height: 42 },
  searchItemTitle: { color: "#FFF", fontSize: 9, fontWeight: "800", textAlign: "center", paddingBottom: 4, paddingHorizontal: 4 },
});
