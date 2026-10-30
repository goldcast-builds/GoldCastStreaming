import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function SettingsScreen() {
  const router = useRouter();

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
            await AsyncStorage.removeItem("@goldcast_saved_code");
            router.replace("/");
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable focusable={true} onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>CONFIGURAÇÕES</Text>
      </View>

      <ScrollView contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
        <Pressable focusable={true} onPress={() => Alert.alert("Conta", "Informações da conta ativas.")} style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}>
          <Ionicons name="person-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Conta</Text>
        </Pressable>

        <Pressable focusable={true} onPress={() => Alert.alert("Atualizar App", "A versão já está atualizada.")} style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}>
          <Ionicons name="cloud-download-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Atualizar App</Text>
        </Pressable>

        <Pressable focusable={true} onPress={() => Alert.alert("Listas M3U", "Gestão de listas ativa.")} style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}>
          <Ionicons name="list-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Listas M3U</Text>
        </Pressable>

        <Pressable focusable={true} onPress={() => Alert.alert("Atualizar Conteúdo", "Catálogo sincronizado.")} style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}>
          <Ionicons name="sync-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Atualizar conteúdo</Text>
        </Pressable>

        <Pressable focusable={true} onPress={() => Alert.alert("Reprodução", "Definições de vídeo padrão.")} style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}>
          <Ionicons name="play-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Reprodução</Text>
        </Pressable>

        <Pressable focusable={true} onPress={() => Alert.alert("Histórico", "Histórico limpo.")} style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}>
          <Ionicons name="time-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Histórico e favoritos</Text>
        </Pressable>

        <Pressable focusable={true} onPress={() => Alert.alert("Cache", "Cache limpo com sucesso.")} style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}>
          <Ionicons name="brush-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Limpar cache</Text>
        </Pressable>

        <Pressable focusable={true} onPress={() => Alert.alert("Sobre", "GoldCast Media Player v1.0.1")} style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}>
          <Ionicons name="information-circle-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Sobre</Text>
        </Pressable>

        <Pressable focusable={true} onPress={handleLogout} style={({ focused }) => [styles.settingCard, styles.logoutCard, focused && styles.cardFocused]}>
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
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
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
