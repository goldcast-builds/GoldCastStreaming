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
import { useSession } from "../../src/store/session";
import { xtream, LiveStream, Category } from "../../src/services/xtream";

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
  const source = useSession((s) => s.source);
  const setSource = useSession((s) => s.setSource);
  const catalog = useSession((s) => s.catalog);
  const loadVod = useSession((s) => s.loadVod);
  const loadSeries = useSession((s) => (s as any).loadSeries);
  const logout = useSession((s) => s.logout);

  const [hasLists, setHasLists] = useState(false);
  const [jogosChannels, setJogosChannels] = useState<LiveStream[]>([]);
  const [jogosCatId, setJogosCatId] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState<string>("LICENÇA ATIVA");
  const [guiaJogos, setGuiaJogos] = useState<GuiaMatch[]>([]);
  const [loadingGuia, setLoadingGuia] = useState(false);
  
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showGuiaModal, setShowGuiaModal] = useState(false);

  // Controle Parental (+18)
  const [adultLocked, setAdultLocked] = useState(true);
  const [adultPin, setAdultPin] = useState("0000");
  const [showParentalModal, setShowParentalModal] = useState(false);
  const [newCustomPin, setNewCustomPin] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pendingItemToOpen, setPendingItemToOpen] = useState<any>(null);

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

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("@goldcast_saved_code").then((code) => {
        if (code) setActivationCode(code);
      });
      AsyncStorage.getItem("@goldcast_adult_locked").then((val) => {
        if (val !== null) setAdultLocked(val === "true");
      });
      AsyncStorage.getItem("@goldcast_adult_pin").then((val) => {
        if (val) setAdultPin(val);
      });

      listLists().then((l) => setHasLists(l.length > 0)).catch(() => {});
      if (session) {
        if (loadVod) loadVod().catch(() => {});
        if (loadSeries) loadSeries().catch(() => {});
      }
    }, [session, loadVod, loadSeries])
  );

  const isAdultContent = (name: string, categoryName: string = "") => {
    const text = (name + " " + categoryName).toLowerCase();
    return /adult|xxx|\+18|18\+|private|sensual|erot|sex|playboy|venus|hot|seventeen|privates/i.test(text);
  };

  const handleOpenItemWithParentalCheck = (item: any, openAction: () => void) => {
    if (adultLocked && isAdultContent(item?.name || item?.title || "")) {
      setPendingItemToOpen(() => openAction);
      setEnteredPin("");
      setShowPinModal(true);
    } else {
      openAction();
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

  // Busca do Guia de Jogos
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
            { id: "1", time: "16:00", league: "Premier League", match: "Tottenham x Coventry", channels: "ESPN • Disney+" },
            { id: "2", time: "19:30", league: "Brasileirão Série B", match: "Goiás x Náutico", channels: "ESPN • Premiere" },
            { id: "3", time: "20:00", league: "Brasileirão Série A", match: "Corinthians x Vitória", channels: "SporTV • Premiere" },
            { id: "4", time: "21:30", league: "Libertadores", match: "Flamengo x Palmeiras", channels: "Globo • ESPN • Disney+" },
          ];
        }

        if (isMounted) setGuiaJogos(matches);
      } catch {
        if (isMounted) {
          setGuiaJogos([
            { id: "1", time: "20:00", league: "Brasileirão Série A", match: "Corinthians x Vitória", channels: "SporTV • Premiere" },
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
        icon: "alert-circle",
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
      .filter((v) => !!v.stream_icon && (!adultLocked || !isAdultContent(v.name)))
      .slice(0, 15)
      .map((v) => ({ id: String(v.stream_id), name: v.name, poster: v.stream_icon, type: "movie" }));
  }, [catalog.vod, adultLocked]);

  const go = async (path: string) => {
    if (session && source?.kind !== "list") await setSource({ kind: "xtream" });
    router.push(path as any);
  };

  const handleOpenChannel = (channel: LiveStream) => {
    if (session && source?.kind !== "list") setSource({ kind: "xtream" });
    handleOpenItemWithParentalCheck(channel, () => {
      router.push({
        pathname: "/(tabs)/live",
        params: { cat: jogosCatId || undefined, channelId: String(channel.stream_id) },
      });
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {hasContent ? (
          <View style={styles.mainContainer}>
            {/* CABEÇALHO COM UTILIZADOR E CÓDIGO DE ACESSO */}
            <View style={styles.rowBetween}>
              <View style={{ gap: 2 }}>
                <Text style={styles.sectionHeader}>BEM-VINDO AO GOLDCAST</Text>
                <View style={styles.rowAlign}>
                  <Ionicons name="person-circle-outline" size={18} color={colors.gold} />
                  <Text style={styles.userMainTitle} numberOfLines={1}>{username}</Text>
                  <View style={styles.codePillBadge}>
                    <Ionicons name="key" size={11} color="#000" />
                    <Text style={styles.codePillText}>{activationCode}</Text>
                  </View>
                </View>
              </View>

              <Pressable
                focusable={true}
                onPress={() => setShowAccountModal(true)}
                style={styles.accountIconBtn}
              >
                <Ionicons name="settings-outline" size={22} color={colors.gold} />
              </Pressable>
            </View>

            {/* BOTÕES DE NAVEGAÇÃO PRINCIPAL */}
            <View style={styles.gridNav}>
              <Pressable focusable={true} onPress={() => go("/(tabs)/live")} style={styles.navCard}>
                <View style={styles.navCardIconBox}>
                  <Ionicons name="tv" size={26} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.navCardTitle}>TV AO VIVO</Text>
                  <Text style={styles.navCardSub}>Canais em tempo real</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
              </Pressable>

              <Pressable focusable={true} onPress={() => go("/(tabs)/movies")} style={styles.navCard}>
                <View style={styles.navCardIconBox}>
                  <Ionicons name="film" size={26} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.navCardTitle}>FILMES</Text>
                  <Text style={styles.navCardSub}>Catálogo On-Demand</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
              </Pressable>

              <Pressable focusable={true} onPress={() => go("/(tabs)/series")} style={styles.navCard}>
                <View style={styles.navCardIconBox}>
                  <Ionicons name="albums" size={26} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.navCardTitle}>SÉRIES</Text>
                  <Text style={styles.navCardSub}>Temporadas completas</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
              </Pressable>
            </View>

            {/* ATALHOS RÁPIDOS */}
            <View style={styles.quickRow}>
              <Pressable
                focusable={true}
                onPress={() => router.push({ pathname: "/(tabs)/live", params: { cat: "__fav" } })}
                style={styles.tile}
              >
                <Ionicons name="star-outline" size={18} color={colors.gold} />
                <Text style={styles.tileLabel}>Favoritos</Text>
              </Pressable>
              <Pressable
                focusable={true}
                onPress={() => setShowParentalModal(true)}
                style={styles.tile}
              >
                <Ionicons name="lock-closed-outline" size={18} color={colors.gold} />
                <Text style={styles.tileLabel}>Controle +18</Text>
              </Pressable>
              <Pressable
                focusable={true}
                onPress={() => setShowAccountModal(true)}
                style={styles.tile}
              >
                <Ionicons name="person-outline" size={18} color={colors.gold} />
                <Text style={styles.tileLabel}>Conta</Text>
              </Pressable>
            </View>

            {/* CANAIS DE JOGOS AO VIVO */}
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

            {/* TRENDING MARQUEE */}
            {marqueeItems.length > 0 && (
              <TrendingMarquee
                items={marqueeItems}
                onPressItem={(item) =>
                  handleOpenItemWithParentalCheck(item, () =>
                    router.push({ pathname: "/movie/[id]", params: { id: item.id } })
                  )
                }
              />
            )}

            {/* STATUS DO PLANO */}
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
              </View>
            )}

            {/* GUIA DE JOGOS DA WEB */}
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
        ) : (
          <View style={styles.loggedOutBox}>
            <Text style={styles.brand}>GoldCast Media Player</Text>
            <Text style={styles.hint}>Inicie sessão para carregar a programação.</Text>
          </View>
        )}
      </ScrollView>

      {/* MODAL DE PIN ADULTO (+18) */}
      <Modal visible={showPinModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.createProfileModalCard}>
            <Ionicons name="lock-closed" size={36} color="#E50914" />
            <Text style={styles.createModalTitle}>Conteúdo Protegido (+18)</Text>
            <Text style={styles.createModalSub}>Digite a senha de acesso (padrão: 0000)</Text>

            <TextInput
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              placeholder="••••"
              placeholderTextColor="#777"
              value={enteredPin}
              onChangeText={setEnteredPin}
              style={[styles.createInput, { textAlign: "center", fontSize: 22, letterSpacing: 8 }]}
            />

            <View style={{ flexDirection: "row", gap: 10, width: "100%", marginTop: 10 }}>
              <Pressable
                onPress={() => {
                  setShowPinModal(false);
                  setEnteredPin("");
                }}
                style={[styles.btnModalClose, { flex: 1, backgroundColor: "#262936" }]}
              >
                <Text style={[styles.btnModalCloseText, { color: "#FFF" }]}>CANCELAR</Text>
              </Pressable>
              <Pressable onPress={verifyPinAndOpen} style={[styles.btnModalClose, { flex: 1 }]}>
                <Text style={styles.btnModalCloseText}>DESBLOQUEAR</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE CONFIGURAÇÃO DE CONTROLE ADULTO */}
      <Modal visible={showParentalModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.createProfileModalCard}>
            <Text style={styles.createModalTitle}>Controle Parental (+18)</Text>
            <Text style={styles.createModalSub}>Bloquear conteúdo adulto e alterar senha</Text>

            <Pressable
              onPress={async () => {
                const next = !adultLocked;
                setAdultLocked(next);
                await AsyncStorage.setItem("@goldcast_adult_locked", String(next));
              }}
              style={styles.kidsToggleRow}
            >
              <Text style={styles.kidsToggleLabel}>Bloquear Conteúdo Adulto</Text>
              <Ionicons
                name={adultLocked ? "checkbox" : "square-outline"}
                size={24}
                color={colors.gold}
              />
            </Pressable>

            <TextInput
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              placeholder="Nova senha (ex: 1234)"
              placeholderTextColor="#777"
              value={newCustomPin}
              onChangeText={setNewCustomPin}
              style={[styles.createInput, { textAlign: "center" }]}
            />

            <View style={{ flexDirection: "row", gap: 10, width: "100%", marginTop: 10 }}>
              <Pressable
                onPress={() => setShowParentalModal(false)}
                style={[styles.btnModalClose, { flex: 1, backgroundColor: "#262936" }]}
              >
                <Text style={[styles.btnModalCloseText, { color: "#FFF" }]}>FECHAR</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (newCustomPin.trim().length === 4) {
                    setAdultPin(newCustomPin.trim());
                    await AsyncStorage.setItem("@goldcast_adult_pin", newCustomPin.trim());
                    Alert.alert("Sucesso", "Senha alterada com sucesso!");
                    setNewCustomPin("");
                    setShowParentalModal(false);
                  } else {
                    Alert.alert("Erro", "A senha deve ter exatamente 4 dígitos numéricos.");
                  }
                }}
                style={[styles.btnModalClose, { flex: 1 }]}
              >
                <Text style={styles.btnModalCloseText}>SALVAR SENHA</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE CONTA */}
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
                <Text style={[styles.accountRowValue, { color: colors.gold, fontWeight: "900" }]}>{activationCode}</Text>
              </View>
              <View style={styles.accountInfoRow}>
                <Text style={styles.accountRowLabel}>Vencimento:</Text>
                <Text style={styles.accountRowValue}>{expFormatted}</Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                setShowAccountModal(false);
                setShowParentalModal(true);
              }}
              style={[styles.btnModalClose, { backgroundColor: "#262936", marginBottom: 10 }]}
            >
              <Text style={[styles.btnModalCloseText, { color: colors.gold }]}>CONFIGURAR CONTROLE +18</Text>
            </Pressable>

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
  sectionHeader: { color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  userMainTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginLeft: 4, marginRight: 8, maxWidth: 160 },
  codePillBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.gold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  codePillText: { color: "#000", fontSize: 10.5, fontWeight: "900" },
  accountIconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.gold, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowAlign: { flexDirection: "row", alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  fullSize: { width: "100%", height: "100%" },
  badgeLive: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(229, 169, 59, 0.15)", paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" },
  badgeLiveText: { color: colors.gold, fontSize: 9.5, fontWeight: "800" },
  gridNav: { gap: 12 },
  navCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, borderColor: colors.border, gap: 14 },
  navCardIconBox: { width: 48, height: 48, borderRadius: 10, backgroundColor: "rgba(229, 169, 59, 0.12)", alignItems: "center", justifyContent: "center" },
  navCardTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  navCardSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
  quickRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  tile: { flex: 1, flexDirection: "row", height: 46, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 6 },
  tileLabel: { color: colors.text, fontSize: 11.5, fontWeight: "600" },
  marqueeOuter: { overflow: "hidden", marginHorizontal: -spacing.lg, paddingVertical: 6 },
  marqueeTrack: { flexDirection: "row", paddingLeft: spacing.lg },
  channelCard: { width: 122, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(229, 169, 59, 0.22)", overflow: "hidden", marginRight: 12 },
  channelCardFocused: { borderWidth: 3.5, borderColor: "#FFD700", transform: [{ scale: 1.08 }], elevation: 16, zIndex: 999 },
  posterBox: { width: 122, height: 120, backgroundColor: "#161820", position: "relative" },
  tagFhd: { position: "absolute", top: 6, left: 6, backgroundColor: "rgba(239, 68, 68, 0.9)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  tagFhdText: { color: "#FFF", fontSize: 8, fontWeight: "900" },
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  createProfileModalCard: { width: "100%", maxWidth: 380, backgroundColor: "#181818", borderRadius: 20, padding: 22, alignItems: "center", gap: 12 },
  createModalTitle: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  createModalSub: { color: "#9CA3AF", fontSize: 12, textAlign: "center" },
  createInput: { width: "100%", height: 48, backgroundColor: "#262626", borderRadius: 10, paddingHorizontal: 14, color: "#FFF", fontSize: 14 },
  kidsToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingVertical: 6 },
  kidsToggleLabel: { color: "#E5E7EB", fontSize: 13.5, fontWeight: "600" },
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
});
