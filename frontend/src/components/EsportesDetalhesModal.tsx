import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors } from "../utils/theme";

interface Player {
  number: string;
  name: string;
  rating: string;
  position: string;
}

interface MatchDetailProps {
  visible: boolean;
  onClose: () => void;
  matchData: {
    league: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: string;
    awayScore: string;
    status: string;
    homeFormation: string;
    awayFormation: string;
    homeLineup: Player[];
    awayLineup: Player[];
    homeBench: Player[];
    awayBench: Player[];
    goals: { player: string; time: string; team: "home" | "away" }[];
  } | null;
}

export function EsportesDetalhesModal({ visible, onClose, matchData }: MatchDetailProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "lineup" | "bench">("overview");

  if (!matchData) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Cabeçalho */}
          <View style={styles.modalHeader}>
            <Text style={styles.leagueTitle}>{matchData.league}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} focusable={true}>
              <Ionicons name="close" size={18} color="#FFF" />
            </Pressable>
          </View>

          {/* Placar Principal */}
          <View style={styles.scoreboardBox}>
            <View style={styles.teamScoreInfo}>
              <Text style={styles.teamLabel}>{matchData.homeTeam}</Text>
              <Text style={styles.scoreText}>{matchData.homeScore}</Text>
            </View>
            <View style={styles.matchStatusBadge}>
              <Text style={styles.statusBadgeText}>{matchData.status}</Text>
            </View>
            <View style={styles.teamScoreInfo}>
              <Text style={styles.scoreText}>{matchData.awayScore}</Text>
              <Text style={styles.teamLabel}>{matchData.awayTeam}</Text>
            </View>
          </View>

          {/* Gols e Acontecimentos */}
          <View style={styles.eventsBox}>
            {matchData.goals.map((g, idx) => (
              <Text key={idx} style={styles.eventText}>
                ⚽ {g.player} {g.time}&apos; ({g.team === "home" ? matchData.homeTeam : matchData.awayTeam})
              </Text>
            ))}
          </View>

          {/* Abas Internas */}
          <View style={styles.tabsRow}>
            <Pressable onPress={() => setActiveTab("overview")} style={[styles.tabBtn, activeTab === "overview" && styles.tabBtnActive]} focusable={true}>
              <Text style={[styles.tabText, activeTab === "overview" && styles.tabTextActive]}>Visão Geral</Text>
            </Pressable>
            <Pressable onPress={() => setActiveTab("lineup")} style={[styles.tabBtn, activeTab === "lineup" && styles.tabBtnActive]} focusable={true}>
              <Text style={[styles.tabText, activeTab === "lineup" && styles.tabTextActive]}>Escalações</Text>
            </Pressable>
            <Pressable onPress={() => setActiveTab("bench")} style={[styles.tabBtn, activeTab === "bench" && styles.tabBtnActive]} focusable={true}>
              <Text style={[styles.tabText, activeTab === "bench" && styles.tabTextActive]}>Banco / Reservas</Text>
            </Pressable>
          </View>

          {/* Conteúdo da Aba */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
            {activeTab === "overview" && (
              <View style={{ gap: 12 }}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Estatísticas da Partida</Text>
                  <Text style={styles.infoSub}>Posse de bola, finalizações e faltas em tempo real sincronizadas com os principais portais esportivos.</Text>
                </View>
              </View>
            )}

            {activeTab === "lineup" && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldTitle}>Formação Tática: {matchData.homeTeam} ({matchData.homeFormation})</Text>
                <View style={styles.fieldBox}>
                  {matchData.homeLineup.map((p, i) => (
                    <View key={i} style={styles.playerBadge}>
                      <View style={styles.playerAvatarCircle}>
                        <Text style={styles.playerNum}>{p.number}</Text>
                      </View>
                      <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.playerRating}>{p.rating}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {activeTab === "bench" && (
              <View style={{ gap: 8 }}>
                <Text style={styles.infoTitle}>Jogadores no Banco ({matchData.homeTeam})</Text>
                {matchData.homeBench.map((p, i) => (
                  <View key={i} style={styles.benchRow}>
                    <Text style={styles.benchNum}>{p.number}</Text>
                    <Text style={styles.benchName}>{p.name}</Text>
                    <Text style={styles.benchPos}>{p.position}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 780, height: "88%", backgroundColor: "#131622", borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(212,175,55,0.3)", padding: 20, gap: 14 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", paddingBottom: 10 },
  leagueTitle: { color: colors.gold, fontSize: 14, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#1E2230", alignItems: "center", justifyContent: "center" },

  scoreboardBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "#191D2E", paddingVertical: 14, borderRadius: 14 },
  teamScoreInfo: { alignItems: "center", gap: 4, flex: 1 },
  teamLabel: { color: "#FFF", fontSize: 15, fontWeight: "900" },
  scoreText: { color: colors.gold, fontSize: 28, fontWeight: "900" },
  matchStatusBadge: { backgroundColor: "rgba(239, 68, 68, 0.2)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.4)" },
  statusBadgeText: { color: "#EF4444", fontSize: 10, fontWeight: "900" },

  eventsBox: { backgroundColor: "#181C2B", padding: 10, borderRadius: 10, gap: 4 },
  eventText: { color: "#9CA3AF", fontSize: 11, fontWeight: "700" },

  tabsRow: { flexDirection: "row", gap: 8, backgroundColor: "#1A1E2D", padding: 4, borderRadius: 10 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabBtnActive: { backgroundColor: colors.gold },
  tabText: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
  tabTextActive: { color: "#000", fontWeight: "900" },

  tabContent: { gap: 12, paddingVertical: 4 },
  infoCard: { backgroundColor: "#191D2E", padding: 14, borderRadius: 12, gap: 6 },
  infoTitle: { color: "#FFF", fontSize: 13, fontWeight: "900" },
  infoSub: { color: "#9CA3AF", fontSize: 11, lineHeight: 16 },

  fieldContainer: { gap: 8 },
  fieldTitle: { color: colors.gold, fontSize: 12, fontWeight: "800" },
  fieldBox: { backgroundColor: "#064E3B", borderRadius: 14, padding: 16, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", gap: 12, borderWidth: 1, borderColor: "#059669" },
  playerBadge: { alignItems: "center", width: 70, gap: 3 },
  playerAvatarCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.gold },
  playerNum: { color: "#FFF", fontSize: 11, fontWeight: "900" },
  playerName: { color: "#FFF", fontSize: 9.5, fontWeight: "700", textAlign: "center" },
  playerRating: { color: colors.gold, fontSize: 9, fontWeight: "900" },

  benchRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#191D2E", padding: 10, borderRadius: 8, gap: 12 },
  benchNum: { color: colors.gold, fontSize: 11, fontWeight: "900", width: 20, textAlign: "center" },
  benchName: { color: "#FFF", fontSize: 12, fontWeight: "800", flex: 1 },
  benchPos: { color: "#9CA3AF", fontSize: 10, fontWeight: "700" },
});
