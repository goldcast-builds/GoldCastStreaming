import { Tabs } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { colors } from "../../src/utils/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: "#8A8A8A",
        tabBarStyle: {
          backgroundColor: Platform.OS === "web" ? colors.bg : "rgba(0,0,0,0.75)",
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarBackground: () =>
          Platform.OS !== "web" ? (
            <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />
          ),
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
        tabBarItemStyle: { alignSelf: "center" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          tabBarButtonTestID: "tab-home",
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "TV ao vivo",
          tabBarIcon: ({ color, size }) => <Ionicons name="tv" size={size} color={color} />,
          tabBarButtonTestID: "tab-live",
        }}
      />
      <Tabs.Screen
        name="movies"
        options={{
          title: "Filmes",
          tabBarIcon: ({ color, size }) => <Ionicons name="film" size={size} color={color} />,
          tabBarButtonTestID: "tab-movies",
        }}
      />
      <Tabs.Screen
        name="series"
        options={{
          title: "Séries",
          tabBarIcon: ({ color, size }) => <Ionicons name="albums" size={size} color={color} />,
          tabBarButtonTestID: "tab-series",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Configurações",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-sharp" size={size} color={color} />,
          tabBarButtonTestID: "tab-settings",
        }}
      />
    </Tabs>
  );
}
