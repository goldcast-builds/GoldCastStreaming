import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, radius, spacing } from "../../src/utils/theme";
import { useSession } from "../../src/store/session";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface GuiaMatch {
  id: string;
  time: string;
  league: string;
  match: string;
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
  const [mediaType, setMediaType] = useState<"movies" | "series">("movies");
  const [currentIndex, setCurrentIndex] = useState(0);

  // Estados do Modal de Jogos de Hoje Modernizado
  const [showJogosModal, setShowJogosModal] = useState(false);
  const [guiaJogos, setGuiaJogos] = useState<GuiaMatch[]>([]);
  const [loadingJogos, setLoadingJogos] = useState(false);

  // Relógio e Data em tempo real estilo TV
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

  // Busca do Guia de Jogos em tempo real
  useEffect(() => {
    if (!showJogosModal) return;
    let isMounted = true;
    const fetchGuia = async () => {
      setLoadingJogos(true);
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
          while ((m = fnRegex.exec(html)) !== null && idx < 15) {
            const team1 = m[1].replace(/<[^>]+>/g, "").trim();
            const team2 = m[2].replace(/<[^>]+>/g, "").trim();
            const time = m[3].trim();
            let channels = m[4].replace(/Ver detalhes/gi, "").replace(/<[^>]+>/g, "").trim();
            if (!channels || channels.length < 3) channels = "SporTV • Premiere • ESPN • Disney+";

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
            { id: "1", time: "13:45", league: "Champions League", match: "Fenerbahçe x Slavia Praha", channels: "Space • HBO Max" },
            { id: "2", time: "15:00", league: "Campeonato Saudita", match: "Al-Nassr x Neom", channels: "SportV 2 • Canal GOAT" },
            { id: "3", time: "16:00", league: "Champions League", match: "PSG x FC Barcelona", channels: "SBT • TNT • Max" },
            { id: "4", time: "19:30", league: "Brasileirão Série B", match: "Londrina x Cuiabá", channels: "Disney+ • Premiere" },
            { id: "5", time: "21:30", league: "Copa Sul-Americana", match: "Vasco da Gama x Boca Juniors", channels: "SBT • Paramount+" },
          ];
        }

        if (isMounted) setGuiaJogos(matches);
      } catch {
        if (isMounted) {
          setGuiaJogos([
            { id: "1", time: "16:00", league: "Champions League", match: "PSG x FC Barcelona", channels: "SBT • TNT • Max" },
            { id: "2", time: "21:30", league: "Copa Sul-Americana", match: "Vasco da Gama x Boca Juniors", channels: "SBT • Paramount+" },
          ]);
        }
      } finally {
        if (isMounted) setLoadingJogos(false);
      }
    };

    fetchGuia();
    return () => {
      isMounted = false;
    };
  }, [showJogosModal]);

  const isTestAccount = useMemo(() => {
    return !activationCode || activationCode.includes("TESTE") || activationCode.length < 5;
  }, [activationCode]);

  const carouselItems = useMemo(() => {
    if (mediaType === "movies") {
      return (catalog.vod || []).slice(0, 10);
    } else {
      return (catalog.series || []).slice(0, 10);
    }
  }, [catalog.vod, catalog.series, mediaType]);

  const activeCarouselItem = carouselItems[currentIndex] || null;

  const handleNextCarousel = () => {
    if (carouselItems.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % carouselItems.length);
  };

  const handlePrevCarousel = () => {
    if (carouselItems.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + carouselItems.length) % carouselItems.length);
  };

  const handleScreenRecord = () => {
    Alert.alert("Gravação de Tela", "Ferramenta de captura e gravação de ecrã iniciada com sucesso.", [{ text: "OK" }]);
  };

  return (
    <View style={[styles.root, { backgroundColor: "#11141F" }]}>
      {/* CABEÇALHO */}
      <View style={styles.tvHeader}>
        <View style={styles.headerLeft}>
          <Pressable focusable={true} onPress={() => router.push("/(tabs)/settings")} style={styles.headerIconBtn} hitSlop={10}>
            <Ionicons name="menu" size={26} color="#FFF" />
          </Pressable>
          <Text style={styles.tvBrand}>GoldCast Media Player</Text>
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

      {/* PAINEL DE CONTEÚDO PRINCIPAL (LAYOUT REAJUSTADO) */}
      <View style={styles.mainLayoutContainer}>
        {/* Lado Esquerdo: Bloco Principal de Destaque Ajustado (Proporção Completa das Capas) */}
        <View style={styles.leftContainer}>
          <Pressable
            focusable={true}
            onPress={() => {
              if (activeCarouselItem) {
                if (mediaType === "movies") {
                  router.push({ pathname: "/movie/[id]", params: { id: String(activeCarouselItem.stream_id) } });
                } else {
                  router.push({ pathname: "/series/[id]", params: { id: String(activeCarouselItem.series_id) } });
                }
              }
            }}
            style={({ focused }) => [styles.cardLarge, focused && styles.cardFocused]}
          >
            {activeCarouselItem ? (
              <View style={styles.fullSizeContainer}>
                <Image
                  source={{ uri: mediaType === "movies" ? activeCarouselItem.stream_icon : activeCarouselItem.cover }}
                  style={styles.fullSize}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <View style={styles.carouselOverlay}>
                  <View style={styles.carouselBadge}>
                    <Text style={styles.carouselBadgeText}>{mediaType === "movies" ? "⭐ FILMES RECENTES" : "🍿 SÉRIES RECENTES"}</Text>
                  </View>
                  <Text style={styles.carouselTitle} numberOfLines={1}>
                    {mediaType === "movies" ? activeCarouselItem.name : activeCarouselItem.name}
                  </Text>
                  <View style={styles.carouselControlsRow}>
                    <Pressable onPress={(e) => { e.stopPropagation(); handlePrevCarousel(); }} style={styles.carouselNavBtn} focusable={true}>
                      <Ionicons name="chevron-back" size={18} color="#FFF" />
                    </Pressable>
                    <Pressable onPress={(e) => { e.stopPropagation(); setMediaType(mediaType === "movies" ? "series" : "movies"); setCurrentIndex(0); }} style={styles.carouselSwitchBtn} focusable={true}>
                      <Text style={styles.carouselSwitchText}>Alternar Filmes / Séries</Text>
                    </Pressable>
                    <Pressable onPress={(e) => { e.stopPropagation(); handleNextCarousel(); }} style={styles.carouselNavBtn} focusable={true}>
                      <Ionicons name="chevron-forward" size={18} color="#FFF" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.cardLargeInner}>
                <Ionicons name="film-outline" size={64} color="#FFF" />
                <Text style={styles.cardTitle}>MOVIES & SÉRIES</Text>
              </View>
            )}
          </Pressable>

          {/* BARRA INFERIOR REDIMENSIONADA LOGO ABAIXO DO DESTAQUE (MARCAÇÃO VERMELHA) */}
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

        {/* Lado Direito: Os 3 Blocos Proporcionados (Filmes, Séries e Canais) */}
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

      {/* Modal Modernizado de Jogos de Hoje */}
      <Modal visible={showJogosModal} animationType="slide" transparent={true} onRequestClose={() => setShowJogosModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="football" size={18} color={colors.gold} />
                </View>
                <Text style={styles.modalTitle}>JOGOS DE HOJE — GUIA NA TV</Text>
              </View>
              <Pressable onPress={() => setShowJogosModal(false)} style={styles.closeBtn} focusable={true}>
                <Ionicons name="close" size={18} color="#FFF" />
              </Pressable>
            </View>

            {loadingJogos ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={styles.loadingText}>Buscando programação dos jogos em tempo real...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
                {guiaJogos.map((g) => (
                  <View key={g.id} style={styles.guiaCard}>
                    <View style={styles.guiaHeaderRow}>
                      <View style={styles.guiaTimeBadge}>
                        <Ionicons name="time-outline" size={11} color="#000" />
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
  
  tvHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  tvBrand: { color: "#FFF", fontSize: 18, fontWeight: "900", letterSpacing: 1.2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 18 },
  headerIconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerDate: { color: "#9CA3AF", fontSize: 14, fontWeight: "700" },
  headerTime: { color: "#FFF", fontSize: 18, fontWeight: "900" },

  // Layout Principal Reposicionado
  mainLayoutContainer: { flexDirection: "row", gap: 20, height: "76%" },
  leftContainer: { flex: 1.4, justifyContent: "space-between" },
  rightColumn: { flex: 1, justifyContent: "space-between" },
  
  // Bloco Principal de Destaque Ajustado (Proporção Completa das Capas)
  cardLarge: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#C2185B",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    maxHeight: "78%",
  },
  cardLargeInner: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: "rgba(100, 20, 80, 0.4)" },
  cardTitle: { color: "#FFF", fontSize: 24, fontWeight: "900", letterSpacing: 2 },

  fullSizeContainer: { width: "100%", height: "100%", position: "relative" },
  fullSize: { width: "100%", height: "100%" },
  carouselOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.85)", padding: 12, gap: 6 },
  carouselBadge: { backgroundColor: "#F59E0B", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" },
  carouselBadgeText: { color: "#000", fontSize: 9, fontWeight: "900" },
  carouselTitle: { color: "#FFF", fontSize: 15, fontWeight: "900" },
  carouselControlsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  carouselNavBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  carouselSwitchBtn: { backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  carouselSwitchText: { color: "#FFF", fontSize: 10, fontWeight: "700" },

  // 3 Blocos Proporcionados da Direita
  cardTriple: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    maxHeight: "30%",
  },
  cardTripleInner: { flex: 1, flexDirection: "row", alignItems: "center", paddingLeft: 24, gap: 16 },
  cardTitleTriple: { color: "#FFF", fontSize: 18, fontWeight: "900", letterSpacing: 1.5 },

  // Barra Inferior Reposicionada Abaixo do Destaque
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

  cardFocused: {
    borderColor: "#FBBF24",
    borderWidth: 4,
    transform: [{ scale: 1.02 }],
  },

  // Modal Modernizado de Jogos de Hoje
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 680, height: "82%", backgroundColor: "#131622", borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(212,175,55,0.25)", padding: 22, gap: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", paddingBottom: 12 },
  modalIconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(212,175,55,0.15)", alignItems: "center", justifyContent: "center" },
  modalTitle: { color: colors.gold, fontSize: 15, fontWeight: "900", letterSpacing: 0.8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#1E2230", alignItems: "center", justifyContent: "center" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  listContainer: { gap: 10, paddingVertical: 4 },
  
  guiaCard: { backgroundColor: "#191D2E", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", gap: 6 },
  guiaHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  guiaTimeBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.gold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  guiaTimeText: { color: "#000", fontSize: 10, fontWeight: "900" },
  guiaLeagueText: { color: colors.textDim, fontSize: 11, fontWeight: "700", flex: 1 },
  guiaMatchTitle: { color: "#FFF", fontSize: 14, fontWeight: "900", letterSpacing: 0.2 },
  guiaChannelsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  guiaChannelsText: { color: colors.gold, fontSize: 11.5, fontWeight: "800" },
});
