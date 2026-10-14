import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Logo } from "../src/components/Logo";
import { GoldButton } from "../src/components/GoldButton";
import { colors, radius, spacing } from "../src/utils/theme";
import { Stage } from "../src/services/xtream";
import { useSession } from "../src/store/session";

const STAGE_LABEL: Record<Stage, string> = {
  checking: "Verificando código...",
  connecting: "Conectando ao servidor...",
  validating: "Validando sua conta...",
  loading: "Carregando catálogo...",
  done: "Acesso liberado!",
};

const VALIDATE_CODE_URL = "https://lljsnoovvwexzebzbaal.supabase.co/functions/v1/validate-code";
const REQUEST_TRIAL_URL = "https://lljsnoovvwexzebzbaal.supabase.co/functions/v1/request-trial";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const login = useSession((s) => s.login);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<{ s: Stage; d?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal de Teste Grátis
  const [trialModalVisible, setTrialModalVisible] = useState(false);
  const [trialEmail, setTrialEmail] = useState("");
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialSuccessMsg, setTrialSuccessMsg] = useState<string | null>(null);

  const mounted = useRef(true);

  useEffect(() => {
    // Carrega último e-mail e código salvos localmente
    (async () => {
      try {
        const savedEmail = await AsyncStorage.getItem("@goldcast_saved_email");
        const savedCode = await AsyncStorage.getItem("@goldcast_saved_code");
        if (savedEmail) setEmail(savedEmail);
        if (savedCode) setCode(savedCode);
      } catch {}
    })();

    return () => {
      mounted.current = false;
    };
  }, []);

  const handleLoginWithCode = async (customEmail?: string, customCode?: string) => {
    const targetEmail = (customEmail || email).trim().toLowerCase();
    const targetCode = (customCode || code).trim().toUpperCase();

    setError(null);

    if (!targetEmail || !targetEmail.includes("@")) {
      setError("Por favor, digite um e-mail válido.");
      return;
    }

    if (!targetCode) {
      setError("Por favor, informe seu código de acesso.");
      return;
    }

    setLoading(true);
    setStage({ s: "checking", d: "Validando código e e-mail..." });

    try {
      // 1. Valida o par (E-mail + Código) no Supabase
      const res = await fetch(VALIDATE_CODE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, code: targetCode }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Código ou e-mail inválido.");
      }

      // Salva localmente para não precisar redigitar
      await AsyncStorage.setItem("@goldcast_saved_email", targetEmail);
      await AsyncStorage.setItem("@goldcast_saved_code", targetCode);

      // 2. Conecta ao Xtream com as credenciais associadas
      setStage({ s: "connecting", d: "Iniciando sessão GoldCast..." });
      await login(data.serverUrl, data.username, data.password, true, (s, d) => {
        if (mounted.current) setStage({ s, d });
      });

      setTimeout(() => router.replace("/(tabs)"), 350);
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || "Falha ao autenticar o código.");
        setStage(null);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const handleRequestTrial = async () => {
    if (!trialEmail.trim() || !trialEmail.includes("@")) {
      setError("Digite um e-mail válido para receber o teste.");
      return;
    }

    setTrialLoading(true);
    setError(null);

    try {
      const res = await fetch(REQUEST_TRIAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trialEmail.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Não foi possível gerar o teste.");
      }

      // Preenche os dados no formulário principal
      setEmail(trialEmail.trim().toLowerCase());
      setCode(data.code || data.username);
      setTrialModalVisible(false);
      setTrialSuccessMsg("Teste de 3 horas gerado! Conectando automaticamente...");

      // Inicia login imediatamente com o código retornado
      handleLoginWithCode(trialEmail.trim().toLowerCase(), data.code || data.username);
    } catch (e: any) {
      setError(e?.message || "Falha ao gerar teste gratuito.");
    } finally {
      setTrialLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoWrap}>
          <Logo size={140} />
        </View>
        <Text style={styles.brand}>GoldCast Streaming</Text>
        <Text style={styles.subtitle}>Digite o seu e-mail e código de acesso para entrar.</Text>

        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          <View>
            <Text style={styles.fieldLabel}>Seu E-mail</Text>
            <View style={styles.fieldWrap}>
              <Ionicons name="mail-outline" size={20} color={colors.gold} style={{ marginRight: 10 }} />
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
            <Text style={styles.fieldLabel}>Código de Acesso</Text>
            <View style={styles.fieldWrap}>
              <Ionicons name="key-outline" size={20} color={colors.gold} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="Ex: GOLD-123456"
                placeholderTextColor={colors.textDim}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
            <Text style={styles.hintText}>
              Este código é exclusivo e ficará vinculado ao seu e-mail de acesso.
            </Text>
          </View>
        </View>

        {trialSuccessMsg && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={20} color={colors.gold} />
            <Text style={styles.successText}>{trialSuccessMsg}</Text>
          </View>
        )}

        {loading && stage && (
          <View style={styles.stageBox}>
            <ActivityIndicator color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stageText}>{STAGE_LABEL[stage.s]}</Text>
              {stage.d ? <Text style={styles.stageDetail}>{stage.d}</Text> : null}
            </View>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <GoldButton
          label="ENTRAR NO APLICATIVO"
          onPress={() => handleLoginWithCode()}
          loading={loading}
          style={styles.submitBtn}
        />

        <Pressable
          onPress={() => {
            setTrialEmail(email);
            setTrialModalVisible(true);
          }}
          disabled={loading}
          style={({ focused, pressed }) => [
            styles.trialBtn,
            focused && styles.focused,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons name="sparkles" size={18} color={colors.gold} />
          <Text style={styles.trialBtnText}>SOLICITAR TESTE GRÁTIS (3 HORAS)</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/add-list")}
          style={({ focused }) => [styles.altLink, focused && styles.focused]}
        >
          <Ionicons name="link" size={16} color={colors.gold} />
          <Text style={styles.altText}>Usar lista M3U alternativa</Text>
        </Pressable>
      </ScrollView>

      {/* Modal para solicitar Teste Grátis */}
      <Modal visible={trialModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="sparkles" size={24} color={colors.gold} />
              <Text style={styles.modalTitle}>Teste Grátis de 3 Horas</Text>
            </View>
            <Text style={styles.modalDesc}>
              Informe o seu e-mail abaixo. Nós iremos gerar o seu código de acesso instantâneo.
            </Text>

            <View style={[styles.fieldWrap, { marginBottom: spacing.lg }]}>
              <Ionicons name="mail-outline" size={20} color={colors.gold} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="Seu melhor e-mail"
                placeholderTextColor={colors.textDim}
                value={trialEmail}
                onChangeText={setTrialEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            <GoldButton
              label="GERAR MEU TESTE AGORA"
              onPress={handleRequestTrial}
              loading={trialLoading}
            />

            <Pressable
              onPress={() => setTrialModalVisible(false)}
              style={{ marginTop: 14, alignSelf: "center", padding: 8 }}
            >
              <Text style={{ color: "#8E929C", fontSize: 13, fontWeight: "600" }}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg },
  logoWrap: { alignItems: "center" },
  brand: {
    color: colors.gold,
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.6,
    marginTop: spacing.sm,
  },
  subtitle: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: spacing.xs },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 14 },
  hintText: { color: colors.textDim, fontSize: 11, marginTop: 6 },
  focused: { borderColor: colors.gold, borderWidth: 2 },
  stageBox: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  stageText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  stageDetail: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  errorBox: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: "rgba(244,67,54,0.12)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(244,67,54,0.3)",
  },
  errorText: { color: colors.error, flex: 1, fontSize: 13 },
  successBox: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: "rgba(229, 169, 59, 0.12)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.35)",
  },
  successText: { color: colors.gold, flex: 1, fontSize: 13, fontWeight: "600" },
  submitBtn: {
    marginTop: spacing.xl,
  },
  trialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: "rgba(218, 165, 32, 0.08)",
    marginTop: spacing.md,
  },
  trialBtnText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  altLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  altText: { color: colors.gold, fontSize: 13, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: "#111318",
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.3)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: spacing.xs,
  },
  modalTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
  },
  modalDesc: {
    color: "#8E929C",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
});
