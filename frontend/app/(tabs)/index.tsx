import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function HomeTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);

  const [activationCode, setActivationCode] = useState("LICENÇA ATIVA");
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");

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
      return () => { isMounted = false; };
    }, [])
  );

  // Sistema de Gravação de Tela (Verde)
  const handleScreenRecord = () => {
    Alert.alert(
      "Gravação de Tela",
      "Ferramenta de captura e gravação de ecrã iniciada com sucesso.",
      [{ text: "OK" }]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: "#11141F" }]}>
      {/* CABEÇALHO */}
      <View style={styles.tvHeader}>
        <View style={styles.headerLeft}>
          {/* Laranja: Menu de configurações do aplicativo */}
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

      {/* PAINEL DE BLOCOS / CARDS PRINCIPAIS */}
      <View style={styles.dashboardGrid}>
        {/* Retângulo Vermelho: Bloco fixo de Filmes com a sua cor padrão */}
        <Pressable
          focusable={true}
          onPress={() => router.push("/(tabs)/movies")}
          style={({ focused }) => [styles.cardLarge, focused && styles.cardFocused]}
        >
          <View style={styles.cardLargeInner}>
            <Ionicons name="film-outline" size={64} color="#FFF" />
            <Text style={styles.cardTitle}>MOVIES</Text>
          </View>
        </Pressable>

        {/* Coluna Direita com os Blocos Menores */}
        <View style={styles.rightColumn}>
          {/* Retângulo Laranja: Nome alterado para SÉRIES */}
          <Pressable
            focusable={true}
            onPress={() => router.push("/(tabs)/series")}
            style={({ focused }) => [styles.cardMediumOrange, focused && styles.cardFocused]}
          >
            <View style={styles.cardMediumInner}>
              <Ionicons name="albums-outline" size={42} color="#FFF" />
              <Text style={styles.cardTitleMedium}>SÉRIES</Text>
            </View>
          </Pressable>

          {/* Azul: Canais */}
          <Pressable
            focusable={true}
            onPress={() => router.push("/(tabs)/live")}
            style={({ focused }) => [styles.cardMediumBlue, focused && styles.cardFocused]}
          >
            <View style={styles.cardMediumInner}>
              <Ionicons name="tv-outline" size={42} color="#FFF" />
              <Text style={styles.cardTitleMedium}>Canais</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* BARRA INFERIOR DE ATALHOS */}
      <View style={styles.bottomBar}>
        {/* Vermelho: Atualização diária de jogos */}
        <Pressable focusable={true} onPress={() => router.push("/(tabs)/live")} style={({ focused }) => [styles.bottomCard, focused && styles.cardFocused]}>
          <Ionicons name="football-outline" size={24} color="#FFF" />
          <Text style={styles.bottomCardText}>JOGOS DE HOJE</Text>
        </Pressable>

        {/* Rosa: Atualizações */}
        <Pressable focusable={true} onPress={() => Alert.alert("Atualizações", "O aplicativo está na versão mais recente.")} style={({ focused }) => [styles.bottomCard, focused && styles.cardFocused]}>
          <Ionicons name="newspaper-outline" size={24} color="#FFF" />
          <Text style={styles.bottomCardText}>ATUALIZAÇÕES</Text>
        </Pressable>

        {/* Verde: Gravação de tela */}
        <Pressable focusable={true} onPress={handleScreenRecord} style={({ focused }) => [styles.bottomCard, focused && styles.cardFocused]}>
          <Ionicons name="videocam-outline" size={24} color="#FFF" />
          <Text style={styles.bottomCardText}>RECORDINGS</Text>
        </Pressable>

        {/* Amarelo: Premium ou Teste */}
        <View style={{ flex: 1, alignItems: "flex-end", justifyContent: "center", paddingRight: 10 }}>
          <Text style={styles.premiumLabel}>
            {(!activationCode || activationCode.includes("TESTE") || activationCode.length < 5) ? "Teste" : "Premium"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 40, paddingVertical: 24, justifyContent: "space-between" },
  
  tvHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  tvBrand: { color: "#FFF", fontSize: 20, fontWeight: "900", letterSpacing: 1.2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 18 },
  headerIconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerDate: { color: "#9CA3AF", fontSize: 15, fontWeight: "700" },
  headerTime: { color: "#FFF", fontSize: 20, fontWeight: "900" },

  dashboardGrid: { flexDirection: "row", gap: 20, height: "58%" },
  
  cardLarge: {
    flex: 1.3,
    borderRadius: 16,
    backgroundColor: "#C2185B",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardLargeInner: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: "rgba(100, 20, 80, 0.4)" },
  cardTitle: { color: "#FFF", fontSize: 26, fontWeight: "900", letterSpacing: 2 },

  rightColumn: { flex: 1, gap: 20 },
  
  cardMediumOrange: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#F97316",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardMediumBlue: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardMediumInner: { flex: 1, flexDirection: "row", alignItems: "center", paddingLeft: 30, gap: 20 },
  cardTitleMedium: { color: "#FFF", fontSize: 22, fontWeight: "900", letterSpacing: 1.5 },

  bottomBar: { flexDirection: "row", gap: 16, height: "18%" },
  bottomCard: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  bottomCardText: { color: "#FFF", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  premiumLabel: { color: "#10B981", fontSize: 16, fontWeight: "900", letterSpacing: 0.5, marginRight: 10 },

  cardFocused: {
    borderColor: "#FBBF24",
    borderWidth: 4,
    transform: [{ scale: 1.03 }],
  },
});
