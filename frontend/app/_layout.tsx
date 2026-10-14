import { Stack } from "expo-router";
import {
  LogBox,
  View,
  Text,
  Modal,
  Alert,
  Pressable,
  StyleSheet,
  Image,
  Platform,
  Linking,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useSession } from "../src/store/session";
import { reportError } from "../src/utils/logger";

LogBox.ignoreAllLogs(true);

const APP_VERSION_CODE = 1;
const URL_VERSION =
  "https://raw.githubusercontent.com/anderson009470/GoldCastStreaming/main/version.json";

const _WARM = [
  require("../assets/images/goldcast-logo.png"),
  require("../assets/images/icon.png"),
];

SplashScreen.preventAutoHideAsync().catch(() => {});

// SISTEMA DE ATUALIZAÇÃO AUTOMÁTICA
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
    } catch {}
  };

  if (!visible || !updateInfo) return null;

  const handleUpdate = async () => {
    try {
      await Linking.openURL(updateInfo.apkUrl);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o link de download.");
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

export default function RootLayout() {
  useEffect(() => {
    try {
      const errorUtils =
        typeof ErrorUtils !== "undefined" ? ErrorUtils : (global as any).ErrorUtils;
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

            <AutoUpdateModal />
          </View>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
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
});
