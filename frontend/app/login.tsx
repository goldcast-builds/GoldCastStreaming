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
import { colors } from "../src/utils/theme";
import { useSession } from "../src/store/session";

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

  // Controla se exibe a Etapa 1 (Licença) ou Etapa 2 (Dados IPTV)
  const [step, setStep] = useState<"license" | "iptv">("license");

  // Campos da Etapa 1
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  // Campos da Etapa 2
  const [serverList, setServerList] = useState<ServerOption[]>([
    { label: "Servidor Principal", url: "http://vip.topuhd.top" },
  ]);
  const [server, setServer] = useState("http://vip.topuhd.top");
  const [customServer, setCustomServer] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);

  // Estados gerais
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal Teste Grátis
  const [trialModal, setTrialModal] = useState(false);
  const [trialEmail, setTrialEmail] = useState("");
  const [trialLoading, setTrialLoading] = useState(false);

  const mounted = useRef(true);

  useEffect(() => {
    (async () => {
      try {
        const [savedLicensed, savedEmail, savedCode] = await Promise.all([
          AsyncStorage.getItem("@goldcast_app_licensed"),
          AsyncStorage.getItem("@goldcast_saved_email"),
          AsyncStorage.getItem("@goldcast_saved_code"),
        ]);

        if (savedEmail) setEmail(savedEmail);
        if (savedCode) setCode(savedCode);

        // Se o aplicativo já foi validado neste celular, vai direto para a tela de login IPTV
        if (savedLicensed === "true") {
          setStep("iptv");
        }

        // Tenta carregar lista remota de servidores
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
      setError("Informe um endereço de e-mail válido.");
      return;
    }
    if (!cleanCode) {
      setError("Informe o seu código de acesso.");
      return;
    }

    setLoading(true);
    setStatusMsg("A validar código no servidor...");

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

      // Licença aprovada: salva no aparelho
      await AsyncStorage.setItem("@goldcast_app_licensed", "true");
      await AsyncStorage.setItem("@goldcast_saved_email", cleanEmail);
      await AsyncStorage.setItem("@goldcast_saved_code", cleanCode);

      // Avança diretamente para os campos de Servidor, Usuário e Senha!
      setStep("iptv");
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || "Falha na validação do código de acesso.");
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
        setStatusMsg(null);
      }
    }
  };

  // 2. Conexão IPTV Permanente (Servidor, Usuário e Senha)
  const handleConnectIPTV = async () => {
    setError(null);
    if (!server.trim() || !user.trim() || !pass) {
      setError("Preencha o servidor, o utilizador e a palavra-passe.");
      return;
    }

    setLoading(true);
    setStatusMsg("A ligar ao servidor IPTV...");

    try {
      await login(server.trim(), user.trim(), pass, remember, (s, d) => {
        if (mounted.current) setStatusMsg(d || "A carregar...");
      });
      setTimeout(() => router.replace("/(tabs)"), 350);
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || "Falha ao ligar ao servidor IPTV. Verifique os dados.");
        setStatusMsg(null);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  // 3. Gerador do Teste Grátis de 3 Horas
  const handleGenerateTrial = async () => {
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
        throw new Error(data.message || "Não foi possível gerar o teste.");
      }

      setTrialModal(false);
      setStep("iptv");

      // Preenche os dados gerados pelo painel e entra
      const targetServer = data.serverUrl || server;
      setServer(targetServer);
      setUser(data.username);
      setPass(data.password);

      setLoading(true);
      await login(targetServer, data.username, data.password, true, (s, d) => {
        if (mounted.current) setStatusMsg(d || "A carregar...");
      });
      setTimeout(() => router.replace("/(tabs)"), 350);
    } catch (e: any) {
      setError(e?.message || "Erro ao solicitar teste gratuito.");
    } finally {
      setTrialLoading(false);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoWrap}>
          <Logo size={130} />
        </View>
        <Text style={styles.brand}>GoldCast Streaming</Text>

        {/* ================= ETAPA 1: E-MAIL E CÓDIGO ================= */}
        {step === "license" ? (
          <View style={styles.formWrap}>
            <Text style={styles.subtitle}>
              Digite seu e-mail e código de acesso para desbloquear o aplicativo.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SEU E-MAIL</Text>
              <View style={styles.inputBox}>
                <Text style={styles.inputEmoji}>✉️</Text>
                <TextInput
                  placeholder="exemplo@gmail.com"
                  placeholderTextColor="#666"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.textInput}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CÓDIGO DE ACESSO</Text>
              <View style={styles.inputBox}>
                <Text style={styles.inputEmoji}>🔑</Text>
                <TextInput
                  placeholder="Ex: GOLD-VIP-365D"
                  placeholderTextColor="#666"
                  value={code}
                  onChangeText={(t) => setCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  style={styles.textInput}
                />
              </View>
              <Text style={styles.hintText}>O código ficará vinculado ao seu e-mail de acesso.</Text>
            </View>

            <Pressable
              style={[styles.btnGold, loading && { opacity: 0.7 }]}
              onPress={handleValidateLicense}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.btnGoldText}>VALIDAR E CONTINUAR</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setTrialEmail(email);
                setTrialModal(true);
              }}
              style={styles.btnOutline}
            >
              <Text style={styles.btnOutlineText}>✨ SOLICITAR TESTE GRÁTIS (3 HORAS)</Text>
            </Pressable>
          </View>
        ) : (
          /* ================= ETAPA 2: SERVIDOR, USUÁRIO E SENHA ================= */
          <View style={styles.formWrap}>
            <Text style={styles.subtitle}>
              Insira os dados da sua linha IPTV para carregar as transmissões.
            </Text>

            <View style={styles.fieldGroup}>
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
                      style={[styles.serverChip, active && styles.serverChipActive]}
                    >
                      <Text style={{ fontSize: 13 }}>📺</Text>
                      <Text style={[styles.serverChipText, active && { color: "#000" }]} numberOfLines={1}>
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
                  else setServer(serverList[0]?.url || "http://vip.topuhd.top");
                }}
                style={styles.customLink}
              >
                <Text style={styles.customLinkText}>
                  {customServer ? "▲ Usar lista de servidores" : "▼ Inserir outro servidor"}
                </Text>
              </Pressable>

              {customServer && (
                <View style={[styles.inputBox, { marginTop: 8 }]}>
                  <TextInput
                    placeholder="http://seuservidor.com:8080"
                    placeholderTextColor="#666"
                    value={server}
                    onChangeText={setServer}
                    autoCapitalize="none"
                    keyboardType="url"
                    style={styles.textInput}
                  />
                </View>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>UTILIZADOR</Text>
              <View style={styles.inputBox}>
                <Text style={styles.inputEmoji}>👤</Text>
                <TextInput
                  placeholder="Nome de usuário IPTV"
                  placeholderTextColor="#666"
                  value={user}
                  onChangeText={setUser}
                  autoCapitalize="none"
                  style={styles.textInput}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PALAVRA-PASSE</Text>
              <View style={styles.inputBox}>
                <Text style={styles.inputEmoji}>🔒</Text>
                <TextInput
                  placeholder="Sua senha IPTV"
                  placeholderTextColor="#666"
                  value={pass}
                  onChangeText={setPass}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  style={styles.textInput}
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
                trackColor={{ true: colors.gold, false: "#222" }}
                thumbColor="#FFF"
              />
            </View>

            <Pressable
              style={[styles.btnGold, loading && { opacity: 0.7 }]}
              onPress={handleConnectIPTV}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.btnGoldText}>ENTRAR NO APLICATIVO</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => setStep("license")}
              style={{ alignSelf: "center", marginTop: 6, padding: 8 }}
            >
              <Text style={{ color: colors.gold, fontSize: 12 }}>← Alterar código de acesso / e-mail</Text>
            </Pressable>
          </View>
        )}

        {/* Feedback visual durante requisições */}
        {loading && statusMsg && (
          <View style={styles.statusBox}>
            <ActivityIndicator color={colors.gold} size="small" />
            <Text style={styles.statusText}>{statusMsg}</Text>
          </View>
        )}

        {/* Erros em destaque */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={{ color: "#F44336", fontSize: 14, marginRight: 6 }}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable onPress={() => router.push("/add-list")} style={styles.altLink}>
          <Text style={styles.altText}>🔗 Usar lista M3U alternativa</Text>
        </Pressable>
      </ScrollView>

      {/* Modal de Teste Gratuito */}
      <Modal visible={trialModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Teste Grátis de 3 Horas</Text>
            <Text style={styles.modalDesc}>Informe o seu e-mail para receber um teste instantâneo.</Text>

            <View style={[styles.inputBox, { marginBottom: 16 }]}>
              <Text style={styles.inputEmoji}>✉️</Text>
              <TextInput
                placeholder="Seu melhor e-mail"
                placeholderTextColor="#666"
                value={trialEmail}
                onChangeText={setTrialEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.textInput}
              />
            </View>

            <Pressable
              style={[styles.btnGold, trialLoading && { opacity: 0.7 }]}
              onPress={handleGenerateTrial}
              disabled={trialLoading}
            >
              {trialLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.btnGoldText}>GERAR TESTE AGORA</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => setTrialModal(false)}
              style={{ marginTop: 14, alignSelf: "center", padding: 6 }}
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
  root: { flex: 1, backgroundColor: "#07080A" },
  content: { paddingHorizontal: 20 },
  logoWrap: { alignItems: "center" },
  brand: {
    color: colors.gold,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 4,
  },
  subtitle: {
    color: "#8E929C",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  formWrap: { gap: 14, marginTop: 8 },
  fieldGroup: { width: "100%" },
  fieldLabel: {
    color: "#8E929C",
    fontSize: 11,
    marginBottom: 6,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16181E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 14,
    height: 52,
  },
  inputEmoji: { fontSize: 16, marginRight: 10 },
  textInput: { flex: 1, color: "#FFF", fontSize: 15 },
  hintText: { color: "#666", fontSize: 11, marginTop: 4 },
  serverChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  serverChip: {
    flex: 1,
    minWidth: 110,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#16181E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 8,
  },
  serverChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  serverChipText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  customLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    paddingVertical: 4,
  },
  customLinkText: { color: "#8E929C", fontSize: 11 },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#16181E",
    borderRadius: 12,
    padding: 14,
  },
  rememberTitle: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  btnGold: {
    backgroundColor: colors.gold,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  btnGoldText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  btnOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: "rgba(218, 165, 32, 0.08)",
  },
  btnOutlineText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statusBox: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: "#16181E",
    borderRadius: 12,
  },
  statusText: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  errorBox: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "rgba(244,67,54,0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(244,67,54,0.3)",
  },
  errorText: { color: "#F44336", flex: 1, fontSize: 12 },
  altLink: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    padding: 8,
  },
  altText: { color: colors.gold, fontSize: 13, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#111318",
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.3)",
  },
  modalTitle: { color: "#FFF", fontSize: 18, fontWeight: "700", marginBottom: 6 },
  modalDesc: { color: "#8E929C", fontSize: 12, lineHeight: 18, marginBottom: 16 },
});
