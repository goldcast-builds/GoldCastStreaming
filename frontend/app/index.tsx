import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function LoginScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<"xtream" | "codigo">("codigo");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  // Ao abrir a tela, verifica se já existe um código salvo anteriormente no dispositivo
  useEffect(() => {
    AsyncStorage.getItem("@goldcast_saved_code").then((saved) => {
      if (saved) {
        setCode(saved);
      }
    });
  }, []);

  const handleLogin = async () => {
    if (!code) {
      Alert.alert("Aviso", "Por favor, insira a chave de ativação.");
      return;
    }
    try {
      await AsyncStorage.setItem("@goldcast_saved_code", code);
      router.replace("/(tabs)");
    } catch {
      Alert.alert("Erro", "Não foi possível guardar os dados de acesso.");
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.root}>
      <View style={styles.container}>
        <View style={styles.logoBox}>
          <Ionicons name="headset" size={32} color="#E9C46A" />
        </View>
        <Text style={styles.brandTitle}>GoldCast Media Player</Text>
        <Text style={styles.subtitle}>Escolha o formato e introduza as fontes de reprodução.</Text>

        <View style={styles.tabRow}>
          <Pressable 
            focusable={true} 
            onPress={() => setTab("codigo")} 
            style={[styles.tabBtn, tab === "codigo" && styles.tabBtnActive]}
          >
            <Ionicons name="key-outline" size={16} color={tab === "codigo" ? "#000" : "#E9C46A"} />
            <Text style={[styles.tabText, tab === "codigo" && styles.tabTextActive]}>Chave do Reprodutor</Text>
          </Pressable>

          <Pressable 
            focusable={true} 
            onPress={() => setTab("xtream")} 
            style={[styles.tabBtn, tab === "xtream" && styles.tabBtnActive]}
          >
            <Ionicons name="server-outline" size={16} color={tab === "xtream" ? "#000" : "#E9C46A"} />
            <Text style={[styles.tabText, tab === "xtream" && styles.tabTextActive]}>Servidor Xtream</Text>
          </Pressable>
        </View>

        <View style={styles.formBox}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>O SEU E-MAIL</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color="#E9C46A" />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="exemplo@email.com"
                placeholderTextColor="#6B7280"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>CHAVE DE ATIVAÇÃO / CÓDIGO</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="key" size={18} color="#E9C46A" />
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="Insira sua chave"
                placeholderTextColor="#6B7280"
              />
            </View>
          </View>

          <Pressable focusable={true} onPress={handleLogin} style={({ focused }) => [styles.submitBtn, focused && styles.btnFocused]}>
            <Text style={styles.submitBtnText}>ENTRAR NO REPRODUTOR</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1B3B4B", justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  container: { width: "100%", maxWidth: 650, alignItems: "center", gap: 10 },
  logoBox: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(233,196,106,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(233,196,106,0.4)" },
  brandTitle: { color: "#FFF", fontSize: 20, fontWeight: "900", letterSpacing: 1.2 },
  subtitle: { color: "#9CA3AF", fontSize: 11, fontWeight: "600", marginBottom: 6 },

  tabRow: { flexDirection: "row", gap: 10, backgroundColor: "#152E3B", padding: 4, borderRadius: 10, borderWidth: 1, borderColor: "rgba(233,196,106,0.15)" },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  tabBtnActive: { backgroundColor: "#E9C46A" },
  tabText: { color: "#9CA3AF", fontSize: 11, fontWeight: "800" },
  tabTextActive: { color: "#000", fontWeight: "900" },

  formBox: { width: "100%", backgroundColor: "#152E3B", borderRadius: 16, padding: 18, gap: 12, borderWidth: 1, borderColor: "rgba(233,196,106,0.2)" },
  inputGroup: { gap: 4 },
  label: { color: "#E9C46A", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#1B3B4B", borderRadius: 10, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", gap: 10 },
  input: { flex: 1, color: "#FFF", fontSize: 13, fontWeight: "700" },

  submitBtn: { backgroundColor: "#E9C46A", height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 4 },
  btnFocused: { borderWidth: 2, borderColor: "#FFF", transform: [{ scale: 1.01 }] },
  submitBtnText: { color: "#000", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
});
