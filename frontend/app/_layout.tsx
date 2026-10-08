import { Stack } from "expo-router";
import { LogBox, View, Image, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useSession } from "../src/store/session";
import { PartnerLock } from "../src/components/PartnerLock";

LogBox.ignoreAllLogs(true);

const _WARM = [
  require("../assets/images/goldcast-logo.png"),
  require("../assets/images/icon.png"),
];

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
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

            {/* Trava de Parcerias */}
            <PartnerLock />
          </View>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
