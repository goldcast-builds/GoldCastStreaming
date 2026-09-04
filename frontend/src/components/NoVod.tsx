import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, spacing } from "../utils/theme";

export function NoVod({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]} testID={`${title.toLowerCase()}-unavailable`}>
      <Text style={styles.h1}>{title}</Text>
      <View style={styles.center}>
        <Ionicons name="film-outline" size={44} color={colors.textDim} />
        <Text style={styles.text}>Este conteúdo não está disponível nesta lista.</Text>
        <Text style={styles.hint}>Filmes e séries são fornecidos apenas por contas Xtream/XUI.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 22, fontWeight: "700", paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  text: { color: colors.text, fontSize: 15, fontWeight: "600", textAlign: "center" },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
});
