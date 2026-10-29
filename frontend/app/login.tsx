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
import { useSession } from "../src/store/session";
import { createM3UUrl, listLists, setActiveListId } from "../src/utils/api";

const VALIDATE_CODE_URL =
  "https://lljsnoovvwexzebzbaal.supabase.co/functions/v1/validate-code";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const login = useSession((s) => s.login);
  const setSource = useSession((s) => s.setSource);

  const [activeTab, setActiveTab] = useState<"license" | "trial">("license");
  const [step, setStep] = useState<"form" | "iptv">("form");
  const [connectMode, setConnectMode] = useState<"xtream" | "m3u">("xtream");

  // Dados da licença (Iniciam vazios para que cada cliente insira os seus dados)
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  // Dados de conexão Xtream
  const [server, setServer] = useState("");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);

  // Dados de conexão M3U
  const [m3uName, setM3uName] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");

  const emailRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);
  const serverRef = useRef<TextInput>(null);
  const userRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);
  const m3uNameRef = useRef<TextInput>(null);
  const m3uUrlRef = useRef<TextInput>(null);

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);

  useEffect(() => {
    (async () => {
      try {
        const [savedLicensed, savedEmail, savedCode, savedServer, savedUser] = await Promise.all([
          AsyncStorage.getItem("@goldcast_app_licensed"),
          AsyncStorage.getItem("@goldcast_saved_email"),
          AsyncStorage.getItem("@goldcast_saved_code"),
          AsyncStorage.getItem("@goldcast_saved_server"),
          AsyncStorage.getItem("@goldcast_saved_user"),
        ]);

        if (savedEmail) setEmail(savedEmail);
        if (savedCode) setCode(savedCode);
        if (savedServer) setServer(savedServer);
        if (savedUser) setUser(savedUser);

        if (savedLicensed === "true") {
          setStep("iptv");
        }
      } catch {}
    })();

    return () => {
      mounted.current = false;
    };
  }, []);

  const handleValidateLicense = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();

    setError(null);
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Indique um endereço de e-mail válido.");
      return;
    }
    if (!cleanCode) {
      setError("Indique a chave de ativação do reprodutor.");
      return;
    }

    setLoading(true);
    setStatusMsg("A validar licença do reprodutor...");

    try {
      const res = await fetch(VALIDATE_CODE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Chave de software ou e-mail inválido.");
      }

      await AsyncStorage.setItem("@goldcast_app_licensed", "true");
      await AsyncStorage.setItem("@goldcast_saved_email", cleanEmail);
      await AsyncStorage.setItem("@goldcast_saved_code", cleanCode);

      setStep("iptv");
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || "Falha na validação da chave do reprodutor.");
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
        setStatusMsg(null);
      }
    }
  };

  const handleConnectIPTV = async () => {
    setError(null);
    if (!server.trim() || !user.trim() || !pass) {
      setError("Preencha a URL do servidor, o utilizador e a palavra-passe.");
      return;
    }

    setLoading(true);
    setStatusMsg("A ligar ao servidor multimédia...");

    try {
      if (remember) {
        AsyncStorage.setItem("@goldcast_saved_server", server.trim()).catch(() => {});
        AsyncStorage.setItem("@goldcast_saved_user", user.trim()).catch(() => {});
      }
      await login(server.trim(), user.trim(), pass, remember, (s, d) => {
        if (mounted.current) setStatusMsg(d || "A carregar conteúdos...");
      });
      setTimeout(() => router.replace("/(tabs)"), 350);
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || "Falha ao ligar ao servidor. Verifique os dados com o seu fornecedor.");
        setStatusMsg(null);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const handleConnectM3U = async () => {
    setError(null);
    if (!m3uUrl.trim()) {
      setError("Indique o endereço URL da lista M3U.");
      return;
    }

    setLoading(true);
    setStatusMsg("A descarregar e processar lista M3U...");

    try {
      const listTitle = m3uName.trim() || "Minha Lista M3U";
      const created = await createM3UUrl({ name: listTitle, url: m3uUrl.trim() });
      const targetId = (created as any)?.id || (created as any)?.list?.id;

      if (targetId) {
        await setActiveListId(targetId);
        await setSource({ kind: "list", listId: targetId });
      } else {
        const all = await listLists().catch(() => []);
        if (all.length > 0) {
          const last = all[all.length - 1];
          await setActiveListId(last.id);
          await setSource({ kind: "list", listId: last.id });
        }
      }

      setTimeout(() => router.replace("/(tabs)"), 350);
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || "Falha ao processar a lista M3U. Verifique a ligação informada.");
        setStatusMsg(null);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const handleConnectTrial = async () => {
    setError(null);
    if (!server.trim() || !user.trim() || !pass) {
      setError("Preencha o servidor, o utilizador e a palavra-passe de demonstração.");
      return;
    }

    setLoading(true);
    setStatusMsg("A verificar credenciais de teste...");

    try {
      await login(server.trim(), user.trim(), pass, false, (s, d) => {
        if (mounted.current) setStatusMsg(d || "A aceder...");
      });

      const currentSession = useSession.getState().session;
      const expDate = currentSession?.userInfo?.exp_date;

      if (!expDate || expDate === "null" || expDate === "") {
        useSession.getState().logout?.();
        throw new Error(
          "Esta área é exclusiva para testes temporários (até 24 horas). Para contas definitivas, ative a chave de software."
        );
      }

      const expTimestampMs = Number(expDate) * 1000;
      if (isNaN(expTimestampMs)) {
        useSession.getState().logout?.();
        throw new Error("Não foi possível validar o período da conta.");
      }

      const nowMs = Date.now();
      const diffHours = (expTimestampMs - nowMs) / (1000 * 60 * 60);

      if (diffHours <= 0) {
        useSession.getState().logout?.();
        throw new Error("Este período de demonstração já se encontra expirado.");
      }

      if (diffHours > 26) {
        useSession.getState().logout?.();
        const diasRestantes = Math.round(diffHours / 24);
        throw new Error(
          `Esta secção destina-se apenas a períodos de teste até 24h. A conta possui validade de ${diasRestantes} dias.`
        );
      }

      setTimeout(() => router.replace("/(tabs)"), 350);
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || "Falha na ligação de teste.");
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
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoWrap}>
          <Logo size={70} />
        </View>
        <Text style={styles.brand}>GoldCast Media Player</Text>
        <Text style={styles.subtitle}>Escolha o formato e introduza as fontes de reprodução.</Text>

        {step === "form" && (
          <View style={styles.tabSelector}>
            <TVTabButton
              label="🔑 Chave do Reprodutor"
              active={activeTab === "license"}
              onPress={() => {
                setActiveTab("license");
                setError(null);
              }}
            />
            <TVTabButton
              label="⏱️ Acesso de Demonstração"
              active={activeTab === "trial"}
              onPress={() => {
                setActiveTab("trial");
                setError(null);
              }}
            />
          </View>
        )}

        {/* 1. ATIVAÇÃO DO SOFTWARE */}
        {step === "form" && activeTab === "license" && (
          <View style={styles.formWrap}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>O SEU E-MAIL</Text>
              <TVInputField
                inputRef={emailRef}
                icon="✉️"
                placeholder="exemplo@gmail.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CHAVE DE ATIVAÇÃO / CÓDIGO</Text>
              <TVInputField
                inputRef={codeRef}
                icon="🔑"
                placeholder="Ex: GOLD-VIP-365D"
                value={code}
                onChangeText={(t: string) => setCode(t.toUpperCase())}
                autoCapitalize="characters"
              />
            </View>

            <TVActionButton
              label="ATIVAR E CONTINUAR"
              loading={loading}
              onPress={handleValidateLicense}
            />

            <TVLinkButton
              label="⚡ Não possui chave? Entrar com período de teste →"
              onPress={() => {
                setActiveTab("trial");
                setError(null);
              }}
            />
          </View>
        )}

        {/* 2. ÁREA DE DEMONSTRAÇÃO (24H) */}
        {step === "form" && activeTab === "trial" && (
          <View style={styles.formWrap}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SERVIDOR / URL DO PROVEDOR</Text>
              <TVInputField
                inputRef={serverRef}
                icon="🌐"
                placeholder="http://servidordoprovedor.com:8080"
                value={server}
                onChangeText={setServer}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>UTILIZADOR</Text>
                <TVInputField
                  inputRef={userRef}
                  icon="👤"
                  placeholder="Utilizador"
                  value={user}
                  onChangeText={setUser}
                  autoCapitalize="none"
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>PALAVRA-PASSE</Text>
                <TVInputField
                  inputRef={passRef}
                  icon="🔒"
                  placeholder="Palavra-passe"
                  value={pass}
                  onChangeText={setPass}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  rightElement={
                    <Pressable focusable={true} onPress={() => setShowPass((v) => !v)} hitSlop={8}>
                      <Text style={{ fontSize: 16 }}>{showPass ? "🙈" : "👁️"}</Text>
                    </Pressable>
                  }
                />
              </View>
            </View>

            <TVActionButton
              label="INICIAR DEMONSTRAÇÃO (24H)"
              loading={loading}
              onPress={handleConnectTrial}
            />

            <TVLinkButton
              label="← Voltar à ativação por chave"
              onPress={() => {
                setActiveTab("license");
                setError(null);
              }}
            />
          </View>
        )}

        {/* 3. LIGAÇÃO DE CONTEÚDOS (XTREAM OU M3U) */}
        {step === "iptv" && (
          <View style={styles.formWrap}>
            <View style={styles.tabSelector}>
              <TVTabButton
                label="🔑 Servidor Xtream"
                active={connectMode === "xtream"}
                onPress={() => {
                  setConnectMode("xtream");
                  setError(null);
                }}
              />
              <TVTabButton
                label="🔗 Lista M3U (URL)"
                active={connectMode === "m3u"}
                onPress={() => {
                  setConnectMode("m3u");
                  setError(null);
                }}
              />
            </View>

            {connectMode === "xtream" && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>SERVIDOR / URL DO PROVEDOR</Text>
                  <TVInputField
                    inputRef={serverRef}
                    icon="🌐"
                    placeholder="http://servidordoprovedor.com:8080"
                    value={server}
                    onChangeText={setServer}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.rowFields}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>UTILIZADOR</Text>
                    <TVInputField
                      inputRef={userRef}
                      icon="👤"
                      placeholder="Utilizador"
                      value={user}
                      onChangeText={setUser}
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>PALAVRA-PASSE</Text>
                    <TVInputField
                      inputRef={passRef}
                      icon="🔒"
                      placeholder="Palavra-passe"
                      value={pass}
                      onChangeText={setPass}
                      secureTextEntry={!showPass}
                      autoCapitalize="none"
                      rightElement={
                        <Pressable focusable={true} onPress={() => setShowPass((v) => !v)} hitSlop={8}>
                          <Text style={{ fontSize: 16 }}>{showPass ? "🙈" : "👁️"}</Text>
                        </Pressable>
                      }
                    />
                  </View>
                </View>

                <TVActionButton
                  label="ENTRAR NO REPRODUTOR"
                  loading={loading}
                  onPress={handleConnectIPTV}
                />
              </>
            )}

            {connectMode === "m3u" && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>NOME DA LISTA (OPCIONAL)</Text>
                  <TVInputField
                    inputRef={m3uNameRef}
                    icon="📝"
                    placeholder="Ex: Minha Lista Principal"
                    value={m3uName}
                    onChangeText={setM3uName}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>URL DA LISTA (M3U / M3U8)</Text>
                  <TVInputField
                    inputRef={m3uUrlRef}
                    icon="🔗"
                    placeholder="https://exemplo.com/lista.m3u"
                    value={m3uUrl}
                    onChangeText={setM3uUrl}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>

                <TVActionButton
                  label="CARREGAR LISTA M3U"
                  loading={loading}
                  onPress={handleConnectM3U}
                />
              </>
            )}

            <TVLinkButton
              label="← Alterar chave do reprodutor / e-mail"
              onPress={() => setStep("form")}
            />
          </View>
        )}

        {loading && statusMsg && (
          <View style={styles.statusBox}>
            <ActivityIndicator color="#E9C46A" size="small" />
            <Text style={styles.statusText}>{statusMsg}</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={{ color: "#E76F51", fontSize: 13, marginRight: 6 }}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TVInputField({
  inputRef,
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  rightElement,
}: any) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={() => inputRef?.current?.focus()}
      style={[styles.inputBox, isFocused && styles.inputBoxFocused]}
    >
      {icon && <Text style={styles.inputEmoji}>{icon}</Text>}
      <TextInput
        ref={inputRef}
        placeholder={placeholder}
        placeholderTextColor={isFocused ? "#D1D5DB" : "#6B7280"}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[styles.textInput, isFocused && { color: "#FFF", fontWeight: "700" }]}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {rightElement}
    </Pressable>
  );
}

function TVTabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[
        styles.tabButton,
        active && styles.tabButtonActive,
        isFocused && styles.tabButtonFocused,
      ]}
    >
      <Text
        style={[
          styles.tabButtonText,
          active && { color: "#000", fontWeight: "900" },
          isFocused && { color: "#FFF", fontWeight: "900" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TVActionButton({ label, loading, onPress }: { label: string; loading: boolean; onPress: () => void }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      disabled={loading}
      style={[styles.btnGold, isFocused && styles.btnGoldFocused, loading && { opacity: 0.7 }]}
    >
      {loading ? (
        <ActivityIndicator color="#000" />
      ) : (
        <Text style={[styles.btnGoldText, isFocused && { color: "#000", fontWeight: "900" }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function TVLinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[styles.linkBtn, isFocused && styles.linkBtnFocused]}
    >
      <Text style={[styles.linkBtnText, isFocused && { color: "#000", fontWeight: "900" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1B3B4B" },
  content: { paddingHorizontal: 30, maxWidth: 620, width: "100%", alignSelf: "center", justifyContent: "center" },
  logoWrap: { alignItems: "center", marginBottom: 2 },
  brand: { color: "#E9C46A", fontSize: 20, fontWeight: "900", textAlign: "center", letterSpacing: 0.8, marginBottom: 2 },
  subtitle: { color: "#9CA3AF", fontSize: 11, textAlign: "center", marginBottom: 10, fontWeight: "600" },
  
  tabSelector: { flexDirection: "row", backgroundColor: "#152E3B", borderRadius: 10, padding: 3, marginBottom: 10, borderWidth: 1, borderColor: "rgba(233,196,106,0.15)" },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8, borderWidth: 2, borderColor: "transparent" },
  tabButtonActive: { backgroundColor: "#E9C46A" },
  tabButtonFocused: { borderColor: "#FFF", backgroundColor: "#1B3B4B", transform: [{ scale: 1.02 }] },
  tabButtonText: { color: "#9CA3AF", fontSize: 11, fontWeight: "800" },

  formWrap: { gap: 10 },
  fieldGroup: { width: "100%" },
  rowFields: { flexDirection: "row", gap: 12 },
  fieldLabel: { color: "#E9C46A", fontSize: 9, marginBottom: 4, fontWeight: "800", letterSpacing: 0.5 },
  
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#152E3B", borderRadius: 10, borderWidth: 1.5, borderColor: "rgba(255, 255, 255, 0.08)", paddingHorizontal: 12, height: 44 },
  inputBoxFocused: { borderColor: "#E9C46A", borderWidth: 2.5, backgroundColor: "#1B3B4B", transform: [{ scale: 1.01 }] },
  inputEmoji: { fontSize: 14, marginRight: 8 },
  textInput: { flex: 1, color: "#FFF", fontSize: 13, fontWeight: "700" },

  btnGold: { backgroundColor: "#E9C46A", height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 4, borderWidth: 2, borderColor: "transparent" },
  btnGoldFocused: { borderColor: "#FFF", borderWidth: 2.5, transform: [{ scale: 1.01 }] },
  btnGoldText: { color: "#000", fontSize: 12, fontWeight: "900", letterSpacing: 0.8 },

  linkBtn: { alignSelf: "center", paddingVertical: 6, paddingHorizontal: 10, marginTop: 2, borderRadius: 6 },
  linkBtnFocused: { backgroundColor: "#E9C46A" },
  linkBtnText: { color: "#E9C46A", fontSize: 11, fontWeight: "800" },

  statusBox: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 10, backgroundColor: "#152E3B", borderRadius: 10 },
  statusText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  
  errorBox: { marginTop: 8, flexDirection: "row", alignItems: "center", padding: 10, backgroundColor: "rgba(231,111,81,0.12)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(231,111,81,0.3)" },
  errorText: { color: "#E76F51", flex: 1, fontSize: 11, fontWeight: "700" },
});
