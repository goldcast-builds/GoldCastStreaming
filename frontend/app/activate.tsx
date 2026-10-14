import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Logo } from "../src/components/Logo";
import { GoldButton } from "../src/components/GoldButton";
import { colors, radius, spacing } from "../src/utils/theme";

const VALIDATE_CODE_URL =
  "https://lljsnoovvwexzebzbaal.supabase.co/functions/v1/validate-code";

export default function ActivateScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const savedEmail = await AsyncStorage.getItem("@goldcast_saved_email");
      const savedCode = await AsyncStorage.getItem("@goldcast_saved_code");
      if (savedEmail) setEmail(savedEmail);
      if (savedCode) setCode(savedCode);
    })();
  }, []);

  const handleActivate = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      Alert.alert("E-mail Obrigatório", "Por favor, digite um e-mail válido.");
      return;
    }
    if (!cleanCode) {
      Alert.alert("Código Obrigatório", "Por favor, informe seu código de ativação.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(VALIDATE_CODE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        Alert.alert("Acesso Negado", data.message || "Código ou e-mail inválido.");
        setLoading(false);
        return;
      }

      // Licença validada no Supabase! Salva localmente
      await AsyncStorage.setItem("@goldcast_licensed", "true");
      await AsyncStorage.setItem("@goldcast_saved_email", cleanEmail);
      await AsyncStorage.setItem("@goldcast_saved_code", cleanCode);

      Alert.alert("Sucesso! 🎉", "Licença ativada. Agora entre com a sua conta IPTV.");
      // Vai direto para a Tela 2: Login IPTV
      router.replace("/login");
    } catch (err: any) {
      Alert.alert("Erro de Conexão", err.message || "Não foi possível validar a licença.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Logo size={140} />
        </View>

        <Text style={styles.brand}>Ativação GoldCast</Text>
        <Text style={styles.subtitle}>Digite o seu e-mail e código para ativar o aplicativo.</Text>

        <View style={{ gap: spacing.md, marginTop: spacing.xl, width: "100%", maxWidth: 380 }}>
          <View>
            <Text style={styles.fieldLabel}>SEU E-MAIL</Text>
            <View style={styles.fieldWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.gold} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="exemplo@gmail.com"
                placeholderTextColor={colors.textDim}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
          </View>

          <View>
            <Text style={styles.fieldLabel}>CÓDIGO DE ACESSO</Text>
            <View style={styles.fieldWrap}>
              <Ionicons name="key-outline" size={18} color={colors.gold} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="Ex: GOLD-VIP-365D"
                placeholderTextColor={colors.textDim}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
            <Text style={styles.hint}>Este código ficará registrado permanentemente ao seu e-mail.</Text>
          </View>

          <GoldButton
            label="ATIVAR APLICATIVO"
            onPress={handleActivate}
            loading={loading}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  logoWrap: { alignItems: "center", marginBottom: spacing.sm },
  brand: { color: colors.gold, fontSize: 24, fontWeight: "700", textAlign: "center" },
  subtitle: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: spacing.xs, maxWidth: 320 },
  fieldLabel: { color: colors.textMuted, fontSize: 11, marginBottom: 6, fontWeight: "700" },
  fieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 14 },
  hint: { color: colors.textDim, fontSize: 11, marginTop: 4 },
});
