import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius, spacing } from "../utils/theme";
import { accountState, useSession } from "../store/session";
import { fmtUnixSP, hostOf } from "../services/xtream";

const NA = "Não informado";

export function AccountCard({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const session = useSession((s) => s.session);
  const catalog = useSession((s) => s.catalog);
  if (!session) return null;
  const st = accountState(session);
  const ui = session.userInfo || {};
  const si = session.serverInfo || {};
  const isTrial = ui.is_trial != null ? Number(ui.is_trial) === 1 : null;
  const badge = st === "active" ? { color: colors.success, label: "🟢 CONTA ATIVA" } : st === "expired" ? { color: colors.error, label: "🔴 ACESSO EXPIRADO/INATIVO" } : { color: colors.error, label: "🔴 CREDENCIAIS INVÁLIDAS" };
  const exp = fmtUnixSP(ui.exp_date);
  const created = fmtUnixSP(ui.created_at, false);
  const cons = ui.max_connections != null ? `${ui.active_cons ?? "0"}/${ui.max_connections}` : null;

  const rows: [string, string][] = [
    ["Usuário", ui.username || session.username],
    ["Servidor", si.url ? `${si.url}${si.port ? ":" + si.port : ""}${si.https_port ? " · HTTPS " + si.https_port : ""}` : hostOf(session.server)],
    ["Expira em", exp || NA],
    ["Conexões", cons || NA],
    ["Tipo de conta", isTrial == null ? NA : isTrial ? "Teste" : "Normal"],
  ];
  if (!compact) {
    rows.push(["Criada em", created || NA]);
    rows.push(["Formatos", (ui.allowed_output_formats || []).join(", ") || NA]);
    if (si.timezone) rows.push(["Fuso do servidor", si.timezone]);
    if (si.xui != null) rows.push(["Painel", `XUI${si.version ? " " + si.version : ""}`]);
    rows.push(["Canais", catalog.liveLoaded ? String(catalog.live.length) : "—"]);
    rows.push(["Filmes", catalog.vodLoaded ? String(catalog.vod.length) : "—"]);
    rows.push(["Séries", catalog.seriesLoaded ? String(catalog.series.length) : "—"]);
  }

  return (
    <View style={styles.card} testID="account-card">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.badge, { color: badge.color }]}>{badge.label}</Text>
          <Text style={styles.title}>Conta Xtream/XUI</Text>
        </View>
        <Pressable testID="account-switch" onPress={() => router.push("/login")} hitSlop={8} style={({ focused }) => [styles.iconBtn, focused && styles.focused]}>
          <Ionicons name="person-circle-outline" size={20} color={colors.gold} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.cell}>
            <Text style={styles.k}>{k}</Text>
            <Text style={styles.v} numberOfLines={2}>{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface2, borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(212,175,55,0.35)", padding: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  badge: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  title: { color: colors.text, fontSize: 17, fontWeight: "600", marginTop: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  focused: { borderWidth: 2, borderColor: colors.gold },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, rowGap: spacing.md },
  cell: { width: "50%", paddingRight: spacing.sm },
  k: { color: colors.textDim, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  v: { color: colors.text, fontSize: 14, fontWeight: "600", marginTop: 2 },
});
