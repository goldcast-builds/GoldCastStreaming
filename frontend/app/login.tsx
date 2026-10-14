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
  Switch,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Logo } from "../src/components/Logo";
import { GoldButton } from "../src/components/GoldButton";
import { colors, radius, spacing } from "../src/utils/theme";
import { DEFAULT_SERVERS, SERVER_LABELS, Stage } from "../src/services/xtream";
import { useSession } from "../src/store/session";

const STAGE_LABEL: Record<Stage, string> = {
  checking: "Verificando...",
  connecting: "Conectando ao servidor...",
  validating: "Validando credenciais...",
  loading: "Carregando canais e filmes...",
  done: "Conectado!",
};

const REMOTE_SERVERS_URL =
  "https://raw.githubusercontent.com/anderson009470/GoldCastStreaming/main/servers.json";
const VALIDATE_CODE_URL =
  "https://lljsnoovvwexzebzbaal.supabase.co/functions/v1/validate-code";
const REQUEST_TRIAL_URL =
  "https://lljsnoovvwexzebzbaal.supabase.co/functions/v1/request-trial";

interface ServerOption {
  label: string;
  url: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const login = useSession((s) => s.login);

  // Etapa 1: "license" (E-mail + Código) | Etapa 2: "credentials" (Servidor, Usuário, Senha)
  const [step, setStep] = useState<"license" | "credentials">("license");

  // Dados da Etapa 1 (Licença)
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  // Dados da Etapa 2 (IPTV)
  const defaultList: ServerOption[] = [
    { label: SERVER_LABELS[DEFAULT_SERVERS.primary] || "Servidor 1", url: DEFAULT_SERVERS.primary },
    { label: SERVER_LABELS[DEFAULT_SERVERS.backup] || "Servidor 2", url: DEFAULT_SERVERS.backup },
  ];
  const [serverList, setServerList] = useState<ServerOption[]>(defaultList);
  const [server, setServer] = useState(DEFAULT_SERVERS.primary);
  const [customServer, setCustomServer] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);

  // Estados gerais
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<{ s: Stage; d?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal de Teste Grátis
  const [trialModal, setTrialModal] = useState(false);
  const [trialEmail, setTrialEmail] = useState("");
  const [trialLoading, setTrialLoading] = useState(false);

  const mounted = useRef(true);

  useEffect(() => {
    (async () => {
      try {
        const [savedLicense, savedEmail, savedCode] = await Promise.all([
          AsyncStorage.getItem("@goldcast_licensed"),
          AsyncStorage.getItem("@goldcast_saved_email"),
          AsyncStorage.getItem("@goldcast_saved_code"),
        ]);

        if (savedEmail) setEmail(savedEmail);
        if (savedCode) setCode(savedCode);

        // Se o aplicativo já foi ativado anteriormente, abre direto na tela de login IPTV
        if (savedLicense === "true") {
          setStep("credentials");
        }

        // Carrega servidores remotos
        const res = await fetch(`${REMOTE_SERVERS_URL}?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setServerList(data);
            setServer(data[0].url);
          }
        }
      } catch {}
    })();

    return () => {
      mounted.current = false;
    };
  }, []);

  // 1. Validação da Licença (E-mail + Código de Acesso)
  const handleValidateLicense = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();

    setError(null);
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Por favor, digite um e-mail válido.");
      return;
    }
    if (!cleanCode) {
      setError("Por favor, informe seu código de acesso.");
      return;
    }

    setLoading(true);
    setStage({ s: "checking", d: "Validando seu código de acesso..." });

    try {
      const res = await fetch(VALIDATE_CODE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Código ou e-mail inválido.");
      }

      // Salva localmente que o app foi ativado
      await AsyncStorage.setItem("@goldcast_licensed", "true");
      await AsyncStorage.setItem("@goldcast_saved_email", cleanEmail);
      await AsyncStorage.setItem("@goldcast_saved_code", cleanCode);

      // Avança imediatamente para a Etapa 2 (Login IPTV)
      setStep("credentials");
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || "Falha na validação do código.");
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
        setStage(null);
      }
    }
  };

  // 2. Conexão IPTV com Servidor, Usuário e Senha
  const handleConnectIPTV = async () => {
    setError(null);
    if (!server.trim() || !user.trim() || !pass) {
      setError("Preencha o servidor, usuário e senha da sua linha IPTV.");
      return;
    }

    setLoading(true);
    try {
      await login(server.trim(), user.trim(), pass, remember, (s, d) => {
        if (mounted.current) setStage({ s, d });
      });
      setTimeout(() => router.replace("/(tabs)"), 350);
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || "Falha ao conectar com o servidor IPTV.");
        setStage(null);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  // 3. Teste Grátis de 3 Horas
  const handleRequestTrial = async () => {
    if (!trialEmail.trim() || !trialEmail.includes("@")) {
      setError("Digite um e-mail válido para o teste.");
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
        throw new Error(data.message || "Não foi possível gerar teste.");
      }

      setTrialModal(false);

      // Preenche os dados gerados e conecta direto
      setServer(data.serverUrl || server);
      setUser(data.username);
      setPass(data.password);

      await login(data.serverUrl || server, data.username, data.password, true, (s, d) => {
        if (mounted.current) setStage({ s, d });
      });
      setTimeout(() => router.replace("/(tabs)"), 350);
    } catch (e: any) {
      setError(e?.message || "Erro ao solicitar teste gratuito.");
    } finally {
      setTrialLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoWrap}>
          <Logo size={130} />
        </View>
        <Text style={styles.brand}>GoldCast Streaming</Text>

        {/* ================= ETAPA 1: E-MAIL E CÓDIGO DE ACESSO ================= */}
        {step === "license" ? (
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            <Text style={styles.subtitle}>
              Digite seu e-mail e código de acesso para desbloquear o aplicativo.
            </Text>

            <View>
              <Text style={styles.fieldLabel}>SEU E-MAIL</Text>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldEmoji}>✉️</Text>
                <TextInput
                  placeholder="exemplo@gmail.com"
                  placeholderTextColor={colors.textDim}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>
            </View>

            <View>
              <Text style={styles.fieldLabel}>CÓDIGO DE ACESSO</Text>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldEmoji}>🔑</Text>
                <TextInput
                  placeholder="Ex: GOLD-VIP-365D"
                  placeholderTextColor={colors.textDim}
                  value={code}
                  onChangeText={(t) => setCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  style={styles.input}
                />
              </View>
              <Text style={styles.hintText}>O código ficará vinculado ao seu e-mail de acesso.</Text>
            </View>

            <GoldButton
              label="VALIDAR E CONTINUAR"
              onPress={handleValidateLicense}
              loading={loading}
              style={{ marginTop: spacing.md }}
            />

            <Pressable
              onPress={() => {
                setTrialEmail(email);
                setTrialModal(true);
              }}
              style={styles.trialBtn}
            >
              <Text style={styles.trialBtnText}>✨ SOLICITAR TESTE GRÁTIS (3 HORAS)</Text>
            </Pressable>
          </View>
        ) : (
          /* ================= ETAPA 2: SERVIDOR, USUÁRIO E SENHA ================= */
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            <Text style={styles.subtitle}>
              Insira os dados da sua linha IPTV para carregar as transmissões.
            </Text>

            <Text style={styles.fieldLabel}>SERVIDOR</Text>
            <View style={styles.serverChips}>
              {serverList.map((item, i) => {
                const active = !customServer && server === item.url;
                return (
                  <Pressable
                    key={`${item.url}-${i}`}
                    onPress={() => {
                      setCustomServer(false);
                      setServer(item.url);
                    }}
                    style={[styles.serverBtn, active && styles.serverBtnActive]}
                  >
                    <Text style={{ fontSize: 14 }}>📺</Text>
                    <Text style={[styles.serverText, active && { color: "#000" }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => {
                setCustomServer((v) => !v);
                if (!customServer) setServer("");
                else setServer(serverList[0]?.url || DEFAULT_SERVERS.primary);
              }}
              style={styles.customLink}
            >
              <Text style={styles.customText}>
                {customServer ? "▲ Usar lista de servidores" : "▼ Inserir outro servidor"}
              </Text>
            </Pressable>

            {customServer && (
              <View style={styles.fieldWrap}>
                <TextInput
                  placeholder="http://seuservidor.com:8080"
                  placeholderTextColor={colors.textDim}
                  value={server}
                  onChangeText={setServer}
                  autoCapitalize="none"
                  keyboardType="url"
                  style={styles.input}
                />
              </View>
            )}

            <View>
              <Text style={styles.fieldLabel}>USUÁRIO</Text>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldEmoji}>👤</Text>
                <TextInput
                  placeholder="Nome de usuário IPTV"
                  placeholderTextColor={colors.textDim}
                  value={user}
                  onChangeText={setUser}
                  autoCapitalize="none"
                  style={styles.input}
                />
              </View>
            </View>

            <View>
              <Text style={styles.fieldLabel}>SENHA</Text>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldEmoji}>🔒</Text>
                <TextInput
                  placeholder="Sua senha IPTV"
                  placeholderTextColor={colors.textDim}
                  value={pass}
                  onChangeText={setPass}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  style={styles.input}
                />
                <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8}>
                  <Text style={{ fontSize: 16 }}>{showPass ? "🙈" : "👁️"}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.rememberRow}>
              <Text style={styles.rememberTitle}>Lembrar credenciais</Text>
              <Switch
                value={remember}
                onValueChange={setRemember}
                trackColor={{ true: colors.gold, false: colors.surface3 }}
                thumbColor={colors.text}
              />
            </View>

            <GoldButton
              label="ENTRAR NO APLICATIVO"
              onPress={handleConnectIPTV}
              loading={loading}
              style={{ marginTop: spacing.sm }}
            />

            <Pressable
              onPress={() => setStep("license")}
              style={{ alignSelf: "center", marginTop: spacing.xs, padding: 8 }}
            >
              <Text style={{ color: colors.gold, fontSize: 12 }}>← Alterar código de acesso / e-mail</Text>
            </Pressable>
          </View>
        )}

        {/* Feedback visual durante o carregamento */}
        {loading && stage && (
          <View style={styles.stageBox}>
            <ActivityIndicator color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stageText}>{STAGE_LABEL[stage.s]}</Text>
              {stage.d ? <Text style={styles.stageDetail}>{stage.d}</Text> : null}
            </View>
          </View>
        )}

        {/* Mensagens de erro */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={{ color: colors.error, fontSize: 13, marginRight: 6 }}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable onPress={() => router.push("/add-list")} style={styles.altLink}>
          <Text style={styles.altText}>🔗 Usar lista M3U alternativa</Text>
        </Pressable>
      </ScrollView>

      {/* Modal de Teste Grátis */}
      <Modal visible={trialModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Teste Grátis de 3 Horas</Text>
            <Text style={styles.modalDesc}>Informe o seu e-mail para receber um teste instantâneo.</Text>

            <View style={[styles.fieldWrap, { marginBottom: spacing.lg }]}>
              <Text style={styles.fieldEmoji}>✉️</Text>
              <TextInput
                placeholder="Seu melhor e-mail"
                placeholderTextColor={colors.textDim}
                value={trialEmail}
                onChangeText={setTrialEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
            </View>

            <GoldButton label="GERAR TESTE AGORA" onPress={handleRequestTrial} loading={trialLoading} />

            <Pressable
              onPress={() => setTrialModal(false)}
              style={{ marginTop: 12, alignSelf: "center", padding: 6 }}
            >
              <Text style={{ color: "#8E929C", fontSize: 13 }}>Cancelar</Text>
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
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.6,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 6,
    fontWeight: "700",
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
  fieldEmoji: {
    fontSize: 16,
    marginRight: 10,
  },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12 },
  hintText: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  serverChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  serverBtn: {
    flex: 1,
    minWidth: 110,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
  },
  serverBtnActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  serverText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  customLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    paddingVertical: 2,
  },
  customText: { color: colors.textDim, fontSize: 11 },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rememberTitle: { color: colors.text, fontSize: 13, fontWeight: "600" },
  stageBox: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  stageText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  stageDetail: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  errorBox: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: "rgba(244,67,54,0.12)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(244,67,54,0.3)",
  },
  errorText: { color: colors.error, flex: 1, fontSize: 12 },
  trialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: "rgba(218, 165, 32, 0.08)",
  },
  trialBtnText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  altLink: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  altText: { color: colors.gold, fontSize: 13, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: "#111318",
    width: "100%",
    maxWidth: 380,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.3)",
  },
  modalTitle: { color: "#FFF", fontSize: 18, fontWeight: "700", marginBottom: 6 },
  modalDesc: { color: "#8E929C", fontSize: 12, lineHeight: 18, marginBottom: spacing.lg },
});
