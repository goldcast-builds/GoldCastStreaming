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
import Ionicons from "@react-native-vector-icons/ionicons";
import { Logo } from "../src/components/Logo";
import { GoldButton } from "../src/components/GoldButton";
import { colors, radius, spacing } from "../src/utils/theme";
import { DEFAULT_SERVERS, SERVER_LABELS, Stage } from "../src/services/xtream";
import { useSession } from "../src/store/session";

const STAGE_LABEL: Record<Stage, string> = {
  checking: "Verificando servidor...",
  connecting: "Conectando...",
  validating: "Validando acesso...",
  loading: "Carregando conteúdo...",
  done: "Conectado!",
};

const REMOTE_SERVERS_URL = "https://raw.githubusercontent.com/anderson009470/GoldCastStreaming/main/servers.json";
const SUPABASE_TRIAL_URL = "https://lljsnoovvwexzebzbaal.supabase.co/functions/v1/request-trial";

interface ServerOption {
  label: string;
  url: string;
}

// Identificador único por instalação com persistência local
const getDeviceHardware = async (): Promise<{ mac: string; key: string }> => {
  try {
    const savedMac = await AsyncStorage.getItem("@goldcast_device_mac");
    const savedKey = await AsyncStorage.getItem("@goldcast_device_key");
    if (savedMac && savedKey) {
      return { mac: savedMac, key: savedKey };
    }
  } catch {}

  const randomBytes = Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase()
  );
  const mac = randomBytes.join(":");
  const key = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await AsyncStorage.setItem("@goldcast_device_mac", mac);
    await AsyncStorage.setItem("@goldcast_device_key", key);
  } catch {}

  return { mac, key };
};

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const login = useSession((s) => s.login);

  const defaultList: ServerOption[] = [
    { label: SERVER_LABELS[DEFAULT_SERVERS.primary] || "Servidor 1", url: DEFAULT_SERVERS.primary },
    { label: SERVER_LABELS[DEFAULT_SERVERS.backup] || "Servidor 2", url: DEFAULT_SERVERS.backup },
  ];

  const [serverList, setServerList] = useState<ServerOption[]>(defaultList);
  const [server, setServer] = useState(DEFAULT_SERVERS.primary);
  const [custom, setCustom] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [stage, setStage] = useState<{ s: Stage; d?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estados do cronómetro de sincronização
  const [countdown, setCountdown] = useState(0);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const autoSubmitAfterSync = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${REMOTE_SERVERS_URL}?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && active) {
            setServerList(data);
            setServer((current) => {
              const stillExists = data.some((s) => s.url === current);
              return stillExists ? current : data[0].url;
            });
          }
        }
      } catch {}
    })();

    return () => {
      active = false;
      mounted.current = false;
    };
  }, []);

  // Temporizador estável: roda sem recriar o intervalo a cada segundo
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown > 0]);

  // Ao zerar a contagem, libera o botão e tenta conectar uma única vez sem reiniciar o timer
  useEffect(() => {
    if (countdown === 0 && autoSubmitAfterSync.current) {
      autoSubmitAfterSync.current = false;
      setSyncNotice("Sincronização concluída! Iniciando conexão...");
      submit();
    }
  }, [countdown]);

  const submit = async () => {
    if (countdown > 0) return;
    setError(null);

    if (!server.trim() || !user.trim() || !pass) {
      setError(custom && !server.trim() ? "Informe o endereço do servidor." : "Preencha utilizador e palavra-passe.");
      return;
    }

    setLoading(true);
    try {
      await login(server, user.trim(), pass, remember, (s, d) => mounted.current && setStage({ s, d }));
      setTimeout(() => router.replace("/(tabs)"), 350);
    } catch (e: any) {
      if (mounted.current) {
        const rawMsg = String(e?.message || "");
        const is404OrSync =
          rawMsg.includes("404") ||
          rawMsg.toLowerCase().includes("não encontrada") ||
          rawMsg.toLowerCase().includes("not found");

        // NUNCA reinicia o cronômetro aqui para não prender o usuário em loop
        if (is404OrSync) {
          setError("O servidor ainda está finalizando a replicação da sua linha. Aguarde alguns segundos e clique em ENTRAR.");
        } else {
          setError(rawMsg || "Falha ao conectar.");
        }
        setSyncNotice(null);
        setStage(null);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const handleRequestTrial = async () => {
    setError(null);
    setSyncNotice(null);
    setTrialLoading(true);
    setLoading(true);
    setStage({ s: "connecting", d: "Criando seu teste de 3 horas..." });

    try {
      const device = await getDeviceHardware();

      const response = await fetch(SUPABASE_TRIAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mac: device.mac,
          device_key: device.key,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Não foi possível ativar o teste.");
      }

      setUser(data.username);
      setPass(data.password);
      const targetServer = data.serverUrl || server;
      setServer(targetServer);

      setStage(null);
      setSyncNotice(
        "Conta gerada com sucesso! Aguarde o contador para a sincronização da sua linha no servidor."
      );
      setCountdown(45);
      autoSubmitAfterSync.current = true;
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || "Falha ao obter teste gratuito.");
        setStage(null);
      }
    } finally {
      if (mounted.current) {
        setTrialLoading(false);
        setLoading(false);
      }
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
        testID="login-screen"
      >
        <View style={styles.logoWrap}>
          <Logo size={150} />
        </View>
        <Text style={styles.brand}>GoldCast Streaming</Text>
        <Text style={styles.subtitle}>Entre com os seus dados ou experimente gratuitamente.</Text>

        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          <Text style={styles.fieldLabel}>Servidor</Text>
          <View style={styles.serverChips}>
            {serverList.map((item, i) => {
              const active = !custom && server === item.url;
              return (
                <Pressable
                  key={`${item.url}-${i}`}
                  testID={`server-chip-${i + 1}`}
                  onPress={() => {
                    setCustom(false);
                    setServer(item.url);
                  }}
                  style={({ focused }) => [
                    styles.serverBtn,
                    active && styles.serverBtnActive,
                    focused && styles.focused,
                  ]}
                >
                  <Ionicons name="server-outline" size={18} color={active ? colors.onGold : colors.gold} />
                  <Text style={[styles.serverText, active && { color: colors.onGold }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            testID="server-custom-toggle"
            onPress={() => {
              setCustom((v) => !v);
              if (!custom) setServer("");
              else setServer(serverList[0]?.url || DEFAULT_SERVERS.primary);
            }}
            style={({ focused }) => [styles.customLink, focused && styles.focused]}
          >
            <Ionicons name={custom ? "chevron-up" : "chevron-down"} size={14} color={colors.textDim} />
            <Text style={styles.customText}>Outro servidor</Text>
          </Pressable>

          {custom && (
            <Field
              label="Endereço do servidor"
              value={server}
              onChangeText={setServer}
              placeholder="http://servidor.com:8080"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              testID="login-server"
            />
          )}

          <Field
            label="Utilizador"
            value={user}
            onChangeText={setUser}
            placeholder="utilizador"
            autoCapitalize="none"
            autoCorrect={false}
            testID="login-user"
          />

          <Field
            label="Palavra-passe"
            value={pass}
            onChangeText={setPass}
            placeholder="••••••••"
            secureTextEntry={!showPass}
            autoCapitalize="none"
            testID="login-pass"
            rightIcon={
              <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8} testID="login-toggle-pass">
                <Ionicons name={showPass ? "eye-off" : "eye"} size={18} color={colors.textMuted} />
              </Pressable>
            }
          />

          <View style={styles.rememberRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rememberTitle}>Lembrar acesso</Text>
              <Text style={styles.rememberHint}>Credenciais guardadas no armazenamento seguro do dispositivo.</Text>
            </View>
            <Switch
              testID="login-remember"
              value={remember}
              onValueChange={setRemember}
              trackColor={{ true: colors.gold, false: colors.surface3 }}
              thumbColor={colors.text}
            />
          </View>
        </View>

        {syncNotice && (
          <View style={styles.syncBox} testID="login-sync-notice">
            <Ionicons name="hourglass-outline" size={24} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.syncTitle}>
                {countdown > 0 ? `Sincronizando com o servidor (${countdown}s)` : "Sincronização Finalizada"}
              </Text>
              <Text style={styles.syncText}>{syncNotice}</Text>
            </View>
          </View>
        )}

        {loading && stage && (
          <View style={styles.stageBox} testID="login-stage">
            <ActivityIndicator color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stageText}>{STAGE_LABEL[stage.s]}</Text>
              {stage.d ? <Text style={styles.stageDetail}>{stage.d}</Text> : null}
            </View>
          </View>
        )}

        {error && (
          <View style={styles.errorBox} testID="login-error">
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <GoldButton
          testID="login-submit"
          label={countdown > 0 ? `AGUARDE (${countdown}s)` : "ENTRAR"}
          onPress={submit}
          loading={loading && !trialLoading && countdown === 0}
          disabled={countdown > 0}
          style={[styles.submitBtn, countdown > 0 && styles.disabledBtn]}
        />

        <Pressable
          testID="login-trial-button"
          onPress={handleRequestTrial}
          disabled={loading || trialLoading || countdown > 0}
          style={({ focused, pressed }) => [
            styles.trialBtn,
            (loading || trialLoading || countdown > 0) && styles.disabledBtn,
            focused && styles.focused,
            pressed && { opacity: 0.8 },
          ]}
        >
          {trialLoading ? (
            <ActivityIndicator color={colors.gold} size="small" />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color={colors.gold} />
              <Text style={styles.trialBtnText}>TESTAR GRÁTIS POR 3 HORAS</Text>
            </>
          )}
        </Pressable>

        <Pressable
          testID="login-m3u"
          onPress={() => router.push("/add-list")}
          style={({ focused }) => [styles.altLink, focused && styles.focused]}
        >
          <Ionicons name="link" size={16} color={colors.gold} />
          <Text style={styles.altText}>Usar lista M3U (URL ou arquivo)</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, rightIcon, testID, ...props }: any) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldWrap}>
        <TextInput testID={testID} placeholderTextColor={colors.textDim} style={styles.input} {...props} />
        {rightIcon ? <View style={{ marginLeft: spacing.sm }}>{rightIcon}</View> : null}
      </View>
    </View>
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
  subtitle: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: spacing.xs },
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
  serverChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  serverBtn: {
    flex: 1,
    minWidth: 120,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
  },
  serverBtnActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  serverText: { color: colors.text, fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  customLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
  },
  customText: { color: colors.textDim, fontSize: 12 },
  focused: { borderColor: colors.gold, borderWidth: 2 },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rememberTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
  rememberHint: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  syncBox: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: "rgba(229, 169, 59, 0.12)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.35)",
  },
  syncTitle: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  syncText: {
    color: "#E2E5EE",
    fontSize: 12,
    lineHeight: 18,
  },
  stageBox: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  stageText: { color: colors.text, fontSize: 14 },
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
  submitBtn: {
    marginTop: spacing.xl,
  },
  disabledBtn: {
    opacity: 0.6,
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
    fontSize: 14,
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
  altText: { color: colors.gold, fontSize: 14, fontWeight: "600" },
});
