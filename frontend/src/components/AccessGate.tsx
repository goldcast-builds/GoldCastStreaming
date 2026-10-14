import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius, spacing } from "../utils/theme";
import { useSession } from "../store/session";

interface AccessGateProps {
  children?: React.ReactNode;
}

const VALIDATE_CODE_URL = "https://lljsnoovvwexzebzbaal.supabase.co/functions/v1/validate-code";

export default function AccessGate({ children }: AccessGateProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const login = useSession((s) => s.login);

  useEffect(() => {
    checkSavedAccess();
  }, []);

  const checkSavedAccess = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem("@goldcast_saved_email");
      const savedCode = await AsyncStorage.getItem("@goldcast_saved_code");
      const savedUnlocked = await AsyncStorage.getItem("@goldcast_gate_unlocked");

      if (savedEmail) setEmail(savedEmail);
      if (savedCode) setCode(savedCode);

      if (savedEmail && savedCode && savedUnlocked === "true") {
        setIsUnlocked(true);
        setChecking(false);

        // Validação silenciosa em segundo plano
        fetch(VALIDATE_CODE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: savedEmail, code: savedCode }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (!data.success) {
              AsyncStorage.removeItem("@goldcast_gate_unlocked");
              setIsUnlocked(false);
            }
          })
          .catch(() => {});
        return;
      }
    } catch (e) {
      // Ignora falhas de leitura local
    } finally {
      setChecking(false);
    }
  };

  const handleUnlock = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      Alert.alert("E-mail Obrigatório", "Por favor, indique um endereço de e-mail válido.");
      return;
    }

    if (!cleanCode) {
      Alert.alert("Código Obrigatório", "Por favor, insira o seu código de liberação.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(VALIDATE_CODE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanCode,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        Alert.alert("Acesso Negado", data.message || "Código ou e-mail inválido.");
        setLoading(false);
        return;
      }

      // Guarda os dados validados no dispositivo
      await AsyncStorage.setItem("@goldcast_saved_email", cleanEmail);
      await AsyncStorage.setItem("@goldcast_saved_code", cleanCode);
      await AsyncStorage.setItem("@goldcast_gate_unlocked", "true");

      // Liga diretamente à linha Xtream se retornada pela Edge Function
      if (data.serverUrl && data.username && data.password) {
        try {
          await login(data.serverUrl, data.username, data.password, true);
        } catch {
          // Mantém desbloqueado mesmo em caso de instabilidade momentânea
        }
      }

      setIsUnlocked(true);
    } catch (err: any) {
      Alert.alert("Erro de Ligação", err?.message || "Não foi possível validar o código com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  if (isUnlocked && children) {
    return <>{children}</>;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={38} color={colors.gold} />
          </View>

          <View style={styles.tagWrap}>
            <Text style={styles.tag}>ACESSO EXCLUSIVO POR PARCERIA</Text>
          </View>

          <Text style={styles.title}>Ativação GoldCast</Text>
          <Text style={styles.subtitle}>
            Insira o seu e-mail e o código fornecido para desbloquear as transmissões.
          </Text>

          {/* Campo de E-mail */}
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={20} color={colors.gold} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Seu e-mail de acesso"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          {/* Campo de Código com ícone da chave */}
          <View style={styles.inputWrap}>
            <Text style={styles.emojiIcon}>🔑</Text>
            <TextInput
              style={styles.input}
              placeholder="Código de liberação"
              placeholderTextColor="#666"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleUnlock}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>LIBERAR ACESSO</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footerText}>
            Ainda não tem um código? Entre em contato com seu revendedor ou suporte.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07080A",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#07080A",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#0F1115",
    width: "100%",
    maxWidth: 380,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.25)",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(229, 169, 59, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.3)",
  },
  tagWrap: {
    backgroundColor: "rgba(229, 169, 59, 0.12)",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.25)",
  },
  tag: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: "#8E929C",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  inputWrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16181E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  emojiIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  button: {
    width: "100%",
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.8,
  },
  footerText: {
    color: "#555A64",
    fontSize: 11,
    textAlign: "center",
    marginTop: spacing.lg,
    lineHeight: 16,
  },
});
