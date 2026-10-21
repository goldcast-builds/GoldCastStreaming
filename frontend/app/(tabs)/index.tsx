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
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, radius, spacing } from "../../src/utils/theme";
import { useSession } from "../../src/store/session";
import { xtream, LiveStream } from "../../src/services/xtream";
import { liveUrls } from "../../src/services/xtream";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface UserProfile {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: "normal" | "kids" | "adult" | "football";
}

export default function HomeTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const source = useSession((s) => s.source);
  const setSource = useSession((s) => s.setSource);
  const catalog = useSession((s) => s.catalog);
  const loadVod = useSession((s) => s.loadVod);
  const loadSeries = useSession((s) => s.loadSeries);
  const setQueue = useSession((s) => s.setQueue);
  const liveFormat = useSession((s) => s.prefs.liveFormat);

  const [cachedChannels, setCachedChannels] = useState<LiveStream[]>([]);
  const [activationCode, setActivationCode] = useState<string>("LICENÇA ATIVA");
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);

  const [adultPin, setAdultPin] = useState("0000");
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pendingItemToOpen, setPendingItemToOpen] = useState<any>(null);
  const [adultLocked, setAdultLocked] = useState(true);

  const { username, expFormatted } = useMemo(() => {
    const user = session?.userInfo?.username || session?.username || "Cliente";
    const exp = session?.userInfo?.exp_date;
    if (!exp) return { username: user, expFormatted: "Ilimitado" };
    const ts = Number(exp);
    if (!ts || isNaN(ts)) return { username: user, expFormatted: "Indisponível" };
    const expDate = new Date(ts * 1000);
    const expFormatted = expDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    });
    return { username: user, expFormatted };
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
      return { bg: "#0C1B2A", accent: "#38BDF8", cardBg: "#172A45", sidebarBg: "#070E17", title: "ESPAÇO MÁGICO INFANTIL" };
    }
    if (currentProfile.type === "adult") {
      return { bg: "#140808", accent: "#EF4444", cardBg: "#1F1111", sidebarBg: "#0B0404", title: "ÁREA ADULTA EXCLUSIVA (+18)" };
    }
    if (currentProfile.type === "football") {
      return { bg: "#041C0F", accent: "#10B981", cardBg: "#0D2E1A", sidebarBg: "#02120A", title: "CENTRAL DE FUTEBOL & ESPORTES" };
    }
    return { bg: colors.bg, accent: colors.gold, cardBg: colors.surface, sidebarBg: "#12141C", title: "GOLDCAST STREAMING" };
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
    await AsyncStorage.setItem("@goldcast_active_profile", JSON.stringify(p));
  };

  const isAdultContent = (name: string, categoryName: string = "") => {
    const text = (name + " " + categoryName).toLowerCase();
    return /adult|xxx|\+18|18\+|private|sensual|erot|sex|playboy|venus|hot|seventeen|privates/i.test(text);
  };

  const isKidsContent = (name: string, categoryName: string = "") => {
    const text = (name + " " + categoryName).toLowerCase();
    if (isAdultContent(name, categoryName)) return false;
    return /infantil|kids|anima|desenho|disney|pixar|cartoon|turma|peppa|patrulha|barbie|lego|baby|nickelodeon|turma da mônica|galinha pintadinha|patrulha canina|ben 10|frozen|princesa|sonic|pokemon|minions|super onze|dragon ball|naruto|one piece/i.test(text);
  };

  const isFootballContent = (name: string, categoryName: string = "") => {
    const text = (name + " " + categoryName).toLowerCase();
    return /futebol|brasileirão|copa|libertadores|champions|premier|esporte|sportv|premiere|espn|cazé|combate|band sports|nfl|nba|ppv|jogos/i.test(text);
  };

  useEffect(() => {
    if (!session) return;
    let active = true;
    (async () => {
      try {
        const streams: LiveStream[] = await xtream.liveStreams(session);
        if (active && streams.length > 0) setCachedChannels(streams);
      } catch {}
    })();
    return () => { active = false; };
  }, [session]);

  const filteredMovies = useMemo(() => {
    if (!catalog.vod?.length) return [];
    return catalog.vod.filter((v) => {
      if (!v.stream_icon) return false;
      const name = v.name || "";
      const cat = v.category_name || "";
      if (currentProfile.type === "kids") return isKidsContent(name, cat);
      if (currentProfile.type === "adult") return isAdultContent(name, cat);
      if (currentProfile.type === "football") return false;
      if (adultLocked && isAdultContent(name, cat)) return false;
      return true;
    });
  }, [catalog.vod, currentProfile.type, adultLocked]);

  const filteredSeries = useMemo(() => {
    if (!catalog.series?.length) return [];
    return catalog.series.filter((s) => {
      if (!s.cover) return false;
      const name = s.name || "";
      const cat = s.category_name || "";
      if (currentProfile.type === "kids") return isKidsContent(name, cat);
      if (currentProfile.type === "adult") return isAdultContent(name, cat);
      if (currentProfile.type === "football") return false;
      if (adultLocked && isAdultContent(name, cat)) return false;
      return true;
    });
  }, [catalog.series, currentProfile.type, adultLocked]);

  const filteredChannels = useMemo(() => {
    return cachedChannels.filter((ch) => {
      const name = ch.name || "";
      if (currentProfile.type === "kids") return isKidsContent(name);
      if (currentProfile.type === "adult") return isAdultContent(name);
      if (currentProfile.type === "football") return isFootballContent(name);
      if (adultLocked && isAdultContent(name)) return false;
      return true;
    });
  }, [cachedChannels, currentProfile.type, adultLocked]);

  const handlePlayLiveChannel = (ch: LiveStream, index: number) => {
    if (session && source?.kind !== "list") setSource({ kind: "xtream" });
    const urls = liveUrls(session, ch.stream_id, liveFormat === "auto" ? undefined : liveFormat);

    const items: PlayItem[] = filteredChannels.map((c) => ({
      kind: "live",
      id: String(c.stream_id),
      title: c.name,
      subtitle: currentProfile.type,
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
        title: ch.name || "Canal",
        name: ch.name || "",
        id: String(ch.stream_id),
        stream_id: String(ch.stream_id),
        type: "live",
      },
    });
  };

  const handleOpenItemWithCheck = (action: () => void, isAdult: boolean) => {
    if (adultLocked && currentProfile.type !== "adult" && isAdult) {
      setPendingItemToOpen(() => action);
      setEnteredPin("");
      setShowPinModal(true);
    } else {
      action();
    }
  };

  const verifyPinAndOpen = () => {
    if (enteredPin === adultPin) {
      setShowPinModal(false);
      setEnteredPin("");
      if (pendingItemToOpen) {
        pendingItemToOpen();
        setPendingItemToOpen(null);
      }
    } else {
      Alert.alert("Senha incorreta", "A senha padrão é 0000.");
      setEnteredPin("");
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: themeStyles.bg }]}>
      <View style={styles.layoutRoot}>
        {/* MENU LATERAL ESQUERDO FIXO (REDIRECIONAMENTO EFICIENTE PARA AS ABAS NATIVAS) */}
        <View style={[styles.sidebar, { backgroundColor: themeStyles.sidebarBg }]}>
          <Pressable onPress={() => router.push("/(tabs)")} style={[styles.sidebarIconBtn, { backgroundColor: themeStyles.accent }]} focusable={true}>
            <Ionicons name="home" size={20} color="#FFF" />
          </Pressable>

          <Pressable onPress={() => router.push("/(tabs)/live")} style={styles.sidebarIconBtn} focusable={true}>
            <Ionicons name="tv" size={20} color="#FFF" />
          </Pressable>

          {currentProfile.type !== "football" && (
            <>
              <Pressable onPress={() => router.push("/(tabs)/movies")} style={styles.sidebarIconBtn} focusable={true}>
                <Ionicons name="film" size={20} color="#FFF" />
              </Pressable>

              <Pressable onPress={() => router.push("/(tabs)/series")} style={styles.sidebarIconBtn} focusable={true}>
                <Ionicons name="albums" size={20} color="#FFF" />
              </Pressable>
            </>
          )}

          <Pressable onPress={() => router.push("/(tabs)/live")} style={styles.sidebarIconBtn} focusable={true}>
            <Ionicons name="calendar" size={20} color="#FFF" />
          </Pressable>

          <Pressable onPress={() => setShowProfileSheet(true)} style={[styles.sidebarProfileBox, { borderColor: currentProfile.color }]} focusable={true}>
            <Ionicons name={currentProfile.icon as any} size={18} color="#FFF" />
            <Text style={styles.sidebarProfileName} numberOfLines={1}>{currentProfile.name}</Text>
          </Pressable>

          <View style={{ flex: 1 }} />

          <Pressable onPress={() => router.replace("/login")} style={styles.sidebarExitBtn} focusable={true}>
            <Ionicons name="exit-outline" size={16} color="#EF4444" />
            <Text style={styles.sidebarExitText}>SAIR</Text>
          </Pressable>
        </View>

        {/* ÁREA PRINCIPAL DA DIREITA (HOME DASHBOARD LEVE) */}
        <View style={styles.mainContent}>
          <View style={styles.topBar}>
            <View style={{ gap: 2 }}>
              <Text style={[styles.headerTitle, { color: themeStyles.accent }]}>{themeStyles.title}</Text>
              <View style={styles.rowAlign}>
                <View style={styles.userInfoBadge}>
                  <Ionicons name="person-circle" size={13} color={themeStyles.accent} />
                  <Text style={styles.userInfoText}>{username}</Text>
                </View>
                <View style={styles.userInfoBadge}>
                  <Ionicons name="key" size={12} color="#000" />
                  <Text style={[styles.userInfoText, { color: "#000", fontWeight: "900" }]}>{activationCode}</Text>
                </View>
                <View style={styles.userInfoBadge}>
                  <Ionicons name="time" size={12} color={colors.textDim} />
                  <Text style={styles.userInfoText}>Exp: {expFormatted}</Text>
                </View>
              </View>
            </View>

            <Pressable onPress={() => router.push("/(tabs)/settings")} style={styles.settingsBtn} focusable={true}>
              <Ionicons name="settings-outline" size={20} color={themeStyles.accent} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 50 }}>
            {filteredMovies.length > 0 && currentProfile.type !== "football" && (
              <Pressable
                focusable={true}
                onPress={() => handleOpenItemWithCheck(() => router.push({ pathname: "/movie/[id]", params: { id: String(filteredMovies[0].stream_id) } }), isAdultContent(filteredMovies[0].name))}
                style={styles.heroBanner}
              >
                <Image source={{ uri: filteredMovies[0].stream_icon }} style={styles.fullSize} contentFit="cover" cachePolicy="memory-disk" />
                <View style={styles.heroOverlay}>
                  <View style={[styles.heroBadge, { backgroundColor: themeStyles.accent }]}><Text style={styles.heroBadgeText}>⭐ DESTAQUE</Text></View>
                  <Text style={styles.heroTitle} numberOfLines={1}>{filteredMovies[0].name}</Text>
                </View>
              </Pressable>
            )}

            {filteredMovies.length > 0 && currentProfile.type !== "football" && (
              <View style={{ gap: 8 }}>
                <Text style={[styles.sectionLabel, { color: themeStyles.accent }]}>🎬 FILMES EM DESTAQUE (CLIQUE PARA VER TODOS NA ABA FILMES)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.postersRow}>
                  {filteredMovies.slice(0, 10).map((item) => (
                    <Pressable
                      key={item.stream_id}
                      focusable={true}
                      onPress={() => handleOpenItemWithCheck(() => router.push({ pathname: "/movie/[id]", params: { id: String(item.stream_id) } }), isAdultContent(item.name))}
                      style={styles.posterCard}
                    >
                      <Image source={{ uri: item.stream_icon }} style={styles.fullSize} contentFit="cover" cachePolicy="memory-disk" />
                      <View style={styles.posterGradient}>
                        <Text style={styles.posterTitle} numberOfLines={2}>{item.name}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {filteredSeries.length > 0 && currentProfile.type !== "football" && (
              <View style={{ gap: 8 }}>
                <Text style={[styles.sectionLabel, { color: themeStyles.accent }]}>🍿 SÉRIES RECENTES</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.postersRow}>
                  {filteredSeries.slice(0, 10).map((s) => (
                    <Pressable
                      key={s.series_id}
                      focusable={true}
                      onPress={() => handleOpenItemWithCheck(() => router.push({ pathname: "/series/[id]", params: { id: String(s.series_id) } }), isAdultContent(s.name))}
                      style={styles.posterCard}
                    >
                      <Image source={{ uri: s.cover }} style={styles.fullSize} contentFit="cover" cachePolicy="memory-disk" />
                      <View style={styles.posterGradient}>
                        <Text style={styles.posterTitle} numberOfLines={2}>{s.name}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={{ gap: 8 }}>
              <Text style={[styles.sectionLabel, { color: themeStyles.accent }]}>📺 CANAIS AO VIVO EM DESTAQUE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {filteredChannels.slice(0, 10).map((ch, idx) => (
                  <Pressable
                    key={ch.stream_id}
                    focusable={true}
                    onPress={() => handleOpenItemWithCheck(() => handlePlayLiveChannel(ch, idx), isAdultContent(ch.name))}
                    style={styles.liveThumbCard}
                  >
                    {ch.stream_icon ? (
                      <Image source={{ uri: ch.stream_icon }} style={styles.fullSize} contentFit="contain" cachePolicy="memory-disk" />
                    ) : (
                      <Ionicons name="tv" size={28} color="#FFF" />
                    )}
                    <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>AO VIVO</Text></View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </View>

      <Modal visible={showPinModal} animationType="fade" transparent={true}>
        <View style={styles.modalBg}>
          <View style={styles.pinCard}>
            <Ionicons name="lock-closed" size={36} color="#EF4444" />
            <Text style={styles.pinTitle}>Conteúdo Protegido (+18)</Text>
            <Text style={styles.pinSub}>Digite a senha PIN (padrão: 0000)</Text>
            <TextInput
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              placeholder="••••"
              placeholderTextColor="#777"
              value={enteredPin}
              onChangeText={setEnteredPin}
              style={styles.pinInput}
            />
            <View style={{ flexDirection: "row", gap: 10, width: "100%", marginTop: 10 }}>
              <Pressable onPress={() => { setShowPinModal(false); setEnteredPin(""); }} style={[styles.pinBtn, { backgroundColor: "#262936" }]}>
                <Text style={{ color: "#FFF", fontWeight: "800" }}>CANCELAR</Text>
              </Pressable>
              <Pressable onPress={verifyPinAndOpen} style={[styles.pinBtn, { backgroundColor: "#EF4444" }]}>
                <Text style={{ color: "#FFF", fontWeight: "900" }}>LIBERAR</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
                    {p.type === "adult" && <View style={styles.adultTagBadge}><Text style={styles.adultTagText}>+18</Text></View>}
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
  layoutRoot: { flex: 1, flexDirection: "row" },
  sidebar: { width: 72, paddingVertical: 18, alignItems: "center", justifyContent: "flex-start", gap: 14, borderRightWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  sidebarIconBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  sidebarProfileBox: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center", borderWidth: 2, gap: 2, marginTop: 8 },
  sidebarProfileName: { color: "#FFF", fontSize: 8, fontWeight: "700" },
  sidebarExitBtn: { alignItems: "center", gap: 2, paddingBottom: 10 },
  sidebarExitText: { color: "#EF4444", fontSize: 8, fontWeight: "900" },

  mainContent: { flex: 1, paddingHorizontal: 16, paddingTop: 14, gap: 14 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 0.6 },
  rowAlign: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  userInfoBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  userInfoText: { color: "#FFF", fontSize: 9.5, fontWeight: "700" },
  settingsBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },

  heroBanner: { width: "100%", height: 150, borderRadius: 16, overflow: "hidden", position: "relative", backgroundColor: "#1A1D29" },
  heroOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.82)", padding: 12, gap: 4 },
  heroBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" },
  heroBadgeText: { color: "#000", fontSize: 8.5, fontWeight: "900" },
  heroTitle: { color: "#FFF", fontSize: 15, fontWeight: "900" },

  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  postersRow: { gap: 12, paddingVertical: 2 },
  posterCard: { width: 120, height: 180, borderRadius: 14, overflow: "hidden", position: "relative", backgroundColor: "#1A1D29" },
  posterGradient: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.8)", padding: 6 },
  posterTitle: { color: "#FFF", fontSize: 10.5, fontWeight: "900" },

  liveThumbCard: { width: 105, height: 68, borderRadius: 10, backgroundColor: "#1E293B", overflow: "hidden", position: "relative", alignItems: "center", justifyContent: "center" },
  liveBadge: { position: "absolute", top: 3, left: 3, backgroundColor: "#EF4444", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  liveBadgeText: { color: "#FFF", fontSize: 6.5, fontWeight: "900" },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 20 },
  pinCard: { width: "100%", maxWidth: 360, backgroundColor: "#181818", borderRadius: 20, padding: 22, alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "#EF4444" },
  pinTitle: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  pinSub: { color: "#9CA3AF", fontSize: 12, textAlign: "center" },
  pinInput: { width: "100%", height: 48, backgroundColor: "#262626", borderRadius: 10, paddingHorizontal: 14, color: "#FFF", fontSize: 22, textAlign: "center", letterSpacing: 8 },
  pinBtn: { flex: 1, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },

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
  adultTagBadge: { position: "absolute", bottom: 2, right: 2, backgroundColor: "#EF4444", paddingHorizontal: 3, paddingVertical: 1, borderRadius: 3 },
  adultTagText: { color: "#FFF", fontSize: 7, fontWeight: "900" },
});
