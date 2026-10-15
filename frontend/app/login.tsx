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

interface ServerOption {
  label: string;
  url: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const login = useSession((s) => s.login);

  // Modo ativo no ecrã inicial: "license" (Licença com Código) ou "trial" (Área de Teste Direto)
  const [activeTab, setActiveTab] = useState<"license" | "trial">("license");

  // Etapa interna para clientes com licença aprovada: "form" ou "iptv"
  const [step, setStep] = useState<"form" | "iptv">("form");

  // Campos da Licença (Etapa 1)
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  // Servidores Oficiais Configurados
  const officialServers: ServerOption[] = [
    { label: "Servidor 1", url: "http://natfluxo.store:80" },
    { label: "Servidor 2", url: "http://newbrtop.online:8080" },
  ];

  const [serverList, setServerList] = useState<ServerOption[]>(officialServers);
  const [server, setServer] = useState("http://natfluxo.store:80");
  const [customServer, setCustomServer] = useState(false);

  // Campos de Login (Utilizador e Palavra-passe)
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);

  // Estados de feedback visual
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

        // Se a licença já estiver ativada neste dispositivo, abre diretamente a área de login IPTV completa
        if (savedLicensed === "true") {
          setStep("iptv");
        }

        // Tenta carregar servidores remotos se houver atualização no repositório
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

  // 1. Validação da Licença (E-mail + Código de Acesso no Supabase)
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
    setStatusMsg("A validar licença no servidor...");

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

      await AsyncStorage.setItem("@goldcast_app_licensed", "true");
      await AsyncStorage.setItem("@goldcast_saved_email", cleanEmail);
      await AsyncStorage.setItem("@goldcast_saved_code", cleanCode);

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

  // 2. Conectar Linha IPTV com Licença Oficial (Qualquer validade: 30 dias, 365 dias, etc.)
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

  // 3. Conectar pela ÁREA DE TESTE (Trava rigorosa: Apenas contas de até 24 horas!)
  const handleConnectTrial = async () => {
    setError(null);
    if (!server.trim() || !user.trim() || !pass) {
      setError("Preencha o servidor, o utilizador e a palavra-passe de teste.");
      return;
    }

    setLoading(true);
    setStatusMsg("A autenticar e verificar validade do teste...");

    try {
      // Autentica no servidor IPTV
      await login(server.trim(), user.trim(), pass, false, (s, d) => {
        if (mounted.current) setStatusMsg(d || "A verificar conta...");
      });

      // Validação anti-abuso: Apenas contas de teste com duração máxima de 24 horas (com tolerância de fuso de 2 horas = 26h)
      const currentSession = useSession.getState().session;
      const expDate = currentSession?.userInfo?.exp_date;

      if (!expDate || expDate === "null" || expDate === "") {
        useSession.getState().logout?.();
        throw new Error(
          "Esta área é exclusiva para testes temporários (até 24 horas). A conta introduzida não possui data limite. Para utilizá-la, ative a sua licença na secção principal."
        );
      }

      const expTimestampMs = Number(expDate) * 1000;
      if (isNaN(expTimestampMs)) {
        useSession.getState().logout?.();
        throw new Error("Não foi possível verificar a data de validade da conta.");
      }

      const nowMs = Date.now();
      const diffHours = (expTimestampMs - nowMs) / (1000 * 60 * 60);

      // Se a conta já estiver vencida
      if (diffHours <= 0) {
        useSession.getState().logout?.();
        throw new Error("Esta conta de teste já se encontra expirada.");
      }

      // Se for uma conta mensal/anual (superior a 26 horas)
      if (diffHours > 26) {
        useSession.getState().logout?.();
        const diasRestantes = Math.round(diffHours / 24);
        throw new Error(
          `Esta área destina-se apenas a testes de até 24 horas. Esta conta possui aproximadamente ${diasRestantes} dias de validade. Para usufruir de planos completos, ative a aplicação com um código de licença.`
        );
      }

      // Teste válido (até 24 horas): acesso autorizado
      setTimeout(() => router.replace("/(tabs)"), 350);
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || "Falha ao entrar no modo de teste.");
        setStatusMsg(null);
      }
    } finally {
      if (mounted.current) setLoading(false);
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

        {/* SELETOR DE MODO: LICENÇA OFICIAL OU ÁREA DE TESTE */}
        {step === "form" && (
          <View style={styles.tabSelector}>
            <Pressable
              onPress={() => {
                setActiveTab("license");
                setError(null);
              }}
              style={[styles.tabButton, activeTab === "license" && styles.tabButtonActive]}
            >
              <Text style={[styles.tabButtonText, activeTab === "license" && styles.tabButtonTextActive]}>
                🔑 Licença Oficial
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setActiveTab("trial");
                setError(null);
              }}
              style={[styles.tabButton, activeTab === "trial" && styles.tabButtonActive]}
            >
              <Text style={[styles.tabButtonText, activeTab === "trial" && styles.tabButtonTextActive]}>
                ⏱️ Área de Teste (24h)
              </Text>
            </Pressable>
          </View>
        )}

        {/* ================= 1. ÁREA DE LICENÇA (EXATAMENTE COMO NA FOTO) ================= */}
        {step === "form" && activeTab === "license" && (
          <View style={styles.formWrap}>
            <Text style={styles.subtitle}>
              Digite o seu e-mail e código de acesso para desbloquear a aplicação.
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
                setActiveTab("trial");
                setError(null);
              }}
              style={styles.quickTrialBtn}
            >
              <Text style={styles.quickTrialBtnText}>⚡ Não tem código? Entrar com Teste de 24h →</Text>
            </Pressable>
          </View>
        )}

        {/* ================= 2. ÁREA DE TESTE (SEM NECESSIDADE DE CÓDIGO - MÁX 24H) ================= */}
        {step === "form" && activeTab === "trial" && (
          <View style={styles.formWrap}>
            <View style={styles.trialNoticeBox}>
              <Text style={styles.trialNoticeTitle}>MODO DE TESTE TEMPORÁRIO</Text>
              <Text style={styles.trialNoticeText}>
                Esta área permite testar a aplicação sem código. É permitida apenas a utilização de linhas de teste com validade de até 24 horas.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SERVIDOR DO TESTE</Text>
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
                  else setServer(serverList[0]?.url || "http://natfluxo.store:80");
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
              <Text style={styles.fieldLabel}>UTILIZADOR DO TESTE</Text>
              <View style={styles.inputBox}>
                <Text style={styles.inputEmoji}>👤</Text>
                <TextInput
                  placeholder="Nome de utilizador do teste"
                  placeholderTextColor="#666"
                  value={user}
                  onChangeText={setUser}
                  autoCapitalize="none"
                  style={styles.textInput}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PALAVRA-PASSE DO TESTE</Text>
              <View style={styles.inputBox}>
                <Text style={styles.inputEmoji}>🔒</Text>
                <TextInput
                  placeholder="Palavra-passe do teste"
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

            <Pressable
              style={[styles.btnGold, loading && { opacity: 0.7 }]}
              onPress={handleConnectTrial}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.btnGoldText}>ACEDER AO TESTE (24H)</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setActiveTab("license");
                setError(null);
              }}
              style={{ alignSelf: "center", marginTop: 8, padding: 6 }}
            >
              <Text style={{ color: colors.gold, fontSize: 12 }}>← Voltar à ativação com código</Text>
            </Pressable>
          </View>
        )}

        {/* ================= 3. ÁREA IPTV PARA QUEM JÁ ATIVOU A LICENÇA ================= */}
        {step === "iptv" && (
          <View style={styles.formWrap}>
            <Text style={styles.subtitle}>
              Licença verificada! Insira os dados da sua linha IPTV permanente.
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
                  else setServer(serverList[0]?.url || "http://natfluxo.store:80");
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
                  placeholder="Nome de utilizador IPTV"
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
                  placeholder="A sua palavra-passe IPTV"
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
                <Text style={styles.btnGoldText}>ENTRAR NA APLICAÇÃO</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => setStep("form")}
              style={{ alignSelf: "center", marginTop: 6, padding: 8 }}
            >
              <Text style={{ color: colors.gold, fontSize: 12 }}>← Alterar código de acesso / e-mail</Text>
            </Pressable>
          </View>
        )}

        {/* Feedback visual de progresso */}
        {loading && statusMsg && (
          <View style={styles.statusBox}>
            <ActivityIndicator color={colors.gold} size="small" />
            <Text style={styles.statusText}>{statusMsg}</Text>
          </View>
        )}

        {/* Apresentação de erros */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={{ color: "#F44336", fontSize: 14, marginRight: 6 }}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#07080A",
  },
  content: {
    paddingHorizontal: 20,
  },
  logoWrap: {
    alignItems: "center",
  },
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
  tabSelector: {
    flexDirection: "row",
    backgroundColor: "#16181E",
    borderRadius: 12,
    padding: 4,
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.gold,
  },
  tabButtonText: {
    color: "#8E929C",
    fontSize: 12,
    fontWeight: "700",
  },
  tabButtonTextActive: {
    color: "#000",
  },
  formWrap: {
    gap: 14,
    marginTop: 8,
  },
  trialNoticeBox: {
    backgroundColor: "rgba(229, 169, 59, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.25)",
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  trialNoticeTitle: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  trialNoticeText: {
    color: "#C5C9D3",
    fontSize: 11.5,
    lineHeight: 16,
  },
  fieldGroup: {
    width: "100%",
  },
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
  inputEmoji: {
    fontSize: 16,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 15,
  },
  hintText: {
    color: "#666",
    fontSize: 11,
    marginTop: 4,
  },
  serverChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
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
  serverChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  serverChipText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  customLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    paddingVertical: 4,
  },
  customLinkText: {
    color: "#8E929C",
    fontSize: 11,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#16181E",
    borderRadius: 12,
    padding: 14,
  },
  rememberTitle: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
  },
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
  quickTrialBtn: {
    alignSelf: "center",
    paddingVertical: 8,
    marginTop: 4,
  },
  quickTrialBtnText: {
    color: colors.gold,
    fontSize: 12.5,
    fontWeight: "600",
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
  statusText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
  },
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
  errorText: {
    color: "#F44336",
    flex: 1,
    fontSize: 12,
  },
});
