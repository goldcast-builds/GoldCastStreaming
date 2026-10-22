import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors } from "../utils/theme";

interface MatchItem {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  status: string;
  league: string;
}

interface SportsNewsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function EsportesNewsModal({ visible, onClose }: SportsNewsModalProps) {
  const [activeTab, setActiveTab] = useState<"matches" | "news">("matches");
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let isMounted = true;
    const fetchSportsData = async () => {
      setLoading(true);
      try {
        // Simulação otimizada de dados de partidas em tempo real (Brasileirão, Champions League, etc.)
        const liveMatches: MatchItem[] = [
          { id: "1", homeTeam: "PSG", awayTeam: "Barcelona", homeScore: "4", awayScore: "2", status: "ENCERRADO", league: "Liga dos Campeões da UEFA" },
          { id: "2", homeTeam: "Flamengo", awayTeam: "Palmeiras", homeScore: "2", awayScore: "2", status: "AO VIVO 78'", league: "Campeonato Brasileiro - Série A" },
          { id: "3", homeTeam: "Real Madrid", awayTeam: "Arsenal", homeScore: "1", awayScore: "0", status: "INTERVALO", league: "Liga dos Campeões da UEFA" },
          { id: "4", homeTeam: "Corinthians", awayTeam: "São Paulo", homeScore: "0", awayScore: "1", status: "19:30", league: "Campeonato Brasileiro - Série A" },
          { id: "5", homeTeam: "Boca Juniors", awayTeam: "River Plate", homeScore: "-", awayScore: "-", status: "21:30", league: "Copa Libertadores" },
        ];
        if (isMounted) setMatches(liveMatches);
      } catch {
        if (isMounted) setMatches([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSportsData();
    return () => {
      isMounted = false;
    };
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Cabeçalho */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="football-outline" size={24} color={colors.gold} />
              <Text style={styles.modalTitle}>CENTRAL ESPORTIVA & NOTÍCIAS</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} focusable={true}>
              <Ionicons name="close" size={20} color="#FFF" />
            </Pressable>
          </View>

          {/* Abas de Navegação */}
          <View style={styles.tabsRow}>
            <Pressable onPress={() => setActiveTab("matches")} style={[styles.tabBtn, activeTab === "matches" && styles.tabBtnActive]} focusable={true}>
              <Text style={[styles.tabText, activeTab === "matches" && styles.tabTextActive]}>Partidas & Placares</Text>
            </Pressable>
            <Pressable onPress={() => setActiveTab("news")} style={[styles.tabBtn, activeTab === "news" && styles.tabBtnActive]} focusable={true}>
              <Text style={[styles.tabText, activeTab === "news" && styles.tabTextActive]}>Notícias do Esporte</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={styles.loadingText}>Atualizando placares e notícias em tempo real...</Text>
            </View>
          ) : activeTab === "matches" ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
              {matches.map((m) => (
                <View key={m.id} style={styles.matchCard}>
                  <Text style={styles.leagueLabel}>{m.league}</Text>
                  <View style={styles.teamsRow}>
                    <View style={styles.teamInfo}>
                      <Text style={styles.teamName}>{m.homeTeam}</Text>
                      <Text style={styles.scoreText}>{m.homeScore}</Text>
                    </View>
                    <Text style={styles.vsText}>X</Text>
                    <View style={styles.teamInfo}>
                      <Text style={styles.scoreText}>{m.awayScore}</Text>
                      <Text style={styles.teamName}>{m.awayTeam}</Text>
                    </View>
                  </View>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, m.status.includes("AO VIVO") && { backgroundColor: "#EF4444" }]} />
                    <Text style={styles.statusText}>{m.status}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
              <View style={styles.newsCard}>
                <Text style={styles.newsSource}>GE.GLOBO • FUTEBOL INTERNACIONAL</Text>
                <Text style={styles.newsTitle}>Rodada eletrizante na Liga dos Campeões define líderes dos grupos</Text>
                <Text style={styles.newsDesc}>Confira os detalhes das escalações, artilheiros e estatísticas completas das partidas de ontem.</Text>
              </View>
              <View style={styles.newsCard}>
                <Text style={styles.newsSource}>ESPN • BRASILEIRÃO</Text>
                <Text style={styles.newsTitle}>Times brasileiros intensificam preparação para a reta final do campeonato</Text>
                <Text style={styles.newsDesc}>Análise completa de desempenho, suspensões e histórico dos confrontos diretos.</Text>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 750, height: "82%", backgroundColor: "#141722", borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(212,175,55,0.3)", padding: 20, gap: 14 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", paddingBottom: 10 },
  modalTitle: { color: colors.gold, fontSize: 16, fontWeight: "900", letterSpacing: 0.8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#222634", alignItems: "center", justifyContent: "center" },
  
  tabsRow: { flexDirection: "row", gap: 10, backgroundColor: "#1A1E2D", padding: 4, borderRadius: 10 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  tabBtnActive: { backgroundColor: colors.gold },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  tabTextActive: { color: "#000", fontWeight: "900" },

  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  listContainer: { gap: 12, paddingVertical: 4 },

  matchCard: { backgroundColor: "#1A1E2D", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", gap: 8 },
  leagueLabel: { color: colors.gold, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  teamsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  teamInfo: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, justifyContent: "space-between" },
  teamName: { color: "#FFF", fontSize: 14, fontWeight: "800" },
  scoreText: { color: "#FFF", fontSize: 18, fontWeight: "900" },
  vsText: { color: colors.textDim, fontSize: 12, fontWeight: "900", paddingHorizontal: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end" },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" },
  statusText: { color: "#9CA3AF", fontSize: 10, fontWeight: "800" },

  newsCard: { backgroundColor: "#1A1E2D", borderRadius: 12, padding: 14, gap: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  newsSource: { color: colors.gold, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.5 },
  newsTitle: { color: "#FFF", fontSize: 14, fontWeight: "900", lineHeight: 18 },
  newsDesc: { color: "#9CA3AF", fontSize: 11.5, fontWeight: "600", lineHeight: 16 },
});
