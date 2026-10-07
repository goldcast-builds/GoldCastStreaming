import { useState } from "react";
import { Tabs } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/utils/theme";
import { IntroSplash } from "../../src/components/IntroSplash";

export default function TabsLayout() {
  const [showIntro, setShowIntro] = useState(true);
  const insets = useSafeAreaInsets();

  // Calcula a margem inferior para nunca colidir com os botões ou gestos do celular
  const bottomPadding = insets.bottom > 0 ? insets.bottom : 8;
  const tabHeight = 56 + bottomPadding;

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: "#8C92A4",
          tabBarStyle: {
            backgroundColor: Platform.OS === "web" ? colors.bg : "rgba(9, 10, 14, 0.94)",
            borderTopColor: "rgba(255, 255, 255, 0.08)",
            borderTopWidth: 1,
            height: tabHeight,
            paddingTop: 6,
            paddingBottom: bottomPadding,
            elevation: 10,
          },
          tabBarBackground: () =>
            Platform.OS !== "web" ? (
              <BlurView tint="dark" intensity={85} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />
            ),
          tabBarLabelStyle: { 
            fontSize: 10.5, 
            fontWeight: "700", 
            letterSpacing: 0.2,
            marginTop: 2,
          },
          tabBarItemStyle: { 
            alignSelf: "center",
            paddingVertical: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Início",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
            ),
            tabBarButtonTestID: "tab-home",
          }}
        />
        <Tabs.Screen
          name="live"
          options={{
            title: "TV ao vivo",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "tv" : "tv-outline"} size={22} color={color} />
            ),
            tabBarButtonTestID: "tab-live",
          }}
        />
        <Tabs.Screen
          name="movies"
          options={{
            title: "Filmes",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "film" : "film-outline"} size={22} color={color} />
            ),
            tabBarButtonTestID: "tab-movies",
          }}
        />
        <Tabs.Screen
          name="series"
          options={{
            title: "Séries",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "albums" : "albums-outline"} size={22} color={color} />
            ),
            tabBarButtonTestID: "tab-series",
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Configurações",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "settings" : "settings-outline"} size={22} color={color} />
            ),
            tabBarButtonTestID: "tab-settings",
          }}
        />
      </Tabs>

      {/* Abertura por cima da aplicação */}
      {showIntro && (
        <IntroSplash onFinish={() => setShowIntro(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
});
