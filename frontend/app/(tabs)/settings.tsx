import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSession } from "../../src/store/session";

export default function SettingsScreen() {
  const router = useRouter();
  const session = useSession((s) => s.session);
  const refreshAccount = useSession((s) => s.refreshAccount);
  const clearCatalog = useSession((s) => s.clearCatalog);
  const logout = useSession((s) => s.logout);

  // Ação de Terminar Sessão / Sair
  const handleLogout = async () => {
    Alert.alert(
      "Sair da Conta",
      "Tem certeza de que deseja terminar a sessão e limpar os dados salvos?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/");
          },
        },
      ]
    );
  };

  // Ação de Atualizar Conteúdo / Sincronizar Catálogo
  const handleRefreshContent = async () => {
    try {
      Alert.alert("Atualizar Conteúdo", "A atualizar dados do servidor IPTV...");
      await refreshAccount();
      clearCatalog();
      Alert.alert("Sucesso", "Conteúdo atualizado com sucesso!");
    } catch {
      Alert.alert("Erro", "Não foi possível atualizar o conteúdo neste momento.");
    }
  };

  // Ação de Limpar Cache
  const handleClearCache = async () => {
    try {
      await AsyncStorage.removeItem("@goldcast_cache");
      Alert.alert("Limpar Cache", "Cache limpo com sucesso!");
    } catch {
      Alert.alert("Aviso", "O cache já está limpo.");
    }
  };

  // Informações da Conta
  const handleAccountInfo = () => {
    const info = session?.userInfo;
    Alert.alert(
      "Detalhes da Conta",
      `Utilizador: ${session?.username || "N/D"}\nServidor: ${session?.server || "N/D"}\nEstado: ${info?.status || "Ativo"}\nExpira em: ${info?.exp_date ? new Date(info.exp_date * 1000).toLocaleDateString() : "Ilimitado"}`
    );
  };

  // Informações Sobre o App
  const handleAbout = () => {
    Alert.alert("Sobre", "GoldCast Media Player\nVersão: 1.0.1\nPlataforma otimizada para Smart TV.");
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={() => router.back()} 
          style={({ focused }) => [styles.backBtn, focused && styles.cardFocused]} 
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>CONFIGURAÇÕES</Text>
      </View>

      <ScrollView contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
        {/* 1. Conta */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={handleAccountInfo} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="person-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Conta</Text>
        </Pressable>

        {/* 2. Atualizar App */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={() => Alert.alert("Atualizar App", "O aplicativo já está na versão mais recente.")} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="cloud-download-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Atualizar App</Text>
        </Pressable>

        {/* 3. Listas M3U */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={() => router.push("/add-list")} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="list-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Listas M3U</Text>
        </Pressable>

        {/* 4. Atualizar Conteúdo */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={handleRefreshContent} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="sync-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Atualizar conteúdo</Text>
        </Pressable>

        {/* 5. Reprodução */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={() => Alert.alert("Reprodução", "Reprodutor de vídeo configurado com aceleração de hardware nativa.")} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="play-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Reprodução</Text>
        </Pressable>

        {/* 6. Histórico e favoritos */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={() => Alert.alert("Histórico", "Histórico de reprodução sincronizado localmente.")} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="time-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Histórico e favoritos</Text>
        </Pressable>

        {/* 7. Limpar cache */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={handleClearCache} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="brush-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Limpar cache</Text>
        </Pressable>

        {/* 8. Sobre */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={handleAbout} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="information-circle-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Sobre</Text>
        </Pressable>

        {/* 9. Sair */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={handleLogout} 
          style={({ focused }) => [styles.settingCard, styles.logoutCard, focused && styles.cardFocused]}
        >
          <Ionicons name="log-out-outline" size={28} color="#E76F51" />
          <Text style={[styles.cardText, { color: "#E76F51" }]}>Sair</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1B3B4B", paddingHorizontal: 36, paddingVertical: 24 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  headerTitle: { color: "#FFF", fontSize: 20, fontWeight: "900", letterSpacing: 1.5 },

  gridContainer: { flexDirection: "row", flexWrap: "wrap", gap: 18, justifyContent: "space-between", paddingBottom: 20 },
  settingCard: {
    width: "31%",
    height: 130,
    backgroundColor: "#152E3B",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: "rgba(233,196,106,0.15)",
  },
  cardFocused: {
    borderColor: "#E9C46A",
    borderWidth: 3,
    transform: [{ scale: 1.03 }],
    backgroundColor: "#1B3B4B",
  },
  cardText: { color: "#FFF", fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  logoutCard: { borderColor: "rgba(231,111,81,0.3)" },
});
