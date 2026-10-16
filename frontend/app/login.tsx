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

  // Modo ativo: "license" (Licença com Código) ou "trial" (Área de Teste Direto)
  const [activeTab, setActiveTab] = useState<"license" | "trial">("license");
  const [step, setStep] = useState<"form" | "iptv">("form");

  // Campos de texto
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);

  // Estados de Foco para Controles Remotos (TV / Projetor)
  const [focusedField, setFocusedField] = useState<string | null>("email");

  // Servidores
  const officialServers: ServerOption[] = [
    { label: "Servidor 1", url: "http://natfluxo.store:80" },
    { label: "Servidor 2", url: "http://newbrtop.online:8080" },
  ];

  const [serverList, setServerList] = useState<ServerOption[]>(officialServers);
  const [server, setServer] = useState("http://natfluxo.store:80");
  const [customServer, setCustomServer] = useState(false);

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

        if (savedLicensed === "true") {
          setStep("iptv");
        }

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

  // 1. Validar Licença Oficial
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

  // 2. Conectar IPTV Permanente
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

  // 3. Conectar Teste (Máximo 24 Horas)
  const handleConnectTrial = async () => {
    setError(null);
    if (!server.trim() || !user.trim() || !pass) {
      setError("Preencha o servidor, o utilizador e a palavra-passe de teste.");
      return;
    }

    setLoading(true);
    setStatusMsg("A verificar validade do teste...");

    try {
      await login(server.trim(), user.trim(), pass, false, (s, d) => {
        if (mounted.current) setStatusMsg(d || "A verificar conta...");
      });

      const currentSession = useSession.getState().session;
      const expDate = currentSession?.userInfo?.exp_date;

      if (!expDate || expDate === "null" || expDate === "") {
        useSession.getState().logout?.();
        throw new Error(
          "Esta área é exclusiva para testes de até 24 horas. A conta inserida não possui data limite. Utilize a secção de licença oficial."
        );
      }

      const expTimestampMs = Number(expDate) * 1000;
      if (isNaN(expTimestampMs)) {
        useSession.getState().logout?.();
        throw new Error("Não foi possível verificar a data de validade da conta.");
      }

      const nowMs = Date.now();
      const diffHours = (expTimestampMs - nowMs) / (1000 * 60 * 60);

      if (diffHours <= 0) {
        useSession.getState().logout?.();
        throw new Error("Esta conta de teste já se encontra expirada.");
      }

      if (diffHours > 26) {
        useSession.getState().logout?.();
        const diasRestantes = Math.round(diffHours / 24);
        throw new Error(
          `Esta área destina-se apenas a testes temporários. Esta conta possui aproximadamente ${diasRestantes} dias de validade. Adquira ou insira uma licença oficial.`
        );
      }

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

        {/* SELETOR DE MODO (ABAS) */}
        {step === "form" && (
          <View style={styles.tabSelector}>
            <Pressable
              focusable={true}
              onFocus={() => setFocusedField("tab_license")}
              onPress={() => {
                setActiveTab("license");
                setError(null);
              }}
              style={[
                styles.tabButton,
                activeTab === "license" && styles.tabButtonActive,
                focusedField === "tab_license" && styles.tabButtonFocused,
              ]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === "license" && styles.tabButtonTextActive,
                  focusedField === "tab_license" && { color: "#000", fontWeight: "900" },
                ]}
              >
                🔑 Licença Oficial
              </Text>
            </Pressable>

            <Pressable
              focusable={true}
              onFocus={() => setFocusedField("tab_trial")}
              onPress={() => {
                setActiveTab("trial");
                setError(null);
              }}
              style={[
                styles.tabButton,
                activeTab === "trial" && styles.tabButtonActive,
                focusedField === "tab_trial" && styles.tabButtonFocused,
              ]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === "trial" && styles.tabButtonTextActive,
                  focusedField === "tab_trial" && { color: "#000", fontWeight: "900" },
                ]}
              >
                ⏱️ Área de Teste (24h)
              </Text>
            </Pressable>
          </View>
        )}

        {/* 1. FLUXO DE LICENÇA (CÓDIGO + E-MAIL) */}
        {step === "form" && activeTab === "license" && (
          <View style={styles.formWrap}>
            <Text style={styles.subtitle}>
              Digite o seu e-mail e código de acesso para desbloquear a aplicação.
            </Text>

            {/* CAMPO DE E-MAIL */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SEU E-MAIL</Text>
              <View
                style={[
                  styles.inputBox,
                  focusedField === "email" && styles.inputBoxFocused,
                ]}
              >
                <Text style={styles.inputEmoji}>✉️</Text>
                <TextInput
                  focusable={true}
                  onFocus={() => setFocusedField("email")}
                  placeholder="exemplo@gmail.com"
                  placeholderTextColor="#777"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.textInput}
                />
              </View>
            </View>

            {/* CAMPO DE CÓDIGO */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CÓDIGO DE ACESSO</Text>
              <View
                style={[
                  styles.inputBox,
                  focusedField === "code" && styles.inputBoxFocused,
                ]}
              >
                <Text style={styles.inputEmoji}>🔑</Text>
                <TextInput
                  focusable={true}
                  onFocus={() => setFocusedField("code")}
                  placeholder="Ex: GOLD-VIP-365D"
                  placeholderTextColor="#777"
                  value={code}
                  onChangeText={(t) => setCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  style={styles.textInput}
                />
              </View>
              <Text style={styles.hintText}>O código ficará vinculado ao seu e-mail de acesso.</Text>
            </View>

            {/* BOTÃO VALIDAR */}
            <Pressable
              focusable={true}
              onFocus={() => setFocusedField("btn_validate")}
              style={[
                styles.btnGold,
                focusedField === "btn_validate" && styles.btnGoldFocused,
                loading && { opacity: 0.7 },
              ]}
              onPress={handleValidateLicense}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text
                  style={[
                    styles.btnGoldText,
                    focusedField === "btn_validate" && { color: "#000", fontWeight: "900" },
                  ]}
                >
                  VALIDAR E CONTINUAR
                </Text>
              )}
            </Pressable>

            <Pressable
              focusable={true}
              onFocus={() => setFocusedField("btn_go_trial")}
              onPress={() => {
                setActiveTab("trial");
                setError(null);
              }}
              style={[
                styles.quickTrialBtn,
                focusedField === "btn_go_trial" && styles.quickTrialBtnFocused,
              ]}
            >
              <Text style={styles.quickTrialBtnText}>⚡ Não tem código? Entrar com Teste de 24h →</Text>
            </Pressable>
          </View>
        )}

        {/* 2. ÁREA DE TESTE (SERVIDOR, UTILIZADOR E SENHA - MÁX 24H) */}
        {step === "form" && activeTab === "trial" && (
          <View style={styles.formWrap}>
            <View style={styles.trialNoticeBox}>
              <Text style={styles.trialNoticeTitle}>MODO DE TESTE TEMPORÁRIO</Text>
              <Text style={styles.trialNoticeText}>
                Esta área permite testar a aplicação sem código. É permitida apenas a utilização de linhas de teste com validade de até 24 horas.
              </Text>
            </View>

            {/* SELEÇÃO DE SERVIDOR */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SERVIDOR DO TESTE</Text>
              <View style={styles.serverChips}>
                {serverList.map((item, i) => {
                  const active = !customServer && server === item.url;
                  const chipKey = `trial_server_${i}`;
                  return (
                    <Pressable
                      key={`${item.url}-${i}`}
                      focusable={true}
                      onFocus={() => setFocusedField(chipKey)}
                      onPress={() => {
                        setCustomServer(false);
                        setServer(item.url);
                      }}
                      style={[
                        styles.serverChip,
                        active && styles.serverChipActive,
                        focusedField === chipKey && styles.serverChipFocused,
                      ]}
                    >
                      <Text style={{ fontSize: 13 }}>📺</Text>
                      <Text
                        style={[
                          styles.serverChipText,
                          (active || focusedField === chipKey) && { color: "#000", fontWeight: "800" },
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                focusable={true}
                onFocus={() => setFocusedField("toggle_custom_trial")}
                onPress={() => {
                  setCustomServer((v) => !v);
                  if (!customServer) setServer("");
                  else setServer(serverList[0]?.url || "http://natfluxo.store:80");
                }}
                style={[
                  styles.customLink,
                  focusedField === "toggle_custom_trial" && { backgroundColor: "rgba(229,169,59,0.2)", borderRadius: 6 },
                ]}
              >
                <Text style={styles.customLinkText}>
                  {customServer ? "▲ Usar lista de servidores" : "▼ Inserir outro servidor"}
                </Text>
              </Pressable>

              {customServer && (
                <View
                  style={[
                    styles.inputBox,
                    { marginTop: 8 },
                    focusedField === "trial_custom_server" && styles.inputBoxFocused,
                  ]}
                >
                  <TextInput
                    focusable={true}
                    onFocus={() => setFocusedField("trial_custom_server")}
                    placeholder="http://seuservidor.com:8080"
                    placeholderTextColor="#777"
                    value={server}
                    onChangeText={setServer}
                    autoCapitalize="none"
                    keyboardType="url"
                    style={styles.textInput}
                  />
                </View>
              )}
            </View>

            {/* CAMPO DE UTILIZADOR */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>UTILIZADOR DO TESTE</Text>
              <View
                style={[
                  styles.inputBox,
                  focusedField === "trial_user" && styles.inputBoxFocused,
                ]}
              >
                <Text style={styles.inputEmoji}>👤</Text>
                <TextInput
                  focusable={true}
                  onFocus={() => setFocusedField("trial_user")}
                  placeholder="Nome de utilizador do teste"
                  placeholderTextColor="#777"
                  value={user}
                  onChangeText={setUser}
                  autoCapitalize="none"
                  style={styles.textInput}
                />
              </View>
            </View>

            {/* CAMPO DE PALAVRA-PASSE */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PALAVRA-PASSE DO TESTE</Text>
              <View
                style={[
                  styles.inputBox,
                  focusedField === "trial_pass" && styles.inputBoxFocused,
                ]}
              >
                <Text style={styles.inputEmoji}>🔒</Text>
                <TextInput
                  focusable={true}
                  onFocus={() => setFocusedField("trial_pass")}
                  placeholder="Palavra-passe do teste"
                  placeholderTextColor="#777"
                  value={pass}
                  onChangeText={setPass}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  style={styles.textInput}
                />
                <Pressable focusable={true} onPress={() => setShowPass((v) => !v)} hitSlop={8}>
                  <Text style={{ fontSize: 16 }}>{showPass ? "🙈" : "👁️"}</Text>
                </Pressable>
              </View>
            </View>

            {/* BOTÃO ACEDER AO TESTE */}
            <Pressable
              focusable={true}
              onFocus={() => setFocusedField("btn_connect_trial")}
              style={[
                styles.btnGold,
                focusedField === "btn_connect_trial" && styles.btnGoldFocused,
                loading && { opacity: 0.7 },
              ]}
              onPress={handleConnectTrial}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text
                  style={[
                    styles.btnGoldText,
                    focusedField === "btn_connect_trial" && { color: "#000", fontWeight: "900" },
                  ]}
                >
                  ACEDER AO TESTE (24H)
                </Text>
              )}
            </Pressable>

            <Pressable
              focusable={true}
              onFocus={() => setFocusedField("btn_back_to_license")}
              onPress={() => {
                setActiveTab("license");
                setError(null);
              }}
              style={[
                { alignSelf: "center", marginTop: 8, padding: 8, borderRadius: 8 },
                focusedField === "btn_back_to_license" && { backgroundColor: "rgba(229,169,59,0.25)" },
              ]}
            >
              <Text style={{ color: colors.gold, fontSize: 12, fontWeight: "700" }}>
                ← Voltar à ativação com código
              </Text>
            </Pressable>
          </View>
        )}

        {/* 3. FLUXO IPTV (PARA QUEM JÁ ATIVOU LICENÇA) */}
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
                  const chipKey = `iptv_server_${i}`;
                  return (
                    <Pressable
                      key={`${item.url}-${i}`}
                      focusable={true}
                      onFocus={() => setFocusedField(chipKey)}
                      onPress={() => {
                        setCustomServer(false);
                        setServer(item.url);
                      }}
                      style={[
                        styles.serverChip,
                        active && styles.serverChipActive,
                        focusedField === chipKey && styles.serverChipFocused,
                      ]}
                    >
                      <Text style={{ fontSize: 13 }}>📺</Text>
                      <Text
                        style={[
                          styles.serverChipText,
                          (active || focusedField === chipKey) && { color: "#000", fontWeight: "800" },
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                focusable={true}
                onFocus={() => setFocusedField("toggle_custom_iptv")}
                onPress={() => {
                  setCustomServer((v) => !v);
                  if (!customServer) setServer("");
                  else setServer(serverList[0]?.url || "http://natfluxo.store:80");
                }}
                style={[
                  styles.customLink,
                  focusedField === "toggle_custom_iptv" && { backgroundColor: "rgba(229,169,59,0.2)", borderRadius: 6 },
                ]}
              >
                <Text style={styles.customLinkText}>
                  {customServer ? "▲ Usar lista de servidores" : "▼ Inserir outro servidor"}
                </Text>
              </Pressable>

              {customServer && (
                <View
                  style={[
                    styles.inputBox,
                    { marginTop: 8 },
                    focusedField === "iptv_custom_server" && styles.inputBoxFocused,
                  ]}
                >
                  <TextInput
                    focusable={true}
                    onFocus={() => setFocusedField("iptv_custom_server")}
                    placeholder="http://seuservidor.com:8080"
                    placeholderTextColor="#777"
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
              <View
                style={[
                  styles.inputBox,
                  focusedField === "iptv_user" && styles.inputBoxFocused,
                ]}
              >
                <Text style={styles.inputEmoji}>👤</Text>
                <TextInput
                  focusable={true}
                  onFocus={() => setFocusedField("iptv_user")}
                  placeholder="Nome de utilizador IPTV"
                  placeholderTextColor="#777"
                  value={user}
                  onChangeText={setUser}
                  autoCapitalize="none"
                  style={styles.textInput}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PALAVRA-PASSE</Text>
              <View
                style={[
                  styles.inputBox,
                  focusedField === "iptv_pass" && styles.inputBoxFocused,
                ]}
              >
                <Text style={styles.inputEmoji}>🔒</Text>
                <TextInput
                  focusable={true}
                  onFocus={() => setFocusedField("iptv_pass")}
                  placeholder="A sua palavra-passe IPTV"
                  placeholderTextColor="#777"
                  value={pass}
                  onChangeText={setPass}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  style={styles.textInput}
                />
                <Pressable focusable={true} onPress={() => setShowPass((v) => !v)} hitSlop={8}>
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
              focusable={true}
              onFocus={() => setFocusedField("btn_connect_iptv")}
              style={[
                styles.btnGold,
                focusedField === "btn_connect_iptv" && styles.btnGoldFocused,
                loading && { opacity: 0.7 },
              ]}
              onPress={handleConnectIPTV}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text
                  style={[
                    styles.btnGoldText,
                    focusedField === "btn_connect_iptv" && { color: "#000", fontWeight: "900" },
                  ]}
                >
                  ENTRAR NA APLICAÇÃO
                </Text>
              )}
            </Pressable>

            <Pressable
              focusable={true}
              onFocus={() => setFocusedField("btn_change_license")}
              onPress={() => setStep("form")}
              style={[
                { alignSelf: "center", marginTop: 6, padding: 8, borderRadius: 8 },
                focusedField === "btn_change_license" && { backgroundColor: "rgba(229,169,59,0.25)" },
              ]}
            >
              <Text style={{ color: colors.gold, fontSize: 12, fontWeight: "700" }}>
                ← Alterar código de acesso / e-mail
              </Text>
            </Pressable>
          </View>
        )}

        {/* FEEDBACKS */}
        {loading && statusMsg && (
          <View style={styles.statusBox}>
            <ActivityIndicator color={colors.gold} size="small" />
            <Text style={styles.statusText}>{statusMsg}</Text>
          </View>
        )}

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
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
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
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  tabButtonActive: {
    backgroundColor: colors.gold,
  },
  // FOCO EM ALTO CONTRASTE NA ABA
  tabButtonFocused: {
    backgroundColor: "#FFD700",
    borderColor: "#FFFFFF",
    transform: [{ scale: 1.04 }],
    elevation: 8,
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
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 14,
    height: 52,
  },
  // CAIXA DE TEXTO COM DESTAQUE DOURADO E FUNDO VIBRANTE NO PROJETOR
  inputBoxFocused: {
    borderColor: "#FFD700",
    borderWidth: 2.5,
    backgroundColor: "#202430",
    elevation: 10,
    transform: [{ scale: 1.02 }],
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
    color: "#777",
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
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 8,
  },
  serverChipActive: {
    backgroundColor: "rgba(229, 169, 59, 0.3)",
    borderColor: colors.gold,
  },
  serverChipFocused: {
    backgroundColor: "#FFD700",
    borderColor: "#FFFFFF",
    borderWidth: 2.5,
    elevation: 8,
    transform: [{ scale: 1.05 }],
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
    paddingVertical: 5,
    paddingHorizontal: 6,
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
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  btnGoldFocused: {
    backgroundColor: "#FFD700",
    borderColor: "#FFFFFF",
    borderWidth: 2.5,
    elevation: 12,
    transform: [{ scale: 1.03 }],
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
    paddingHorizontal: 12,
    marginTop: 4,
    borderRadius: 8,
  },
  quickTrialBtnFocused: {
    backgroundColor: "rgba(229, 169, 59, 0.25)",
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  quickTrialBtnText: {
    color: colors.gold,
    fontSize: 12.5,
    fontWeight: "700",
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
