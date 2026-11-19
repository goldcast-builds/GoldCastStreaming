import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors } from "../utils/theme";

type MatchStatus = "live" | "scheduled" | "finished";
type FilterTab = "all" | "live" | "scheduled";

interface FutebolMatch {
  id: string;
  time: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  channels: string;
}

interface JogosDeHojeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectMatch?: (match: FutebolMatch) => void;
}

const CACHE_KEY = "@goldcast_futebol_hoje_v1";

const FALLBACK_MATCHES: FutebolMatch[] = [
  {
    id: "fb-1",
    time: "19:30",
    league: "Brasileirão Série A",
    homeTeam: "Fluminense",
    awayTeam: "Internacional",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    channels: "RECORD • Premiere",
  },
  {
    id: "fb-2",
    time: "19:30",
    league: "Brasileirão Série A",
    homeTeam: "Santos",
    awayTeam: "Palmeiras",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    channels: "SporTV • Premiere",
  },
];

const LEAGUE_ENDPOINTS = [
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard", label: "Brasileirão Série A" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard", label: "UEFA Champions League" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard", label: "Premier League" },
];

function formatBrazilTime(dateIso?: string): string {
  if (!dateIso) return "Hoje";
  const d = new Date(dateIso);
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

async function fetchFootballScoreboard(): Promise<FutebolMatch[]> {
  const collected: FutebolMatch[] = [];

  for (const endpoint of LEAGUE_ENDPOINTS) {
    try {
      const res = await fetch(endpoint.url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;

      const json = await res.json();
      const events = Array.isArray(json?.events) ? json.events : [];

      for (const event of events) {
        const comp = event?.competitions?.[0];
        const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
        const home = competitors.find((c: any) => c?.homeAway === "home") || competitors[0];
        const away = competitors.find((c: any) => c?.homeAway === "away") || competitors[1];

        const homeName = home?.team?.shortDisplayName || home?.team?.displayName;
        const awayName = away?.team?.shortDisplayName || away?.team?.displayName;
        if (!homeName || !awayName) continue;

        const state = event?.status?.type?.state; // "pre" | "in" | "post"
        let status: MatchStatus = "scheduled";
        let timeLabel = formatBrazilTime(event?.date);

        if (state === "in") {
          status = "live";
          const clock = event?.status?.displayClock;
          timeLabel = clock ? `${clock}'` : event?.status?.type?.shortDetail || "AO VIVO";
        } else if (state === "post") {
          status = "finished";
          timeLabel = "Encerrado";
        }

        const broadcastNames = comp?.broadcasts
          ?.flatMap((b: any) => (Array.isArray(b?.names) ? b.names : []))
          ?.filter(Boolean);
        const channels =
          broadcastNames && broadcastNames.length > 0
            ? [...new Set(broadcastNames)].join(" • ")
            : "Transmissão ao Vivo";

        const homeScoreNum = state !== "pre" && home?.score !== undefined ? Number(home.score) : null;
        const awayScoreNum = state !== "pre" && away?.score !== undefined ? Number(away.score) : null;

        collected.push({
          id: String(event?.id || `${endpoint.label}-${homeName}-${awayName}`),
          time: timeLabel,
          league: endpoint.label,
          homeTeam: homeName,
          awayTeam: awayName,
          homeScore: homeScoreNum !== null && !Number.isNaN(homeScoreNum) ? homeScoreNum : null,
          awayScore: awayScoreNum !== null && !Number.isNaN(awayScoreNum) ? awayScoreNum : null,
          status,
          channels,
        });
      }
    } catch {
      // Continua para o próximo campeonato sem derrubar os demais
    }
  }

  if (collected.length > 0) {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(collected)).catch(() => {});
    return collected;
  }

  const cachedRaw = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
  if (cachedRaw) {
    const parsed = JSON.parse(cachedRaw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  }

  return FALLBACK_MATCHES;
}

export function JogosDeHojeModal({ visible, onClose, onSelectMatch }: JogosDeHojeModalProps) {
  const [matches, setMatches] = useState<FutebolMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");

  const loadMatches = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchFootballScoreboard();
      setMatches(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    loadMatches(false);
  }, [visible, loadMatches]);

  const liveCount = useMemo(
    () => matches.filter((m) => m.status === "live").length,
    [matches]
  );

  const filteredMatches = useMemo(() => {
    if (filter === "live") return matches.filter((m) => m.status === "live");
    if (filter === "scheduled") return matches.filter((m) => m.status === "scheduled");
    return matches;
  }, [matches, filter]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Cabeçalho */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <Ionicons name="football" size={20} color={colors.gold} />
              <Text style={styles.modalTitle}>FUTEBOL — JOGOS DE HOJE</Text>
              {liveCount > 0 && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>{liveCount} AO VIVO</Text>
                </View>
              )}
            </View>

            <View style={styles.headerActions}>
              <Pressable
                onPress={() => loadMatches(true)}
                style={({ focused }) => [styles.iconBtn, focused && styles.focused]}
                focusable={true}
              >
                <Ionicons name="refresh" size={17} color={colors.gold} />
              </Pressable>

              <Pressable
                onPress={onClose}
                style={({ focused }) => [styles.closeBtn, focused && styles.focused]}
                focusable={true}
              >
                <Ionicons name="close" size={18} color="#FFF" />
              </Pressable>
            </View>
          </View>

          {/* Barra de Filtros */}
          <View style={styles.filterRow}>
            {(
              [
                { key: "all", label: "Todos" },
                { key: "live", label: "Ao Vivo" },
                { key: "scheduled", label: "Próximos" },
              ] as Array<{ key: FilterTab; label: string }>
            ).map((tab) => {
              const active = filter === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setFilter(tab.key)}
                  focusable={true}
                  style={({ focused }) => [
                    styles.filterBtn,
                    active && styles.filterBtnActive,
                    focused && styles.focused,
                  ]}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Lista de Jogos */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={styles.loadingText}>Carregando placares e programação...</Text>
            </View>
          ) : filteredMatches.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="football-outline" size={28} color="#9CA3AF" />
              <Text style={styles.loadingText}>Nenhuma partida encontrada neste filtro.</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => loadMatches(true)}
                  tintColor={colors.gold}
                />
              }
            >
              {filteredMatches.map((g) => {
                const isLive = g.status === "live";
                const showScore = g.homeScore !== null && g.awayScore !== null;

                return (
                  <Pressable
                    key={g.id}
                    onPress={() => onSelectMatch?.(g)}
                    focusable={true}
                    style={({ focused }) => [styles.guiaCard, focused && styles.cardFocused]}
                  >
                    <View style={styles.guiaHeaderRow}>
                      <View style={[styles.guiaTimeBadge, isLive && styles.guiaTimeBadgeLive]}>
                        <Ionicons
                          name={isLive ? "radio" : "time"}
                          size={10}
                          color={isLive ? "#FFF" : "#000"}
                        />
                        <Text style={[styles.guiaTimeText, isLive && styles.guiaTimeTextLive]}>
                          {g.time}
                        </Text>
                      </View>
                      <Text style={styles.guiaLeagueText} numberOfLines={1}>
                        {g.league}
                      </Text>
                    </View>

                    <View style={styles.matchScoreRow}>
                      <Text style={styles.teamName} numberOfLines={1}>
                        {g.homeTeam}
                      </Text>

                      <View style={styles.scoreBox}>
                        {showScore ? (
                          <Text style={[styles.scoreValue, isLive && styles.scoreValueLive]}>
                            {g.homeScore} - {g.awayScore}
                          </Text>
                        ) : (
                          <Text style={styles.vsBadge}>VS</Text>
                        )}
                      </View>

                      <Text style={[styles.teamName, styles.teamNameRight]} numberOfLines={1}>
                        {g.awayTeam}
                      </Text>
                    </View>

                    <View style={styles.guiaChannelsRow}>
                      <Ionicons name="tv-outline" size={12} color={colors.gold} />
                      <Text style={styles.guiaChannelsText} numberOfLines={1}>
                        {g.channels}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 680,
    height: "82%",
    backgroundColor: "#141722",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(212,175,55,0.3)",
    padding: 20,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    paddingBottom: 10,
    gap: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.5)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EF4444",
  },
  liveText: {
    color: "#FCA5A5",
    fontSize: 9.5,
    fontWeight: "800",
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#222634",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#222634",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  focused: {
    borderColor: "#FFF",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#1A1E2D",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  filterBtnActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  filterText: {
    color: "#D1D5DB",
    fontSize: 11.5,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#000",
    fontWeight: "900",
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "600",
  },
  listContainer: {
    gap: 10,
    paddingVertical: 4,
  },
  guiaCard: {
    backgroundColor: "#1A1E2D",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 8,
  },
  cardFocused: {
    borderColor: colors.gold,
    backgroundColor: "#202538",
  },
  guiaHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  guiaTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  guiaTimeBadgeLive: {
    backgroundColor: "#EF4444",
  },
  guiaTimeText: {
    color: "#000",
    fontSize: 10,
    fontWeight: "900",
  },
  guiaTimeTextLive: {
    color: "#FFF",
  },
  guiaLeagueText: {
    color: "#9CA3AF",
    fontSize: 10.5,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  matchScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 2,
  },
  teamName: {
    color: "#FFF",
    fontSize: 13.5,
    fontWeight: "800",
    flex: 1,
  },
  teamNameRight: {
    textAlign: "right",
  },
  scoreBox: {
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  scoreValue: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  scoreValueLive: {
    color: "#FCA5A5",
  },
  vsBadge: {
    color: "#9CA3AF",
    fontSize: 10.5,
    fontWeight: "900",
  },
  guiaChannelsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  guiaChannelsText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
});
