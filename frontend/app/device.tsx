import { useEffect } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../src/utils/theme";
import { useSession } from "../src/store/session";
import { listLists } from "../src/utils/api";

export default function DeviceSelect() {
  const router = useRouter();
  const setDeviceMode = useSession((s) => s.setDeviceMode);

  useEffect(() => {
    let active = true;
    (async () => {
      await setDeviceMode("mobile");
      const session = useSession.getState().session;
      const lists = await listLists().catch(() => []);
      if (!active) return;
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace(session || lists.length > 0 ? "/(tabs)" : "/login");
    })();
    return () => {
      active = false;
    };
  }, [router, setDeviceMode]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.gold} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
