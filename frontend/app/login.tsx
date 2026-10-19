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

  // Dados da licença
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
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoWrap}>
          <Logo size={120} />
        </View>
        <Text style={styles.brand}>GoldCast Media Player</Text>

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
            <Text style={styles.subtitle}>
              Introduza o seu e-mail e chave de software para desbloquear o reprodutor.
            </Text>

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
              <Text style={styles.fieldLabel}>CHAVE DE ATIVAÇÃO</Text>
              <TVInputField
                inputRef={codeRef}
                icon="🔑"
                placeholder="Ex: GOLD-VIP-365D"
                value={code}
                onChangeText={(t: string) => setCode(t.toUpperCase())}
                autoCapitalize="characters"
              />
              <Text style={styles.hintText}>A chave de software será associada ao seu e-mail.</Text>
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
            <View style={styles.trialNoticeBox}>
              <Text style={styles.trialNoticeTitle}>MODO DE DEMONSTRAÇÃO (TESTE)</Text>
              <Text style={styles.trialNoticeText}>
                Esta secção permite testar o reprodutor com o seu fornecedor de multimédia por até 24 horas antes de ativar a licença.
              </Text>
            </View>

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

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>UTILIZADOR</Text>
              <TVInputField
                inputRef={userRef}
                icon="👤"
                placeholder="Nome de utilizador"
                value={user}
                onChangeText={setUser}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PALAVRA-PASSE</Text>
              <TVInputField
                inputRef={passRef}
                icon="🔒"
                placeholder="Palavra-passe de acesso"
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
            <Text style={styles.subtitle}>
              Reprodutor ativado com sucesso! Escolha o formato e introduza as fontes de reprodução.
            </Text>

            {/* SELETOR DE MODO: XTREAM OU M3U */}
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

            {/* MODO XTREAM */}
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

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>UTILIZADOR</Text>
                  <TVInputField
                    inputRef={userRef}
                    icon="👤"
                    placeholder="Utilizador fornecido pelo seu provedor"
                    value={user}
                    onChangeText={setUser}
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>PALAVRA-PASSE</Text>
                  <TVInputField
                    inputRef={passRef}
                    icon="🔒"
                    placeholder="Palavra-passe de acesso"
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

                <View style={styles.rememberRow}>
                  <Text style={styles.rememberTitle}>Guardar credenciais</Text>
                  <Switch
                    value={remember}
                    onValueChange={setRemember}
                    trackColor={{ true: colors.gold, false: "#222" }}
                    thumbColor="#FFF"
                  />
                </View>

                <TVActionButton
                  label="ENTRAR NO REPRODUTOR"
                  loading={loading}
                  onPress={handleConnectIPTV}
                />
              </>
            )}

            {/* MODO M3U */}
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

        {/* FEEDBACKS VISUAIS */}
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

        {/* AVISO DE ISENÇÃO LEGAL */}
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            Aviso: O GoldCast é um reprodutor de multimédia neutro e não inclui qualquer canal ou conteúdo audiovisual. O utilizador é o único responsável pelo conteúdo inserido.
          </Text>
        </View>
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
        placeholderTextColor={isFocused ? "#A0A5B5" : "#666"}
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
          (active || isFocused) && { color: "#000", fontWeight: "900" },
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
  root: { flex: 1, backgroundColor: "#07080A" },
  content: { paddingHorizontal: 20, maxWidth: 520, width: "100%", alignSelf: "center" },
  logoWrap: { alignItems: "center" },
  brand: { color: colors.gold, fontSize: 24, fontWeight: "700", textAlign: "center", letterSpacing: 0.5, marginTop: 6, marginBottom: 4 },
  subtitle: { color: "#8E929C", fontSize: 13, textAlign: "center", marginBottom: 16, lineHeight: 18 },
  tabSelector: { flexDirection: "row", backgroundColor: "#16181E", borderRadius: 12, padding: 4, marginTop: 6, marginBottom: 12, borderWidth: 1.5, borderColor: "rgba(255, 255, 255, 0.08)" },
  tabButton: { flex: 1, paddingVertical: 11, alignItems: "center", borderRadius: 8, borderWidth: 2, borderColor: "transparent" },
  tabButtonActive: { backgroundColor: colors.gold },
  tabButtonFocused: { backgroundColor: "#FFD700", borderColor: "#FFFFFF", transform: [{ scale: 1.04 }], elevation: 8 },
  tabButtonText: { color: "#8E929C", fontSize: 12, fontWeight: "700" },
  formWrap: { gap: 14, marginTop: 8 },
  trialNoticeBox: { backgroundColor: "rgba(229, 169, 59, 0.08)", borderWidth: 1, borderColor: "rgba(229, 169, 59, 0.25)", borderRadius: 10, padding: 10, gap: 4 },
  trialNoticeTitle: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  trialNoticeText: { color: "#C5C9D3", fontSize: 11.5, lineHeight: 16 },
  fieldGroup: { width: "100%" },
  fieldLabel: { color: "#8E929C", fontSize: 11, marginBottom: 6, fontWeight: "700", letterSpacing: 0.5 },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#16181E", borderRadius: 12, borderWidth: 2, borderColor: "rgba(255, 255, 255, 0.1)", paddingHorizontal: 14, height: 52 },
  inputBoxFocused: { borderColor: "#FFD700", borderWidth: 3, backgroundColor: "#202532", elevation: 12, transform: [{ scale: 1.02 }] },
  inputEmoji: { fontSize: 16, marginRight: 10 },
  textInput: { flex: 1, color: "#FFF", fontSize: 15 },
  hintText: { color: "#777", fontSize: 11, marginTop: 4 },
  btnGold: { backgroundColor: colors.gold, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 6, borderWidth: 2, borderColor: "transparent" },
  btnGoldFocused: { backgroundColor: "#FFD700", borderColor: "#FFFFFF", borderWidth: 3, elevation: 14, transform: [{ scale: 1.03 }] },
  btnGoldText: { color: "#000", fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  linkBtn: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 14, marginTop: 4, borderRadius: 8, borderWidth: 1.5, borderColor: "transparent" },
  linkBtnFocused: { backgroundColor: "#FFD700", borderColor: "#FFFFFF", transform: [{ scale: 1.04 }], elevation: 6 },
  linkBtnText: { color: colors.gold, fontSize: 12.5, fontWeight: "700" },
  rememberRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#16181E", borderRadius: 12, padding: 14 },
  rememberTitle: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  statusBox: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: "#16181E", borderRadius: 12 },
  statusText: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  errorBox: { marginTop: 14, flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: "rgba(244,67,54,0.12)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(244,67,54,0.3)" },
  errorText: { color: "#F44336", flex: 1, fontSize: 12 },
  disclaimerBox: { marginTop: 24, padding: 12, borderRadius: 8, backgroundColor: "rgba(255, 255, 255, 0.03)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.07)" },
  disclaimerText: { color: "#777C8A", fontSize: 10.5, textAlign: "center", lineHeight: 15 },
});
