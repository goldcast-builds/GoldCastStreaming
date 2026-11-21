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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Logo } from "../src/components/Logo";
import { useSession } from "../src/store/session";
import { createM3UUrl, listLists, setActiveListId } from "../src/utils/api";

type DnsKey = "dns1" | "dns2";
type XtreamStep = "code" | "dns" | "credentials";

const DNS_OPTIONS: Record<DnsKey, { title: string; subtitle: string; url: string }> = {
  dns1: {
    title: "Servidor 1 (DNS 1)",
    subtitle: "Rota principal de conexão",
    url: "http://natfluxo.store:80",
  },
  dns2: {
    title: "Servidor 2 (DNS 2)",
    subtitle: "Rota alternativa de conexão",
    url: "http://newbrtop.online:8080",
  },
};

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const login = useSession((s) => s.login);
  const setSource = useSession((s) => s.setSource);

  const [connectMode, setConnectMode] = useState<"xtream" | "m3u" | "trial">("xtream");
  const [xtreamStep, setXtreamStep] = useState<XtreamStep>("code");

  const [accessCode, setAccessCode] = useState("");
  const [selectedDns, setSelectedDns] = useState<DnsKey | null>(null);

  const [server, setServer] = useState("");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember] = useState(true);

  const [m3uName, setM3uName] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");

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
        const [savedCode, savedServer, savedUser] = await Promise.all([
          AsyncStorage.getItem("@goldcast_saved_code"),
          AsyncStorage.getItem("@goldcast_saved_server"),
          AsyncStorage.getItem("@goldcast_saved_user"),
        ]);

        if (savedCode && mounted.current) setAccessCode(savedCode);
        if (savedServer && mounted.current) setServer(savedServer);
        if (savedUser && mounted.current) setUser(savedUser);
      } catch {}
    })();

    return () => {
      mounted.current = false;
    };
  }, []);

  const handleConfirmAccessCode = () => {
    setError(null);
    const cleanCode = accessCode.trim();
    if (!cleanCode) {
      setError("Digite o código de acesso para continuar.");
      return;
    }
    AsyncStorage.setItem("@goldcast_saved_code", cleanCode).catch(() => {});
    setXtreamStep("dns");
  };

  const handlePickDns = (key: DnsKey) => {
    setError(null);
    setSelectedDns(key);
    setServer(DNS_OPTIONS[key].url);
    setXtreamStep("credentials");
    requestAnimationFrame(() => {
      userRef.current?.focus();
    });
  };

  const handleConnectIPTV = async () => {
    setError(null);
    const targetServer = (selectedDns ? DNS_OPTIONS[selectedDns].url : server).trim();

    if (!targetServer) {
      setXtreamStep("dns");
      setError("Escolha o Servidor 1 (DNS 1) ou Servidor 2 (DNS 2).");
      return;
    }

    if (!user.trim() || !pass) {
      setError("Preencha o utilizador e a palavra-passe.");
      return;
    }

    setLoading(true);
    setStatusMsg("A ligar ao servidor multimédia...");

    try {
      if (remember) {
        AsyncStorage.setItem("@goldcast_saved_server", targetServer).catch(() => {});
        AsyncStorage.setItem("@goldcast_saved_user", user.trim()).catch(() => {});
      }
      await login(targetServer, user.trim(), pass, remember, (_s, d) => {
        if (mounted.current) setStatusMsg(d || "A carregar conteúdos...");
      });
      setTimeout(() => {
        if (mounted.current) router.replace("/(tabs)");
      }, 350);
    } catch (e: any) {
      if (mounted.current) {
        setError(
          e?.message || "Falha ao ligar ao servidor. Verifique os dados com o seu fornecedor."
        );
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

      setTimeout(() => {
        if (mounted.current) router.replace("/(tabs)");
      }, 350);
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
      await login(server.trim(), user.trim(), pass, false, (_s, d) => {
        if (mounted.current) setStatusMsg(d || "A aceder...");
      });

      const currentSession = useSession.getState().session;
      const expDate = currentSession?.userInfo?.exp_date;

      if (!expDate || expDate === "null" || expDate === "") {
        useSession.getState().logout?.();
        throw new Error("Esta área é exclusiva para testes temporários (até 24 horas).");
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

      setTimeout(() => {
        if (mounted.current) router.replace("/(tabs)");
      }, 350);
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
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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
        <Text style={styles.subtitle}>Introduza os dados de acesso do seu provedor.</Text>

        <View style={styles.tabSelector}>
          <TVTabButton
            label="🔑 Acesso por Código"
            active={connectMode === "xtream"}
            preferredFocus={connectMode === "xtream"}
            onPress={() => {
              setConnectMode("xtream");
              setError(null);
            }}
          />
          <TVTabButton
            label="🔗 Lista M3U"
            active={connectMode === "m3u"}
            onPress={() => {
              setConnectMode("m3u");
              setError(null);
            }}
          />
          <TVTabButton
            label="⏱️ Demonstração"
            active={connectMode === "trial"}
            onPress={() => {
              setConnectMode("trial");
              setError(null);
            }}
          />
        </View>

        {connectMode === "xtream" && (
          <View style={styles.formWrap}>
            {xtreamStep === "code" && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>CÓDIGO DE ACESSO</Text>
                  <TVInputField
                    inputRef={codeRef}
                    icon="🎟️"
                    placeholder="Digite o código"
                    value={accessCode}
                    onChangeText={setAccessCode}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    onSubmitEditing={handleConfirmAccessCode}
                  />
                </View>

                <TVActionButton
                  label="CONTINUAR"
                  loading={loading}
                  onPress={handleConfirmAccessCode}
                />
              </>
            )}

            {xtreamStep === "dns" && (
              <>
                <Text style={styles.stepQuestion}>
                  Código confirmado. Qual servidor deseja utilizar?
                </Text>

                <TVDnsButton
                  title="Servidor 1 (DNS 1)"
                  subtitle={DNS_OPTIONS.dns1.subtitle}
                  onPress={() => handlePickDns("dns1")}
                />

                <TVDnsButton
                  title="Servidor 2 (DNS 2)"
                  subtitle={DNS_OPTIONS.dns2.subtitle}
                  onPress={() => handlePickDns("dns2")}
                />

                <TVSecondaryButton
                  label="Voltar e alterar código"
                  onPress={() => {
                    setError(null);
                    setXtreamStep("code");
                  }}
                />
              </>
            )}

            {xtreamStep === "credentials" && (
              <>
                <View style={styles.selectedBar}>
                  <Text style={styles.selectedBarText}>
                    {selectedDns ? DNS_OPTIONS[selectedDns].title : "Servidor selecionado"}
                  </Text>
                  <Pressable
                    focusable={true}
                    accessible={true}
                    onPress={() => setXtreamStep("dns")}
                    style={({ focused }) => [
                      styles.miniChangeBtn,
                      focused && styles.miniChangeBtnFocused,
                    ]}
                  >
                    <Text style={styles.miniChangeText}>Trocar DNS</Text>
                  </Pressable>
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
                      returnKeyType="next"
                      onSubmitEditing={() => passRef.current?.focus()}
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
                      returnKeyType="done"
                      onSubmitEditing={handleConnectIPTV}
                      rightElement={
                        <TVEyeButton
                          showPass={showPass}
                          onPress={() => setShowPass((v) => !v)}
                        />
                      }
                    />
                  </View>
                </View>

                <TVActionButton
                  label="ENTRAR NO REPRODUTOR"
                  loading={loading}
                  onPress={handleConnectIPTV}
                />

                <TVSecondaryButton
                  label="Voltar para escolha do servidor"
                  onPress={() => {
                    setError(null);
                    setXtreamStep("dns");
                  }}
                />
              </>
            )}
          </View>
        )}

        {connectMode === "m3u" && (
          <View style={styles.formWrap}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>NOME DA LISTA (OPCIONAL)</Text>
              <TVInputField
                inputRef={m3uNameRef}
                icon="📝"
                placeholder="Ex: Minha Lista Principal"
                value={m3uName}
                onChangeText={setM3uName}
                returnKeyType="next"
                onSubmitEditing={() => m3uUrlRef.current?.focus()}
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
                returnKeyType="done"
                onSubmitEditing={handleConnectM3U}
              />
            </View>

            <TVActionButton
              label="CARREGAR LISTA M3U"
              loading={loading}
              onPress={handleConnectM3U}
            />
          </View>
        )}

        {connectMode === "trial" && (
          <View style={styles.formWrap}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SERVIDOR / URL DO PROVEDOR (TESTE)</Text>
              <TVInputField
                inputRef={serverRef}
                icon="🌐"
                placeholder="http://servidordoprovedor.com:8080"
                value={server}
                onChangeText={setServer}
                keyboardType="url"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => userRef.current?.focus()}
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
                  returnKeyType="next"
                  onSubmitEditing={() => passRef.current?.focus()}
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
                  returnKeyType="done"
                  onSubmitEditing={handleConnectTrial}
                  rightElement={
                    <TVEyeButton
                      showPass={showPass}
                      onPress={() => setShowPass((v) => !v)}
                    />
                  }
                />
              </View>
            </View>

            <TVActionButton
              label="INICIAR DEMONSTRAÇÃO"
              loading={loading}
              onPress={handleConnectTrial}
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
  returnKeyType,
  onSubmitEditing,
  rightElement,
}: any) {
  const [isFocused, setIsFocused] = useState(false);

  const handleOpenInput = () => {
    setIsFocused(true);
    requestAnimationFrame(() => {
      inputRef?.current?.focus();
    });
  };

  return (
    <Pressable
      focusable={true}
      accessible={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={handleOpenInput}
      style={[styles.inputBox, isFocused && styles.inputBoxFocused]}
    >
      {icon && <Text style={styles.inputEmoji}>{icon}</Text>}
      <TextInput
        ref={inputRef}
        editable={true}
        focusable={true}
        accessible={true}
        showSoftInputOnFocus={true}
        placeholder={placeholder}
        placeholderTextColor={isFocused ? "#D1D5DB" : "#6B7280"}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={returnKeyType === "done"}
        style={[styles.textInput, isFocused && { color: "#FFF", fontWeight: "700" }]}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {rightElement}
    </Pressable>
  );
}

function TVDnsButton({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      accessible={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[styles.dnsCard, isFocused && styles.dnsCardFocused]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.dnsTitle}>{title}</Text>
        <Text style={styles.dnsSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.dnsArrow}>›</Text>
    </Pressable>
  );
}

function TVSecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      accessible={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[styles.secondaryBtn, isFocused && styles.secondaryBtnFocused]}
    >
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </Pressable>
  );
}

function TVEyeButton({
  showPass,
  onPress,
}: {
  showPass: boolean;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      accessible={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      hitSlop={8}
      style={[styles.eyeBtn, isFocused && styles.eyeBtnFocused]}
    >
      <Text style={{ fontSize: 16 }}>{showPass ? "🙈" : "👁️"}</Text>
    </Pressable>
  );
}

function TVTabButton({
  label,
  active,
  preferredFocus = false,
  onPress,
}: {
  label: string;
  active: boolean;
  preferredFocus?: boolean;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      accessible={true}
      hasTVPreferredFocus={preferredFocus}
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

function TVActionButton({
  label,
  loading,
  onPress,
}: {
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      accessible={true}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1B3B4B" },
  content: {
    paddingHorizontal: 30,
    maxWidth: 620,
    width: "100%",
    alignSelf: "center",
    justifyContent: "center",
  },
  logoWrap: { alignItems: "center", marginBottom: 2 },
  brand: {
    color: "#E9C46A",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 10,
    fontWeight: "600",
  },

  tabSelector: {
    flexDirection: "row",
    backgroundColor: "#152E3B",
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.15)",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  tabButtonActive: { backgroundColor: "#E9C46A" },
  tabButtonFocused: {
    borderColor: "#FFF",
    backgroundColor: "#1B3B4B",
    transform: [{ scale: 1.03 }],
  },
  tabButtonText: { color: "#9CA3AF", fontSize: 11, fontWeight: "800" },

  formWrap: { gap: 10 },
  stepQuestion: {
    color: "#FFF",
    fontSize: 12.5,
    fontWeight: "800",
    textAlign: "center",
  },
  dnsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#152E3B",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  dnsCardFocused: {
    borderColor: "#E9C46A",
    borderWidth: 3,
    backgroundColor: "#1B3B4B",
    transform: [{ scale: 1.02 }],
  },
  dnsTitle: { color: "#FFF", fontSize: 13, fontWeight: "900" },
  dnsSubtitle: { color: "#9CA3AF", fontSize: 10.5, fontWeight: "600" },
  dnsArrow: { color: "#E9C46A", fontSize: 20, fontWeight: "900" },

  selectedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(233,196,106,0.12)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.35)",
  },
  selectedBarText: { color: "#E9C46A", fontSize: 11.5, fontWeight: "800" },
  miniChangeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#152E3B",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  miniChangeBtnFocused: { borderColor: "#E9C46A" },
  miniChangeText: { color: "#FFF", fontSize: 10.5, fontWeight: "800" },

  secondaryBtn: {
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  secondaryBtnFocused: { borderColor: "#E9C46A" },
  secondaryBtnText: { color: "#D1D5DB", fontSize: 11, fontWeight: "700" },

  fieldGroup: { width: "100%" },
  rowFields: { flexDirection: "row", gap: 12 },
  fieldLabel: {
    color: "#E9C46A",
    fontSize: 9,
    marginBottom: 4,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#152E3B",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    height: 46,
  },
  inputBoxFocused: {
    borderColor: "#E9C46A",
    borderWidth: 3,
    backgroundColor: "#1B3B4B",
    transform: [{ scale: 1.02 }],
  },
  inputEmoji: { fontSize: 14, marginRight: 8 },
  textInput: { flex: 1, color: "#FFF", fontSize: 13, fontWeight: "700" },

  eyeBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  eyeBtnFocused: {
    borderColor: "#E9C46A",
    backgroundColor: "rgba(233,196,106,0.15)",
  },

  btnGold: {
    backgroundColor: "#E9C46A",
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    borderWidth: 2,
    borderColor: "transparent",
  },
  btnGoldFocused: {
    borderColor: "#FFF",
    borderWidth: 3,
    transform: [{ scale: 1.02 }],
  },
  btnGoldText: { color: "#000", fontSize: 12, fontWeight: "900", letterSpacing: 0.8 },

  statusBox: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 10,
    backgroundColor: "#152E3B",
    borderRadius: 10,
  },
  statusText: { color: "#FFF", fontSize: 11, fontWeight: "700" },

  errorBox: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "rgba(231,111,81,0.12)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(231,111,81,0.3)",
  },
  errorText: { color: "#E76F51", flex: 1, fontSize: 11, fontWeight: "700" },
});
