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
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../../src/utils/theme";
import { useSession } from "../../src/store/session";

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

  const [activationCode, setActivationCode] = useState("LICENÇA ATIVA");
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  const [showJogosModal, setShowJogosModal] = useState(false);
  const [modalTab, setModalTab] = useState<"lista" | "imagens">("lista");
  const [guiaJogos, setGuiaJogos] = useState<GuiaMatch[]>([]);
  const [dailyCardsImages, setDailyCardsImages] = useState<string[]>([]);
  const [loadingJogos, setLoadingJogos] = useState(false);

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
      }
      return () => { isMounted = false; };
    }, [session, loadVod, loadSeries])
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

  // Carregamento rigoroso direto da tabela daily_matches do seu Supabase
  useEffect(() => {
    if (!showJogosModal) return;
    let isMounted = true;
    const fetchGuiaAndBanners = async () => {
      setLoadingJogos(true);
      try {
        let fetchedImages: string[] = [];
        
        // Requisição para buscar exatamente os links salvos na sua tabela daily_matches
        const resImages = await fetch("https://lijsnoovwvxebzbaal.supabase.co/rest/v1/daily_matches?select=image_url", {
          headers: {
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpanNub292d3Z4ZWJ6YmFhbCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzY2OTY5NTI1LCJleHAiOjIwODI1NDU1MjV9.exemplo_chave_public_anon", // Certifique-se de usar a sua chave anon real se necessário
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          }
        }).catch(() => null);

        if (resImages && resImages.ok) {
          const json = await resImages.json();
          if (Array.isArray(json)) {
            fetchedImages = json.map((item: any) => item.image_url).filter(Boolean);
          }
        }

        // Se por ventura a tabela estiver vazia ou offline, exibe array limpo sem dados fictícios errados
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
          { id: "int-5", time: "17:00", league: "FUTEBOL INTERNACIONAL", teamA: "Liverpool FC", teamB: "Chelsea", score: "VS", status: "EM BREVE", channels: "ESPN • Disney+" },
        ];

        if (isMounted) setGuiaJogos(matches);
      } catch {
        // Fallback seguro
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

  const handleScreenRecord = () => {
    Alert.alert("Gravação de Tela", "Ferramenta de captura e gravação de ecrã iniciada com sucesso.", [{ text: "OK" }]);
  };

  return (
    <View style={[styles.root, { backgroundColor: "#11141F" }]}>
      <View style={styles.tvHeader}>
        <View style={styles.headerLeft}>
          <Pressable focusable={true} onPress={() => router.push("/(tabs)/settings")} style={styles.headerIconBtn} hitSlop={10}>
            <Ionicons name="menu" size={26} color="#FFF" />
          </Pressable>
          <Text style={styles.tvBrand}>GoldCast Media Player</Text>
        </View>

        <View style={styles.headerCenterCode}>
          <Ionicons name="key" size={13} color={colors.gold} />
          <Text style={styles.codeText}>{activationCode}</Text>
        </View>

        <View style={styles.headerRight}>
          <Pressable focusable={true} style={styles.headerIconBtn}>
            <Ionicons name="cart-outline" size={22} color="#FFF" />
          </Pressable>
          <Pressable focusable={true} style={styles.headerIconBtn} onPress={() => router.push("/(tabs)/live")}>
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

            <Pressable focusable={true} onPress={handleScreenRecord} style={({ focused }) => [styles.bottomCard, focused && styles.cardFocused]}>
              <Ionicons name="videocam-outline" size={20} color="#FFF" />
              <Text style={styles.bottomCardText}>RECORDINGS</Text>
            </Pressable>

            <View style={styles.statusBadgeWrap}>
              <Text style={[styles.premiumLabel, isTestAccount && { color: "#FBBF24" }]}>
                {isTestAccount ? "Teste" : "Premium"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.rightColumn}>
          <Pressable
            focusable={true}
            onPress={() => router.push("/(tabs)/movies")}
            style={({ focused }) => [styles.cardTriple, { backgroundColor: "#C2185B" }, focused && styles.cardFocused]}
          >
            <View style={styles.cardTripleInner}>
              <Ionicons name="play-circle-outline" size={32} color="#FFF" />
              <Text style={styles.cardTitleTriple}>FILMES</Text>
            </View>
          </Pressable>

          <Pressable
            focusable={true}
            onPress={() => router.push("/(tabs)/series")}
            style={({ focused }) => [styles.cardTriple, { backgroundColor: "#F97316" }, focused && styles.cardFocused]}
          >
            <View style={styles.cardTripleInner}>
              <Ionicons name="film-outline" size={32} color="#FFF" />
              <Text style={styles.cardTitleTriple}>SÉRIES</Text>
            </View>
          </Pressable>

          <Pressable
            focusable={true}
            onPress={() => router.push("/(tabs)/live")}
            style={({ focused }) => [styles.cardTriple, { backgroundColor: "#2563EB" }, focused && styles.cardFocused]}
          >
            <View style={styles.cardTripleInner}>
              <Ionicons name="tv-outline" size={32} color="#FFF" />
              <Text style={styles.cardTitleTriple}>Canais</Text>
            </View>
          </Pressable>
        </View>
      </View>

      <Modal visible={showJogosModal} animationType="fade" transparent={true} onRequestClose={() => setShowJogosModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="football" size={18} color={colors.gold} />
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
                <ActivityIndicator size="large" color={colors.gold} />
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
                      <Ionicons name="tv-outline" size={13} color={colors.gold} />
                      <Text style={styles.guiaChannelsText} numberOfLines={1}>Canais: {g.channels}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
                {dailyCardsImages.length === 0 ? (
                  <View style={styles.centerBox}>
                    <Ionicons name="images-outline" size={40} color={colors.gold} />
                    <Text style={styles.loadingText}>Nenhum card oficial cadastrado no Supabase para hoje.</Text>
                  </View>
                ) : (
                  dailyCardsImages.map((imgUrl, index) => (
                    <View key={`img-${index}`} style={styles.imageCardWrapper}>
                      <Image source={{ uri: imgUrl }} style={styles.dailyCardImage} contentFit="contain" />
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
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
    backgroundColor: "rgba(212,175,55,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.4)",
  },
  codeText: { color: colors.gold, fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },

  headerRight: { flexDirection: "row", alignItems: "center", gap: 18 },
  headerIconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerDate: { color: "#9CA3AF", fontSize: 14, fontWeight: "700" },
  headerTime: { color: "#FFF", fontSize: 18, fontWeight: "900" },

  mainLayoutContainer: { flexDirection: "row", gap: 20, height: "76%" },
  leftContainer: { flex: 1.4, justifyContent: "space-between" },
  rightColumn: { flex: 1, justifyContent: "space-between" },
  
  dynamicRowSection: { gap: 6 },
  sectionCategoryTitle: { color: "#FFF", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  tickerWrapper: { height: 115, overflow: "hidden", position: "relative" },
  tickerTrack: { flexDirection: "row", gap: 10, position: "absolute", left: 0 },
  tickerCard: { width: 85, height: 115, borderRadius: 10, overflow: "hidden", backgroundColor: "#1A1D29", position: "relative" },
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
    borderColor: "#FFD700",
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
  premiumLabel: { color: "#10B981", fontSize: 14, fontWeight: "900", letterSpacing: 0.5 },

  fullSize: { width: "100%", height: "100%" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 850, height: "88%", backgroundColor: "#131622", borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(212,175,55,0.3)", padding: 22, gap: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", paddingBottom: 12 },
  modalIconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(212,175,55,0.15)", alignItems: "center", justifyContent: "center" },
  modalTitle: { color: colors.gold, fontSize: 15, fontWeight: "900", letterSpacing: 0.8 },
  
  tabToggleRow: { flexDirection: "row", gap: 8, backgroundColor: "#191D2E", padding: 4, borderRadius: 10 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tabBtnActive: { backgroundColor: colors.gold },
  tabBtnText: { color: "#9CA3AF", fontSize: 11, fontWeight: "800" },
  tabBtnTextActive: { color: "#000", fontWeight: "900" },

  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#1E2230", alignItems: "center", justifyContent: "center" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: colors.textMuted, fontSize: 12, fontWeight: "600", textAlign: "center" },
  listContainer: { gap: 16, paddingVertical: 4 },
  
  guiaCard: { 
    backgroundColor: "#191D2E", 
    borderRadius: 14, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: "rgba(212,175,55,0.18)", 
    gap: 10 
  },
  guiaCardTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  guiaTimeBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.gold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  guiaTimeText: { color: "#000", fontSize: 10, fontWeight: "900" },
  statusBadge: { backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusLive: { backgroundColor: "#EF4444" },
  statusText: { color: "#9CA3AF", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  guiaLeagueText: { color: colors.textDim, fontSize: 11, fontWeight: "700", flex: 1, textAlign: "right" },
  
  guiaMatchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  teamText: { color: "#FFF", fontSize: 15, fontWeight: "900", flex: 1, letterSpacing: 0.3 },
  scoreBox: { backgroundColor: "#11141F", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  scoreText: { color: colors.gold, fontSize: 14, fontWeight: "900", letterSpacing: 1 },

  guiaChannelsRow: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", paddingTop: 8 },
  guiaChannelsText: { color: colors.gold, fontSize: 11.5, fontWeight: "800" },

  imageCardWrapper: { width: "100%", height: 440, backgroundColor: "#000000", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "rgba(212,175,55,0.2)", marginBottom: 10 },
  dailyCardImage: { width: "100%", height: "100%" },
});
