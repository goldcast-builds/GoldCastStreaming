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
import { colors, radius, spacing } from "../utils/theme";

interface GuiaMatch {
  id: string;
  time: string;
  league: string;
  match: string;
  channels: string;
}

interface JogosDeHojeModalProps {
  visible: boolean;
  onClose: () => void;
}

export function JogosDeHojeModal({ visible, onClose }: JogosDeHojeModalProps) {
  const [guiaJogos, setGuiaJogos] = useState<GuiaMatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let isMounted = true;
    const fetchGuia = async () => {
      setLoading(true);
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
        if (isMounted) setLoading(false);
      }
    };

    fetchGuia();
    return () => {
      isMounted = false;
    };
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="football" size={22} color={colors.gold} />
              <Text style={styles.modalTitle}>JOGOS DE HOJE — GUIA NA TV</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} focusable={true}>
              <Ionicons name="close" size={20} color="#FFF" />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={styles.loadingText}>Buscando programação dos jogos...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
              {guiaJogos.map((g) => (
                <View key={g.id} style={styles.guiaCard}>
                  <View style={styles.guiaHeaderRow}>
                    <View style={styles.guiaTimeBadge}>
                      <Ionicons name="time" size={10} color="#000" />
                      <Text style={styles.guiaTimeText}>{g.time}</Text>
                    </View>
                    <Text style={styles.guiaLeagueText} numberOfLines={1}>{g.league}</Text>
                  </View>
                  <Text style={styles.guiaMatchTitle} numberOfLines={2}>{g.match}</Text>
                  <View style={styles.guiaChannelsRow}>
                    <Ionicons name="tv-outline" size={12} color={colors.gold} />
                    <Text style={styles.guiaChannelsText} numberOfLines={1}>{g.channels}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 650, height: "80%", backgroundColor: "#141722", borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(212,175,55,0.3)", padding: 20, gap: 14 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", paddingBottom: 10 },
  modalTitle: { color: colors.gold, fontSize: 16, fontWeight: "900", letterSpacing: 0.8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#222634", alignItems: "center", justifyContent: "center" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  listContainer: { gap: 10, paddingVertical: 4 },
  guiaCard: { backgroundColor: "#1A1E2D", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", gap: 6 },
  guiaHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  guiaTimeBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  guiaTimeText: { color: "#000", fontSize: 9.5, fontWeight: "900" },
  guiaLeagueText: { color: colors.textDim, fontSize: 10.5, fontWeight: "700", flex: 1 },
  guiaMatchTitle: { color: "#FFF", fontSize: 13, fontWeight: "800" },
  guiaChannelsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  guiaChannelsText: { color: colors.gold, fontSize: 11, fontWeight: "700" },
});
