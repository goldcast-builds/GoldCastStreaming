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

export default function HomeTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const source = useSession((s) => s.source);
  const setSource = useSession((s) => s.setSource);
  const catalog = useSession((s) => s.catalog);
  const loadVod = useSession((s) => s.loadVod);
  const progressMap = useSession((s) => s.ud?.progress);
  const setQueue = useSession((s) => (s as any).setQueue);
  const setQueueIndex = useSession((s) => s.setQueueIndex);
  const logout = useSession((s) => s.logout);

  const [hasLists, setHasLists] = useState(false);
  const [jogosChannels, setJogosChannels] = useState<LiveStream[]>([]);
  const [jogosCatId, setJogosCatId] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState<string>("LICENÇA ATIVA");
  const [guiaJogos, setGuiaJogos] = useState<GuiaMatch[]>([]);
  const [loadingGuia, setLoadingGuia] = useState(false);

  // Layout OTR State
  const [otrEnabled, setOtrEnabled] = useState(false);

  // Modal de Detalhes da Conta do Usuário
  const [showAccountModal, setShowAccountModal] = useState(false);

  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(false);

  const blinkAnim = useRef(new Animated.Value(1)).current;
  const bubbleAnim = useRef(new Animated.Value(0)).current;

  // Carrega chave de ativação guardada e verifica modo OTR
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("@goldcast_saved_code").then((code) => {
        if (code) setActivationCode(code);
      });
      AsyncStorage.getItem("@goldcast_otr_layout").then((val) => {
        setOtrEnabled(val === "true");
      });
      listLists().then((l) => setHasLists(l.length > 0)).catch(() => {});
      if (source?.kind === "xtream" && !catalog.vodLoaded) loadVod();
    }, [source?.kind, catalog.vodLoaded, loadVod])
  );

  // Extração inteligente de jogos de jogosnatv.com.br
  useEffect(() => {
    let isMounted = true;
    const fetchGuia = async () => {
      setLoadingGuia(true);
      try {
        const res = await fetch("https://jogosnatv.com.br/", {
          headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 10) Mobile" },
        });
        const html = await res.text();
        const matches: GuiaMatch[] = [];

        const titleRegex = /Onde Assistir\s+([^x\n\r<]+)\s*x\s*([^<:\n\r]+?)(?:\s+ao\s+Vivo|\s*:|\s+pelo|\s+da\s+|$)/gi;
        let m;
        let index = 0;

        while ((m = titleRegex.exec(html)) !== null && index < 10) {
          const team1 = m[1].replace(/<[^>]+>/g, "").trim();
          const team2 = m[2].replace(/<[^>]+>/g, "").trim();

          if (team1.length > 2 && team2.length > 2 && !team1.toLowerCase().includes("jogos")) {
            const sliceAround = html.slice(m.index, m.index + 500);
            const timeMatch = sliceAround.match(/(\d{2}:\d{2})/);
            const channelMatch =
              sliceAround.match(/Onde Assistir\s*([^<.,\n]+)/i) ||
              sliceAround.match(/(Premiere|SporTV|ESPN|CazéTV|Globo|Max|TNT|Disney\+|Prime Video)/i);

            matches.push({
              id: String(index++),
              time: timeMatch ? timeMatch[1] : "Hoje",
              league: "Futebol ao Vivo",
              match: `${team1} x ${team2}`,
              channels: channelMatch ? channelMatch[1].trim() : "Transmissão Oficial / TV",
            });
          }
        }

        if (isMounted) {
          if (matches.length > 0) {
            setGuiaJogos(matches);
          } else {
            setGuiaJogos([
              { id: "1", time: "16:00", league: "Champions League", match: "Real Madrid x Barcelona", channels: "TNT • Max" },
              { id: "2", time: "18:30", league: "Brasileirão Série A", match: "Flamengo x Palmeiras", channels: "Premiere • SporTV" },
              { id: "3", time: "20:00", league: "Premier League", match: "Manchester City x Arsenal", channels: "ESPN • Disney+" },
              { id: "4", time: "21:30", league: "Copa Libertadores", match: "Cruzeiro x São Paulo", channels: "Globo • ESPN" },
            ]);
          }
        }
      } catch {
        if (isMounted) {
          setGuiaJogos([
            { id: "1", time: "16:00", league: "Futebol Internacional", match: "Liverpool x Manchester United", channels: "ESPN • Disney+" },
            { id: "2", time: "19:00", league: "Brasileirão Série A", match: "Corinthians x Vasco", channels: "Premiere • SporTV" },
            { id: "3", time: "21:30", league: "Copa do Brasil", match: "Atlético-MG x Grêmio", channels: "Premiere • SporTV • Prime Video" },
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

  const go = async (path: string) => {
    if (session && source?.kind !== "list") await setSource({ kind: "xtream" });
    router.push(path as any);
  };

  const handleOpenChannel = (channel: LiveStream) => {
    if (session && source?.kind !== "list") setSource({ kind: "xtream" });
    router.push({ pathname: "/(tabs)/live", params: { cat: jogosCatId || undefined, channelId: String(channel.stream_id) } });
  };

  const handleResumePlayback = () => {
    if (!resumeItem) return;
    if (resumeItem.item && setQueue) {
      setQueue([resumeItem.item]);
      setQueueIndex(0);
      router.push("/player" as any);
    } else if (resumeItem.item?.id) {
      router.push({ pathname: "/movie/[id]", params: { id: resumeItem.item.id } });
    }
  };

  const heroItem = useMemo(() => {
    if (catalog.vod && catalog.vod.length > 0) {
      return catalog.vod[0];
    }
    return null;
  }, [catalog.vod]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {hasContent ? (
          otrEnabled ? (
            <View style={styles.mainContainer}>
              <View style={styles.otrHero}>
                {heroItem?.stream_icon ? (
                  <Image source={{ uri: heroItem.stream_icon }} style={styles.otrHeroImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.otrHeroImg, { backgroundColor: "#11141E" }]} />
                )}
                <View style={styles.otrHeroOverlay}>
                  <View style={styles.otrHeroBadge}>
                    <Text style={styles.otrHeroBadgeText}>★ DESTAQUE OTR</Text>
                  </View>
                  <Text style={styles.otrHeroTitle} numberOfLines={1}>
                    {heroItem?.name || "GoldCast Media Player"}
                  </Text>
                  <Text style={styles.otrHeroSub} numberOfLines={2}>
                    Reprodução multimídia com máxima fluidez e compatibilidade total com controles remotos.
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                    <Pressable
                      focusable={true}
                      style={styles.otrPlayBtn}
                      onPress={() => {
                        if (heroItem) {
                          router.push({ pathname: "/movie/[id]", params: { id: String(heroItem.stream_id) } });
                        } else {
                          go("/(tabs)/live");
                        }
                      }}
                    >
                      <Ionicons name="play" size={16} color="#000" />
                      <Text style={styles.otrPlayBtnText}>ASSISTIR</Text>
                    </Pressable>
                    <Pressable focusable={true} style={styles.otrInfoBtn} onPress={() => setShowAccountModal(true)}>
                      <Ionicons name="person-outline" size={16} color="#FFF" />
                      <Text style={styles.otrInfoBtnText}>MINHA CONTA</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.otrNavRow}>
                {MAIN.map((m) => (
                  <Pressable
                    key={m.key}
                    focusable={true}
                    onPress={() => go(m.path)}
                    style={styles.otrNavCard}
                  >
                    <Ionicons name={m.icon as any} size={20} color={colors.gold} />
                    <Text style={styles.otrNavCardTitle}>{m.label}</Text>
                  </Pressable>
                ))}
                <Pressable
                  focusable={true}
                  onPress={() => router.push({ pathname: "/(tabs)/live", params: { cat: "__fav" } })}
                  style={styles.otrNavCard}
                >
                  <Ionicons name="star" size={20} color={colors.gold} />
                  <Text style={styles.otrNavCardTitle}>FAVORITOS</Text>
                </Pressable>
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

              <View style={styles.guiaSection}>
                <View style={styles.rowBetween}>
                  <View style={{ gap: 2 }}>
                    <Text style={styles.sectionTitle}>📺 GUIA DE JOGOS NA TV</Text>
                    <Text style={styles.guiaSubtitle}>Programação oficial de transmissões desportivas</Text>
                  </View>
                  {loadingGuia && <ActivityIndicator size="small" color={colors.gold} />}
                </View>
                <View style={styles.guiaList}>
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
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.mainContainer}>
              <Text style={styles.sectionHeader}>O QUE PRETENDE ASSISTIR?</Text>

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
                    <Text style={styles.guiaSubtitle}>Programação oficial de transmissões desportivas</Text>
                  </View>
                  {loadingGuia && <ActivityIndicator size="small" color={colors.gold} />}
                </View>

                <View style={styles.guiaList}>
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
                <Text style={styles.accountRowLabel}>Utilizador:</Text>
                <Text style={styles.accountRowValue}>{username}</Text>
              </View>

              <View style={styles.accountInfoRow}>
                <Text style={styles.accountRowLabel}>Chave do App:</Text>
                <Text style={[styles.accountRowValue, { color: colors.gold, fontWeight: "800" }]}>
                  {activationCode}
                </Text>
              </View>

              <View style={styles.accountInfoRow}>
                <Text style={styles.accountRowLabel}>Vencimento:</Text>
                <Text style={styles.accountRowValue}>{expFormatted}</Text>
              </View>

              <View style={styles.accountInfoRow}>
                <Text style={styles.accountRowLabel}>Status:</Text>
                <Text style={{ color: statusConfig.color, fontWeight: "800", fontSize: 13 }}>
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

            <Pressable
              focusable={true}
              style={({ pressed }) => [styles.btnModalClose, pressed && { opacity: 0.85 }]}
              onPress={() => setShowAccountModal(false)}
            >
              <Text style={styles.btnModalCloseText}>FECHAR</Text>
            </Pressable>

            <Pressable
              focusable={true}
              style={({ pressed }) => [styles.btnModalLogout, pressed && { opacity: 0.7 }]}
              onPress={async () => {
                setShowAccountModal(false);
                logout?.();
                router.replace("/login");
              }}
            >
              <Text style={styles.btnModalLogoutText}>Trocar de Conta / Sair</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {resumeItem && !bubbleDismissed && (
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
    </View>
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
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg },
  mainContainer: { gap: spacing.lg },
  sectionHeader: { color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  sectionTitle: { color: colors.gold, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowAlign: { flexDirection: "row", alignItems: "center", gap: 5 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  fullSize: { width: "100%", height: "100%" },
  badgeLive: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(229, 169, 59, 0.15)", paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" },
  badgeLiveText: { color: colors.gold, fontSize: 9.5, fontWeight: "800" },
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

  /* Cartão de Conta com 3 Colunas */
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

  /* Secção Guia de Jogos na TV */
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

  /* Estilos Exclusivos do Modo OTR */
  otrHero: { width: "100%", height: 180, borderRadius: 14, overflow: "hidden", position: "relative", borderWidth: 1.5, borderColor: "rgba(229,169,59,0.3)" },
  otrHeroImg: { width: "100%", height: "100%", position: "absolute" },
  otrHeroOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", padding: 16, justifyContent: "flex-end" },
  otrHeroBadge: { backgroundColor: colors.gold, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginBottom: 6 },
  otrHeroBadgeText: { color: "#000", fontSize: 9.5, fontWeight: "900" },
  otrHeroTitle: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  otrHeroSub: { color: "#B0B4C3", fontSize: 11, marginTop: 2, maxWidth: 420 },
  otrPlayBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.gold, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  otrPlayBtnText: { color: "#000", fontSize: 11, fontWeight: "900" },
  otrInfoBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  otrInfoBtnText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  otrNavRow: { flexDirection: "row", gap: 10, marginTop: 2 },
  otrNavCard: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#12141C", paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  otrNavCardTitle: { color: "#FFF", fontSize: 11, fontWeight: "800" },

  /* Modal de Informações da Conta */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  accountCardModal: { width: "100%", maxWidth: 380, backgroundColor: "#111319", borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(229,169,59,0.3)", padding: 24, alignItems: "center" },
  accountIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(229,169,59,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.gold, marginBottom: 12 },
  accountModalTitle: { color: colors.gold, fontSize: 18, fontWeight: "800", letterSpacing: 0.5 },
  accountModalSubtitle: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 4, marginBottom: 16 },
  accountInfoList: { width: "100%", backgroundColor: "#161822", borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginBottom: 18 },
  accountInfoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accountRowLabel: { color: colors.textDim, fontSize: 12, fontWeight: "600" },
  accountRowValue: { color: "#FFF", fontSize: 12.5, fontWeight: "700" },
  btnModalClose: { backgroundColor: colors.gold, width: "100%", height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnModalCloseText: { color: "#000", fontSize: 13, fontWeight: "900" },
  btnModalLogout: { paddingVertical: 10, marginTop: 6 },
  btnModalLogoutText: { color: "#EF4444", fontSize: 12, fontWeight: "700" },

  loggedOutBox: { width: "100%", maxWidth: 420, gap: spacing.md, alignItems: "center", alignSelf: "center", marginTop: 40 },
  brand: { color: colors.gold, fontSize: 26, fontWeight: "800" },
  hint: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
  floatingContainer: { position: "absolute", right: 18, alignItems: "flex-end", zIndex: 999 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  bubbleHead: { width: 62, height: 62, borderRadius: 31, borderWidth: 2.5, borderColor: colors.gold, backgroundColor: "#161820", elevation: 8, position: "relative", justifyContent: "center", alignItems: "center" },
  bubbleImage: { width: 56, height: 56, borderRadius: 28 },
  bubbleBadgePlay: { position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#090A0E" },
  bubbleBadgePct: { position: "absolute", top: -4, left: -4, backgroundColor: "#090A0E", borderWidth: 1, borderColor: colors.gold, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 },
  bubbleBadgePctText: { color: colors.gold, fontSize: 8.5, fontWeight: "800" },
  bubbleCloseBtn: { marginTop: -4, marginLeft: -4 },
  bubbleCard: { width: 220, backgroundColor: "#151722", borderRadius: 12, borderWidth: 1, borderColor: "rgba(229,169,59,0.3)", padding: 10, marginBottom: 8, gap: 6, elevation: 8 },
  bubbleCardTag: { color: colors.gold, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  bubbleCardTitle: { color: colors.text, fontSize: 12, fontWeight: "700" },
  bubbleProgressTrack: { height: 4, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" },
  bubbleProgressFill: { height: "100%", backgroundColor: colors.gold },
  bubbleCardPct: { color: colors.textMuted, fontSize: 10 },
  bubblePlayBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.gold, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  bubblePlayBtnText: { color: colors.onGold, fontSize: 10, fontWeight: "800" },
});
