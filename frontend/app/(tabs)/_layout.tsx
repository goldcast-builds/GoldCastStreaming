import { useState } from "react";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View, Text } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/utils/theme";
import { IntroSplash } from "../../src/components/IntroSplash";

export default function TabsLayout() {
  const [showIntro, setShowIntro] = useState(true);
  const insets = useSafeAreaInsets();

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
            tabBarIcon: () => (
              <Text style={{ fontSize: 20 }}>🏠</Text>
            ),
            tabBarButtonTestID: "tab-home",
          }}
        />
        <Tabs.Screen
          name="live"
          options={{
            title: "TV ao vivo",
            tabBarIcon: () => (
              <Text style={{ fontSize: 20 }}>📺</Text>
            ),
            tabBarButtonTestID: "tab-live",
          }}
        />
        <Tabs.Screen
          name="movies"
          options={{
            title: "Filmes",
            tabBarIcon: () => (
              <Text style={{ fontSize: 20 }}>🎬</Text>
            ),
            tabBarButtonTestID: "tab-movies",
          }}
        />
        <Tabs.Screen
          name="series"
          options={{
            title: "Séries",
            tabBarIcon: () => (
              <Text style={{ fontSize: 20 }}>🎞️</Text>
            ),
            tabBarButtonTestID: "tab-series",
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Configurações",
            tabBarIcon: () => (
              <Text style={{ fontSize: 20 }}>⚙️</Text>
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
