import { Pressable, Text, StyleSheet, ActivityIndicator, View, ViewStyle } from "react-native";
import { colors, radius, spacing } from "../utils/theme";
import { LinearGradient } from "expo-linear-gradient";

export function GoldButton({
  label,
  onPress,
  icon,
  loading,
  disabled,
  variant = "primary",
  testID,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost";
  testID?: string;
  style?: ViewStyle;
}) {
  const isPrimary = variant === "primary";
  const isOutline = variant === "outline";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed, hovered, focused }) => [
        styles.base,
        isOutline && styles.outline,
        variant === "ghost" && styles.ghost,
        (pressed || hovered) && { opacity: 0.9 },
        focused && styles.focused,
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={[colors.goldLight, colors.gold, colors.goldDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.row}>
            {loading ? <ActivityIndicator color={colors.onGold} /> : icon}
            <Text style={[styles.label, { color: colors.onGold }]}>{label}</Text>
          </View>
        </LinearGradient>
      ) : (
        <View style={styles.row}>
          {loading ? <ActivityIndicator color={colors.gold} /> : icon}
          <Text style={[styles.label, { color: isOutline ? colors.gold : colors.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.pill,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  gradient: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  outline: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: "transparent",
    paddingHorizontal: spacing.xl,
  },
  ghost: {
    backgroundColor: "transparent",
    paddingHorizontal: spacing.xl,
  },
  focused: {
    borderWidth: 2,
    borderColor: colors.borderFocus,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { fontSize: 16, fontWeight: "600", letterSpacing: 0.4 },
});
