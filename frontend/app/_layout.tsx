import { Stack } from "expo-router";
import {
  LogBox,
  View,
  Text,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Image,
  Platform,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useSession } from "../src/store/session";
import { reportError } from "../src/utils/logger";

LogBox.ignoreAllLogs(true);

// Versão instalada neste APK. Suba para 2, 3, etc. a cada nova compilação
const APP_VERSION_CODE = 1;

const URL_PARCEIROS =
  "https://gist.githubusercontent.com/anderson009470/e32d3a695c62065c1b82513edcf7dbc9/raw/parceiros.json";

const URL_VERSION =
  "https://raw.githubusercontent.com/anderson009470/GoldCastStreaming/main/version.json";

const _WARM = [
  require("../assets/images/goldcast-logo.png"),
  require("../assets/images/icon.png"),
];

SplashScreen.preventAutoHideAsync().catch(() => {});

// SISTEMA DE ATUALIZAÇÃO AUTOMÁTICA (AUTO-UPDATE)
function AutoUpdateModal() {
  const [updateInfo, setUpdateInfo] = useState<{
    versionCode: number;
    versionName: string;
    apkUrl: string;
    changelog: string;
    forceUpdate?: boolean;
  } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    checarAtualizacao();
  }, []);

  const checarAtualizacao = async () => {
    try {
      const res = await fetch(`${URL_VERSION}?t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.versionCode > APP_VERSION_CODE && data.apkUrl) {
        setUpdateInfo(data);
        setVisible(true);
      }
    } catch {
      // Ignora falhas silenciosamente caso esteja sem internet
    }
  };

  if (!visible || !updateInfo) return null;

  const handleUpdate = async () => {
    try {
      await Linking.openURL(updateInfo.apkUrl);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o link de download do aplicativo.");
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.updateOverlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>🚀</Text>
          </View>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {updateInfo.forceUpdate ? "ATUALIZAÇÃO OBRIGATÓRIA" : "NOVA VERSÃO DISPONÍVEL"}
            </Text>
          </View>

          <Text style={styles.title}>
            GoldCast v{updateInfo.versionName || updateInfo.versionCode}
          </Text>
          <Text style={styles.subtitle}>
            Uma nova versão com melhorias de velocidade e estabilidade está disponível.
          </Text>

          {updateInfo.changelog ? (
            <View style={styles.changelogBox}>
              <Text style={styles.changelogTitle}>Novidades:</Text>
              <Text style={styles.changelogText}>{updateInfo.changelog}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            onPress={handleUpdate}
          >
            <Text style={styles.btnText}>ATUALIZAR AGORA</Text>
          </Pressable>

          {!updateInfo.forceUpdate && (
            <Pressable
              style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setVisible(false)}
            >
              <Text style={styles.dismissBtnText}>Lembrar mais tarde</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

// TRAVA DE PARCERIA EMBUTIDA
function PartnerLock() {
  const [bloqueado, setBloqueado] = useState(false);
  const [verificandoInicial, setVerificandoInicial] = useState(true);
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    checarLicencaSalva();
  }, []);

  const checarLicencaSalva = async () => {
    try {
      const codigoSalvo = await AsyncStorage.getItem("goldcast_partner_code");

      if (!codigoSalvo) {
        setBloqueado(true);
        setVerificandoInicial(false);
        return;
      }

      const res = await fetch(`${URL_PARCEIROS}?t=${Date.now()}`);
      if (res.ok) {
        const parceiros = await res.json();
        const info = parceiros[codigoSalvo];

        if (!info || !info.ativo) {
          await AsyncStorage.removeItem("goldcast_partner_code");
          await AsyncStorage.removeItem("goldcast_partner_name");
          setBloqueado(true);
          Alert.alert(
            "Licença Suspensa",
            "A parceria corporativa vinculada a este aplicativo foi suspensa ou desativada."
          );
        } else {
          setBloqueado(false);
        }
      } else {
        setBloqueado(false);
      }
    } catch (e) {
      setBloqueado(false);
    } finally {
      setVerificandoInicial(false);
    }
  };

  const validarCodigo = async () => {
    const chave = codigo.trim().toUpperCase();
    if (!chave) {
      Alert.alert("Atenção", "Digite o código de ativação da empresa parceira.");
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch(`${URL_PARCEIROS}?t=${Date.now()}`);
      if (!res.ok) {
        throw new Error("Falha ao consultar servidor");
      }

      const parceiros = await res.json();
      const info = parceiros[chave];

      if (!info) {
        Alert.alert("Código Inválido", "Este código de parceria não foi encontrado.");
        setCarregando(false);
        return;
      }

      if (!info.ativo) {
        Alert.alert("Acesso Suspenso", "Esta licença corporativa encontra-se inativa.");
        setCarregando(false);
        return;
      }

      if (info.validade) {
        const dataExp = new Date(info.validade);
        if (dataExp < new Date()) {
          Alert.alert("Licença Expirada", "A licença desta empresa parceira expirou.");
          setCarregando(false);
          return;
        }
      }

      await AsyncStorage.setItem("goldcast_partner_code", chave);
      await AsyncStorage.setItem("goldcast_partner_name", info.empresa || "Parceiro Oficial");

      Alert.alert(
        "Acesso Autorizado! 🎉",
        `Bem-vindo ao GoldCast!\nParceria: ${info.empresa}`
      );

      setBloqueado(false);
    } catch (err) {
      Alert.alert("Erro de Conexão", "Não foi possível validar o código. Verifique sua conexão com a internet.");
    } finally {
      setCarregando(false);
    }
  };

  if (verificandoInicial) {
    return null;
  }

  return (
    <Modal visible={bloqueado} animationType="fade" transparent={false}>
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>🛡️</Text>
          </View>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>ACESSO EXCLUSIVO POR PARCERIA</Text>
          </View>

          <Text style={styles.title}>Ativação GoldCast</Text>
          <Text style={styles.subtitle}>
            Insira o código de liberação fornecido pela empresa parceira para desbloquear as transmissões.
          </Text>

          <View style={styles.inputBox}>
            <Text style={styles.inputIcon}>🔑</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 749215"
              placeholderTextColor="#666"
              value={codigo}
              onChangeText={setCodigo}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            onPress={validarCodigo}
            disabled={carregando}
          >
            {carregando ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.btnText}>LIBERAR ACESSO</Text>
            )}
          </Pressable>

          <Text style={styles.helpText}>
            Ainda não tem um código? Entre em contato com a empresa parceira.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Intercetor global de erros e crashes inesperados
    try {
      const errorUtils = typeof ErrorUtils !== "undefined" ? ErrorUtils : (global as any).ErrorUtils;
      if (errorUtils) {
        const defaultErrorHandler = errorUtils.getGlobalHandler();
        errorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
          reportError("global_crash", error, `Fatal: ${isFatal}`);
          if (defaultErrorHandler) {
            defaultErrorHandler(error, isFatal);
          }
        });
      }
    } catch {}

    useSession.getState().restore();
    _WARM.forEach((a) => {
      try {
        const uri = Image.resolveAssetSource(a)?.uri;
        if (uri && Platform.OS === "web") Image.prefetch(uri);
      } catch {}
    });
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>
        <BottomSheetModalProvider>
          <View style={{ flex: 1, backgroundColor: "#000" }}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#000" },
                animation: "fade",
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="device" />
              <Stack.Screen name="login" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="movie/[id]" options={{ animation: "slide_from_right" }} />
              <Stack.Screen name="series/[id]" options={{ animation: "slide_from_right" }} />
              <Stack.Screen
                name="add-list"
                options={{ presentation: "modal", animation: "slide_from_bottom" }}
              />
              <Stack.Screen
                name="player"
                options={{ presentation: "fullScreenModal", animation: "fade" }}
              />
            </Stack>

            {/* Trava de Parceria Corporativa */}
            <PartnerLock />

            {/* Verificador de Atualizações Automáticas */}
            <AutoUpdateModal />
          </View>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07080A",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  updateOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    backgroundColor: "#111318",
    paddingVertical: 32,
    paddingHorizontal: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.25)",
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(229, 169, 59, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.3)",
  },
  iconEmoji: {
    fontSize: 34,
  },
  badge: {
    backgroundColor: "rgba(229, 169, 59, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeText: {
    color: "#E5A93B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  title: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#8E929C",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 19,
  },
  changelogBox: {
    width: "100%",
    backgroundColor: "#181B22",
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#282C35",
  },
  changelogTitle: {
    color: "#E5A93B",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  changelogText: {
    color: "#C2C6D1",
    fontSize: 12,
    lineHeight: 17,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#181B22",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#282C35",
    width: "100%",
    height: 52,
    marginTop: 22,
    paddingHorizontal: 12,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  input: {
    flex: 1,
    height: "100%",
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5A93B",
    height: 52,
    borderRadius: 12,
    width: "100%",
    marginTop: 18,
  },
  btnText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  dismissBtn: {
    paddingVertical: 12,
    marginTop: 6,
  },
  dismissBtnText: {
    color: "#8E929C",
    fontSize: 12,
    fontWeight: "600",
  },
  helpText: {
    color: "#555A65",
    fontSize: 11,
    textAlign: "center",
    marginTop: 18,
    lineHeight: 16,
  },
});
