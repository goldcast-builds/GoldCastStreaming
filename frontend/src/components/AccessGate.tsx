import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius, spacing } from "../utils/theme";
import { accountState, useSession } from "../store/session";

/** Blocks content when the panel reports the account as expired/invalid. */
export function AccessGate({ children }: { children: React.ReactNode }) {
  const session = useSession((s) => s.session);
  const source = useSession((s) => s.source);
  const router = useRouter();
  if (source?.kind === "list") return <>{children}</>;
  const st = accountState(session);
  if (st === "active") return <>{children}</>;
  return (
    <View style={styles.root} testID="access-blocked">
      <Ionicons name={st === "none" ? "log-in-outline" : "lock-closed"} size={44} color={colors.gold} />
      <Text style={styles.title}>
        {st === "none" ? "Faça login para acessar" : st === "expired" ? "Seu acesso expirou ou está inativo." : "Usuário ou senha inválidos."}
      </Text>
      <Text style={styles.hint}>
        {st === "none" ? "Informe servidor, usuário e senha fornecidos pelo seu serviço." : "Entre em contato com seu provedor para renovar o acesso."}
      </Text>
      <Pressable testID="blocked-login" onPress={() => router.push("/login")} style={({ focused }) => [styles.btn, focused && styles.focused]}>
        <Text style={styles.btnText}>{st === "none" ? "ENTRAR" : "ENTRAR COM OUTRA CONTA"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 17, fontWeight: "700", textAlign: "center" },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  btn: { marginTop: spacing.sm, backgroundColor: colors.gold, paddingHorizontal: 22, height: 46, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  btnText: { color: colors.onGold, fontWeight: "700", fontSize: 13, letterSpacing: 0.4 },
  focused: { borderWidth: 2, borderColor: colors.text },
});
