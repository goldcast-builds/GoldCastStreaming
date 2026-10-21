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
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TrendingMarquee, MarqueeItem } from "../../src/components/TrendingMarquee";
import { colors, radius, spacing } from "../../src/utils/theme";
import { listLists } from "../../src/utils/api";
import { PlayItem, useSession } from "../../src/store/session";
import { xtream, LiveStream, Category } from "../../src/services/xtream";
import { liveUrls } from "../../src/services/xtream";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface UserProfile {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: "normal" | "kids" | "adult" | "football";
}

interface GuiaMatch {
  id: string;
  time: string;
  league: string;
  match: string;
  channels: string;
}

const SOPHISTICATED_AVATARS = [
  { icon: "film-outline", color: "#E50914", label: "Cinema" },
  { icon: "football-outline", color: "#10B981", label: "Futebol" },
  { icon: "rocket-outline", color: "#1E88E5", label: "Espaço" },
  { icon: "game-controller-outline", color: "#6A1B9A", label: "Gamer" },
  { icon: "sparkles-outline", color: "#0284C7", label: "Kids" },
  { icon: "heart-outline", color: "#D81B60", label: "Família" },
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
  const logout = useSession((s) => s.logout);
  const setQueue = useSession((s) => s.setQueue);
  const liveFormat = useSession((s) => s.prefs.liveFormat);

  const [hasLists, setHasLists] = useState(false);
  const [kidsChannels, setKidsChannels] = useState<LiveStream[]>([]);
  const [activationCode, setActivationCode] = useState<string>("LICENÇA ATIVA");
  const [guiaJogos, setGuiaJogos] = useState<GuiaMatch[]>([]);
  const [loadingGuia, setLoadingGuia] = useState(false);

  // Navegação lateral interna da área Kids
  const [kidsTab, setKidsTab] = useState<"home" | "live" | "movies" | "series">("home");

  // Perfis isolados
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [newProfileName, setNewProfileName] = useState("");
  const [selectedAvatarIdx, setSelectedAvatarIdx] = useState(0);
  const [newProfileType, setNewProfileType] = useState<"normal" | "kids" | "adult" | "football">("normal");

  const [adultPin, setAdultPin] = useState("0000");
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pendingItemToOpen, setPendingItemToOpen] = useState<any>(null);

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showParentalModal, setShowParentalModal] = useState(false);
  const [newCustomPin, setNewCustomPin] = useState("");
  const [adultLocked, setAdultLocked] = useState(true);

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
      name: username || "Principal",
      color: "#E50914",
      icon: "film-outline",
      type: "normal",
    };
  }, [activeProfile, profiles, username]);

  const themeStyles = useMemo(() => {
    if (currentProfile.type === "kids") {
      return { bg: "#0D1B2A", accent: "#38BDF8", cardBg: "#1B2A4A", sidebarBg: "#070E17", highlight: "#F59E0B" };
    }
    if (currentProfile.type === "adult") {
      return { bg: "#140808", accent: "#EF4444", cardBg: "#1F1111", sidebarBg: "#0B0404", highlight: "#EF4444" };
    }
    if (currentProfile.type === "football") {
      return { bg: "#041C0F", accent: "#10B981", cardBg: "#0D2E1A", sidebarBg: "#02120A", highlight: "#10B981" };
    }
    return { bg: colors.bg, accent: colors.gold, cardBg: colors.surface, sidebarBg: "#12141C", highlight: colors.gold };
  }, [currentProfile.type]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      AsyncStorage.getItem("@goldcast_saved_code").then((code) => { if (code && isMounted) setActivationCode(code); });
      AsyncStorage.getItem("@goldcast_adult_pin").then((val) => { if (val && isMounted) setAdultPin(val); });
      AsyncStorage.getItem("@goldcast_adult_locked").then((val) => { if (val !== null && isMounted) setAdultLocked(val === "true"); });

      Promise.all([
        AsyncStorage.getItem("@goldcast_profiles"),
        AsyncStorage.getItem("@goldcast_active_profile"),
      ]).then(([rawProfiles, rawActive]) => {
        if (!isMounted) return;
        let loadedProfiles: UserProfile[] = [];
        if (rawProfiles) {
          try {
            const parsed = JSON.parse(rawProfiles);
            if (Array.isArray(parsed)) loadedProfiles = parsed;
          } catch {}
        }

        if (loadedProfiles.length === 0) {
          loadedProfiles = [{ id: `p_${Date.now()}`, name: username || "Principal", color: "#E50914", icon: "film-outline", type: "normal" }];
          AsyncStorage.setItem("@goldcast_profiles", JSON.stringify(loadedProfiles));
        }

        setProfiles(loadedProfiles);
        if (rawActive) {
          try { setActiveProfile(JSON.parse(rawActive)); } catch { setActiveProfile(loadedProfiles[0]); }
        } else {
          setActiveProfile(loadedProfiles[0]);
        }
      });

      listLists().then((l) => { if (isMounted) setHasLists(l.length > 0); }).catch(() => {});
      if (session) {
        if (loadVod) loadVod().catch(() => {});
        if (loadSeries) loadSeries().catch(() => {});
      }
      return () => { isMounted = false; };
    }, [session, loadVod, loadSeries, username])
  );

  const handleSelectProfile = async (p: UserProfile) => {
    setActiveProfile(p);
    setShowProfileSheet(false);
    setEditMode(false);
    await AsyncStorage.setItem("@goldcast_active_profile", JSON.stringify(p));
  };

  const isAdultContent = (name: string, categoryName: string = "") => {
    const text = (name + " " + categoryName).toLowerCase();
    return /adult|xxx|\+18|18\+|private|sensual|erot|sex|playboy|venus|hot|seventeen|privates|corra|baby/i.test(text);
  };

  const isKidsContent = (name: string, categoryName: string = "") => {
    const text = (name + " " + categoryName).toLowerCase();
    if (isAdultContent(name, categoryName)) return false;
    return /infantil|kids|anima|desenho|disney|pixar|cartoon|turma|peppa|patrulha|barbie|lego|baby|nickelodeon|turma da mônica|galinha pintadinha|patrulha canina|ben 10|frozen|princesa|sonic|pokemon|minions|super onze|dragon ball|naruto|one piece|descencanto|108|patrulha pata|masha|blaze|panda/i.test(text);
  };

  // Carregar todos os canais infantis sem cortes
  useEffect(() => {
    if (!session) return;
    let active = true;
    (async () => {
      try {
        const categories: Category[] = await xtream.liveCategories(session);
        const catKids = categories.find((c) => /infantil|kids|desenho/i.test(c.category_name));
        if (catKids) {
          const streams: LiveStream[] = await xtream.liveStreams(session, catKids.category_id);
          if (active && streams.length > 0) setKidsChannels(streams);
        }
      } catch {}
    })();
    return () => { active = false; };
  }, [session]);

  const kidsMoviesList = useMemo(() => {
    if (!catalog.vod?.length) return [];
    return catalog.vod.filter((v) => {
      if (!v.stream_icon) return false;
      const name = v.name || "";
      const cat = v.category_name || "";
      if (isAdultContent(name, cat)) return false;
      return isKidsContent(name, cat);
    });
  }, [catalog.vod]);

  const kidsSeriesList = useMemo(() => {
    if (!catalog.series?.length) return [];
    return catalog.series.filter((s) => {
      const name = s.name || "";
      const cat = s.category_name || "";
      if (isAdultContent(name, cat)) return false;
      return isKidsContent(name, cat);
    });
  }, [catalog.series]);

  // Função para abrir o player de canal ao vivo diretamente
  const handlePlayLiveChannel = (ch: LiveStream, index: number) => {
    if (session && source?.kind !== "list") setSource({ kind: "xtream" });
    const urls = liveUrls(session, ch.stream_id, liveFormat === "auto" ? undefined : liveFormat);

    const items: PlayItem[] = kidsChannels.map((c) => ({
      kind: "live",
      id: String(c.stream_id),
      title: c.name,
      subtitle: "Infantil",
      logo: c.stream_icon,
      urls: liveUrls(session, c.stream_id, liveFormat === "auto" ? undefined : liveFormat),
      streamId: c.stream_id,
      raw: c,
    }));
    setQueue(items, index);

    router.push({
      pathname: "/player",
      params: {
        url: urls?.[0] || "",
        streamUrl: urls?.[0] || "",
        title: ch.name || "Canal Infantil",
        name: ch.name || "",
        id: String(ch.stream_id),
        stream_id: String(ch.stream_id),
        type: "live",
      },
    });
  };

  const go = async (path: string) => {
    if (session && source?.kind !== "list") await setSource({ kind: "xtream" });
    router.push(path as any);
  };

  return (
    <View style={[styles.root, { backgroundColor: themeStyles.bg }]}>
      {currentProfile.type === "kids" ? (
        <View style={styles.kidsRoot}>
          {/* MENU LATERAL ESQUERDO FIXO */}
          <View style={[styles.sidebar, { backgroundColor: themeStyles.sidebarBg }]}>
            <Pressable onPress={() => setKidsTab("home")} style={[styles.sidebarIconBtn, kidsTab === "home" && styles.sidebarTabActive]} focusable={true}>
              <Ionicons name="home" size={22} color={kidsTab === "home" ? "#38BDF8" : "#FFF"} />
            </Pressable>

            <Pressable onPress={() => setKidsTab("live")} style={[styles.sidebarIconBtn, kidsTab === "live" && styles.sidebarTabActive]} focusable={true}>
              <Ionicons name="tv" size={22} color={kidsTab === "live" ? "#38BDF8" : "#FFF"} />
            </Pressable>

            <Pressable onPress={() => setKidsTab("movies")} style={[styles.sidebarIconBtn, kidsTab === "movies" && styles.sidebarTabActive]} focusable={true}>
              <Ionicons name="film" size={22} color={kidsTab === "movies" ? "#38BDF8" : "#FFF"} />
            </Pressable>

            <Pressable onPress={() => setKidsTab("series")} style={[styles.sidebarIconBtn, kidsTab === "series" && styles.sidebarTabActive]} focusable={true}>
              <Ionicons name="albums" size={22} color={kidsTab === "series" ? "#38BDF8" : "#FFF"} />
            </Pressable>

            <Pressable onPress={() => setShowProfileSheet(true)} style={[styles.sidebarProfileBox, { borderColor: currentProfile.color }]} focusable={true}>
              <Ionicons name={currentProfile.icon as any} size={20} color="#FFF" />
              <Text style={styles.sidebarProfileName} numberOfLines={1}>{currentProfile.name}</Text>
            </Pressable>

            <View style={{ flex: 1 }} />

            <Pressable onPress={() => router.replace("/login")} style={styles.sidebarExitBtn} focusable={true}>
              <Ionicons name="exit-outline" size={18} color="#EF4444" />
              <Text style={styles.sidebarExitText}>SAIR</Text>
            </Pressable>
          </View>

          {/* ÁREA PRINCIPAL DA DIREITA */}
          <View style={styles.kidsMainContent}>
            <View style={styles.kidsTopBar}>
              <Text style={styles.kidsHeaderTitle}>🌟 ESPAÇO MÁGICO INFANTIL</Text>
              <Pressable onPress={() => router.push("/(tabs)/settings")} style={styles.kidsSettingsBtn}>
                <Ionicons name="settings-outline" size={20} color={themeStyles.accent} />
              </Pressable>
            </View>

            {/* ABA HOME */}
            {kidsTab === "home" && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
                <View style={{ gap: 10 }}>
                  <Text style={styles.kidsSectionLabel}>🎬 CATÁLOGO COMPLETO DE FILMES INFANTIS</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kidsPostersRow}>
                    {kidsMoviesList.map((item, idx) => {
                      const cardColors = ["#3B82F6", "#EAB308", "#EC4899", "#10B981", "#8B5CF6", "#F97316"];
                      const themeCol = cardColors[idx % cardColors.length];
                      return (
                        <Pressable
                          key={item.stream_id}
                          focusable={true}
                          onPress={() => router.push({ pathname: "/movie/[id]", params: { id: String(item.stream_id) } })}
                          style={[styles.kidsVerticalPosterCard, { backgroundColor: themeCol }]}
                        >
                          <Image source={{ uri: item.stream_icon }} style={styles.fullSize} contentFit="cover" />
                          <View style={styles.kidsPosterGradient}>
                            <Text style={styles.kidsPosterTitle} numberOfLines={2}>{item.name}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={styles.kidsAgoraNaTvBox}>
                  <Text style={styles.kidsSectionLabel}>📺 CANAIS INFANTIS (24H)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {kidsChannels.map((ch, idx) => (
                      <Pressable
                        key={ch.stream_id}
                        focusable={true}
                        onPress={() => handlePlayLiveChannel(ch, idx)}
                        style={styles.kidsLiveThumbCard}
                      >
                        {ch.stream_icon ? (
                          <Image source={{ uri: ch.stream_icon }} style={styles.fullSize} contentFit="contain" />
                        ) : (
                          <Ionicons name="tv" size={28} color="#FFF" />
                        )}
                        <View style={styles.liveTagBadge}><Text style={styles.liveTagText}>AO VIVO</Text></View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </ScrollView>
            )}

            {/* ABA CANAIS AO VIVO (EXIBE TODOS OS CANAIS E INICIA DIRETO AO CLICAR) */}
            {kidsTab === "live" && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
                <Text style={styles.kidsSectionLabel}>📺 TODOS OS CANAIS INFANTIS AO VIVO</Text>
                <View style={styles.kidsGridContainer}>
                  {kidsChannels.map((ch, idx) => (
                    <Pressable
                      key={ch.stream_id}
                      focusable={true}
                      onPress={() => handlePlayLiveChannel(ch, idx)}
                      style={styles.kidsGridCard}
                    >
                      {ch.stream_icon ? (
                        <Image source={{ uri: ch.stream_icon }} style={styles.fullSize} contentFit="contain" />
                      ) : (
                        <Ionicons name="tv" size={32} color="#38BDF8" />
                      )}
                      <Text style={styles.gridCardTitle} numberOfLines={1}>{ch.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* ABA FILMES (TODOS OS FILMES) */}
            {kidsTab === "movies" && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
                <Text style={styles.kidsSectionLabel}>🎬 TODOS OS FILMES INFANTIS</Text>
                <View style={styles.kidsGridContainer}>
                  {kidsMoviesList.map((item) => (
                    <Pressable
                      key={item.stream_id}
                      focusable={true}
                      onPress={() => router.push({ pathname: "/movie/[id]", params: { id: String(item.stream_id) } })}
                      style={styles.kidsGridMovieCard}
                    >
                      <Image source={{ uri: item.stream_icon }} style={styles.fullSize} contentFit="cover" />
                      <View style={styles.kidsPosterGradient}>
                        <Text style={styles.kidsPosterTitle} numberOfLines={1}>{item.name}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* ABA SÉRIES (TODAS AS SÉRIES) */}
            {kidsTab === "series" && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
                <Text style={styles.kidsSectionLabel}>🍿 TODAS AS SÉRIES & ANIMES</Text>
                <View style={styles.kidsGridContainer}>
                  {kidsSeriesList.map((s) => (
                    <Pressable
                      key={s.series_id}
                      focusable={true}
                      onPress={() => router.push({ pathname: "/series/[id]", params: { id: String(s.series_id) } })}
                      style={styles.kidsGridMovieCard}
                    >
                      <Image source={{ uri: s.cover }} style={styles.fullSize} contentFit="cover" />
                      <View style={styles.kidsPosterGradient}>
                        <Text style={styles.kidsPosterTitle} numberOfLines={1}>{s.name}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      ) : (
        /* LAYOUT PADRÃO PARA OUTROS PERFIS */
        <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
          <View style={styles.mainContainer}>
            <View style={styles.rowBetween}>
              <View style={{ gap: 2 }}>
                <Text style={styles.sectionHeader}>GOLDCAST STREAMING</Text>
                <View style={styles.rowAlign}>
                  <Pressable onPress={() => setShowProfileSheet(true)} style={[styles.profileTopChip, { borderColor: currentProfile.color }]}>
                    <Ionicons name={currentProfile.icon as any} size={16} color={currentProfile.color} />
                    <Text style={styles.profileTopName} numberOfLines={1}>{currentProfile.name}</Text>
                    <Ionicons name="chevron-down" size={12} color={colors.textDim} />
                  </Pressable>
                </View>
              </View>

              <Pressable focusable={true} onPress={() => router.push("/(tabs)/settings")} style={styles.accountIconBtn}>
                <Ionicons name="settings-outline" size={22} color={colors.gold} />
              </Pressable>
            </View>

            <View style={styles.gridNav}>
              <Pressable focusable={true} onPress={() => go("/(tabs)/live")} style={styles.navCard}>
                <View style={styles.navCardIconBox}><Ionicons name="tv" size={26} color={colors.gold} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.navCardTitle}>TV AO VIVO</Text>
                  <Text style={styles.navCardSub}>Canais em tempo real</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}

      {/* MODAL DE PERFIS */}
      <Modal visible={showProfileSheet} animationType="slide" transparent={true}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Quem está assistindo?</Text>
              <Pressable onPress={() => setShowProfileSheet(false)} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={20} color="#FFF" />
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetProfilesRow}>
              {profiles.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => handleSelectProfile(p)}
                  style={styles.sheetProfileMiniItem}
                >
                  <View style={[styles.sheetMiniAvatar, { backgroundColor: p.color, borderWidth: currentProfile.id === p.id ? 3 : 0, borderColor: "#FFF" }]}>
                    <Ionicons name={p.icon as any} size={28} color="#FFF" />
                    {p.type === "kids" && <View style={styles.kidsTagBadge}><Text style={styles.kidsTagText}>KIDS</Text></View>}
                  </View>
                  <Text style={styles.sheetMiniName} numberOfLines={1}>{p.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kidsRoot: { flex: 1, flexDirection: "row" },
  sidebar: { width: 76, paddingVertical: 20, alignItems: "center", justifyContent: "flex-start", gap: 16, borderRightWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  sidebarIconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  sidebarTabActive: { backgroundColor: "#38BDF8", borderWidth: 2, borderColor: "#FFF" },
  sidebarProfileBox: { width: 50, height: 50, borderRadius: 16, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center", borderWidth: 2, gap: 2, marginTop: 10 },
  sidebarProfileName: { color: "#FFF", fontSize: 8, fontWeight: "700" },
  sidebarExitBtn: { alignItems: "center", gap: 2, paddingBottom: 10 },
  sidebarExitText: { color: "#EF4444", fontSize: 9, fontWeight: "900" },

  kidsMainContent: { flex: 1, paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  kidsTopBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kidsHeaderTitle: { color: "#38BDF8", fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
  kidsSettingsBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  kidsSectionLabel: { color: "#94A3B8", fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  kidsPostersRow: { gap: 14, paddingVertical: 4 },
  kidsVerticalPosterCard: { width: 130, height: 195, borderRadius: 16, overflow: "hidden", position: "relative", elevation: 6 },
  kidsPosterGradient: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.8)", padding: 8 },
  kidsPosterTitle: { color: "#FFF", fontSize: 11, fontWeight: "900" },

  kidsAgoraNaTvBox: { gap: 8, marginTop: 2 },
  kidsLiveThumbCard: { width: 110, height: 70, borderRadius: 12, backgroundColor: "#1E293B", overflow: "hidden", position: "relative", alignItems: "center", justifyContent: "center" },
  liveTagBadge: { position: "absolute", top: 4, left: 4, backgroundColor: "#EF4444", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  liveTagText: { color: "#FFF", fontSize: 7, fontWeight: "900" },

  kidsGridContainer: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  kidsGridCard: { width: 110, height: 85, borderRadius: 12, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center", padding: 6, gap: 4 },
  gridCardTitle: { color: "#FFF", fontSize: 10, fontWeight: "700", textAlign: "center" },
  kidsGridMovieCard: { width: 110, height: 160, borderRadius: 12, overflow: "hidden", position: "relative" },

  mainContainer: { gap: spacing.lg, paddingHorizontal: spacing.lg },
  sectionHeader: { color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  profileTopChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, borderWidth: 1.5 },
  profileTopName: { color: "#FFF", fontSize: 13, fontWeight: "800", maxWidth: 110 },
  accountIconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowAlign: { flexDirection: "row", alignItems: "center" },
  gridNav: { gap: 12 },
  navCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, borderColor: colors.border, gap: 14 },
  navCardIconBox: { width: 48, height: 48, borderRadius: 10, backgroundColor: "rgba(229, 169, 59, 0.12)", alignItems: "center", justifyContent: "center" },
  navCardTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  navCardSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
  fullSize: { width: "100%", height: "100%" },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheetContainer: { backgroundColor: "#181818", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, gap: 14 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: "#4B5563", alignSelf: "center" },
  sheetHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  sheetCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#2B2B2B", alignItems: "center", justifyContent: "center" },
  sheetProfilesRow: { gap: 14, paddingVertical: 10 },
  sheetProfileMiniItem: { alignItems: "center", gap: 6, width: 72 },
  sheetMiniAvatar: { width: 64, height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center", position: "relative" },
  sheetMiniName: { color: "#E5E7EB", fontSize: 11, fontWeight: "600" },
  kidsTagBadge: { position: "absolute", bottom: 2, right: 2, backgroundColor: "#1E88E5", paddingHorizontal: 3, paddingVertical: 1, borderRadius: 3 },
  kidsTagText: { color: "#FFF", fontSize: 7, fontWeight: "900" },
});
