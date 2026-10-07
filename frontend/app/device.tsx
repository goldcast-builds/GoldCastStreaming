import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Logo } from "../src/components/Logo";
import { colors, radius, spacing } from "../src/utils/theme";
import { DeviceMode, useSession } from "../src/store/session";
import { listLists } from "../src/utils/api";

export default function DeviceSelect() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setDeviceMode = useSession((s) => s.setDeviceMode);

  const choose = async (m: DeviceMode) => {
    await setDeviceMode(m);
    const session = useSession.getState().session;
    const lists = await listLists().catch(() => []);
    if (router.canGoBack()) { router.back(); return; }
    router.replace(session || lists.length > 0 ? "/(tabs)" : "/login");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]} testID="device-screen">
      <Logo size={120} />
      <Text style={styles.title}>Tipo de Aparelho</Text>
      <Text style={styles.hint}>Para otimizar a navegação e os controles, selecione o dispositivo em que o GoldCast Streaming está sendo executado.</Text>
      <View style={styles.options}>
        <Pressable testID="device-tv" onPress={() => choose("tv")} hasTVPreferredFocus style={({ focused, pressed }) => [styles.opt, focused && styles.focused, pressed && { opacity: 0.9 }]}>
          <Ionicons name="tv" size={40} color={colors.gold} />
          <Text style={styles.optTitle}>Smart TV / TV Box</Text>
          <Text style={styles.optSub}>Controle remoto (D-pad)</Text>
        </Pressable>
        <Pressable testID="device-mobile" onPress={() => choose("mobile")} style={({ focused, pressed }) => [styles.opt, focused && styles.focused, pressed && { opacity: 0.9 }]}>
          <Ionicons name="phone-portrait" size={40} color={colors.gold} />
          <Text style={styles.optTitle}>Celular / Tablet</Text>
          <Text style={styles.optSub}>Tela sensível ao toque</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  title: { color: colors.gold, fontSize: 24, fontWeight: "700", letterSpacing: 0.6, marginTop: spacing.md },
  hint: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 480 },
  options: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.lg, marginTop: spacing.xl },
  opt: { width: 200, paddingVertical: spacing.xl, alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  focused: { borderColor: colors.gold, borderWidth: 2, transform: [{ scale: 1.04 }], backgroundColor: colors.surface3 },
  optTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  optSub: { color: colors.textDim, fontSize: 12 },
});
