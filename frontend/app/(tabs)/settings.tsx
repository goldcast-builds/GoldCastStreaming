import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { useCallback, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Logo } from "../../src/components/Logo";
import { AccountCard } from "../../src/components/AccountCard";
import { colors, radius, spacing } from "../../src/utils/theme";
import { deleteList, IPTVList, listLists, refreshList, setActiveListId } from "../../src/utils/api";
import { useSession } from "../../src/store/session";

const TYPE_LABEL: Record<IPTVList["type"], string> = {
  xtream: "Xtream Codes",
  m3u_url: "URL M3U",
  m3u_file: "Arquivo M3U",
};

export default function SettingsTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [lists, setLists] = useState<IPTVList[]>([]);
  const [busy, setBusy] = useState(false);
  const session = useSession((s) => s.session);
  const ud = useSession((s) => s.ud);
  const refreshAccount = useSession((s) => s.refreshAccount);
  const logout = useSession((s) => s.logout);
  const clearHistory = useSession((s) => s.clearHistory);
  const setSource = useSession((s) => s.setSource);

  const askLogout = () => {
    const doIt = async () => { await logout(); router.replace("/login"); };
    if (typeof window !== "undefined" && (window as any).confirm) { if ((window as any).confirm("Sair da conta?")) doIt(); return; }
    Alert.alert("Sair", "Deseja sair da conta? Favoritos e histórico ficam guardados neste dispositivo.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: doIt },
    ]);
  };

  const load = useCallback(async () => {
    try { setLists(await listLists()); } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const askDelete = (l: IPTVList) => {
    const doIt = async () => { try { await deleteList(l.id); load(); } catch {} };
    if (typeof window !== "undefined" && (window as any).confirm) {
      if ((window as any).confirm(`Excluir "${l.name}"?`)) doIt();
      return;
    }
    Alert.alert("Excluir", `Remover "${l.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: doIt },
    ]);
  };

  return (
    <ScrollView
      testID="settings-screen"
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: 120 }}
    >
      <View style={styles.header}>
        <Logo size={80} />
        <Text style={styles.appName}>GoldCast Streaming</Text>
        <Text style={styles.appVersion}>Configurações</Text>
      </View>

      <Section title="Conta">
        {session ? (
          <View style={{ padding: spacing.sm, gap: spacing.sm }}>
            <AccountCard />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable testID="account-refresh" onPress={async () => { setBusy(true); try { await refreshAccount(); } catch {} finally { setBusy(false); } }} style={({ focused }) => [styles.pillBtn, focused && styles.focused]}>
                {busy ? <ActivityIndicator color={colors.gold} size="small" /> : <Ionicons name="refresh" size={16} color={colors.gold} />}
                <Text style={styles.pillText}>ATUALIZAR CONTA</Text>
              </Pressable>
              <Pressable testID="account-logout" onPress={askLogout} style={({ focused }) => [styles.pillBtn, { borderColor: colors.error }, focused && styles.focused]}>
                <Ionicons name="log-out-outline" size={16} color={colors.error} />
                <Text style={[styles.pillText, { color: colors.error }]}>SAIR</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable testID="settings-login" style={styles.addRow} onPress={() => router.push("/login")}>
            <Ionicons name="log-in-outline" size={20} color={colors.gold} />
            <Text style={styles.addLabel}>Entrar com usuário e senha (Xtream/XUI)</Text>
          </Pressable>
        )}
      </Section>

      <Section title="Histórico e favoritos">
        <View style={styles.row}>
          <View style={styles.rowIcon}><Ionicons name="time-outline" size={18} color={colors.gold} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Recentes</Text>
            <Text style={styles.rowSub}>{ud.recents.live.length} canais · {ud.recents.vod.length} filmes · {ud.recents.series.length} séries</Text>
          </View>
          <Pressable testID="clear-history" onPress={() => clearHistory()} style={styles.actionBtn} hitSlop={6}>
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </Pressable>
        </View>
        <View style={styles.row}>
          <View style={styles.rowIcon}><Ionicons name="star" size={18} color={colors.gold} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Favoritos</Text>
            <Text style={styles.rowSub}>{ud.favorites.live.length} canais · {ud.favorites.vod.length} filmes · {ud.favorites.series.length} séries</Text>
          </View>
        </View>
      </Section>

      <Section title="Gerenciar Listas M3U">
        {lists.length === 0 ? (
          <Text style={styles.hint}>Nenhuma lista cadastrada.</Text>
        ) : (
          lists.map((l) => (
            <View key={l.id} style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name={l.type === "xtream" ? "key" : l.type === "m3u_url" ? "link" : "document"} size={18} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{l.name}</Text>
                <Text style={styles.rowSub}>{TYPE_LABEL[l.type]}</Text>
              </View>
              <Pressable
                testID={`activate-${l.id}`}
                onPress={async () => { await setActiveListId(l.id); await setSource({ kind: "list", listId: l.id }); load(); router.push("/(tabs)/live"); }}
                style={styles.actionBtn}
                hitSlop={6}
              >
                <Ionicons name="play" size={16} color={colors.gold} />
              </Pressable>
              <Pressable
                testID={`refresh-${l.id}`}
                onPress={async () => { try { await refreshList(l.id); load(); } catch {} }}
                style={styles.actionBtn}
                hitSlop={6}
              >
                <Ionicons name="refresh" size={16} color={colors.textMuted} />
              </Pressable>
              <Pressable testID={`del-${l.id}`} onPress={() => askDelete(l)} style={styles.actionBtn} hitSlop={6}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </Pressable>
            </View>
          ))
        )}
        <Pressable testID="settings-add-list" style={styles.addRow} onPress={() => router.push("/add-list")}>
          <Ionicons name="add-circle" size={20} color={colors.gold} />
          <Text style={styles.addLabel}>Adicionar nova lista</Text>
        </Pressable>
      </Section>

      <Section title="Sobre">
        <View style={styles.row}>
          <View style={styles.rowIcon}><Ionicons name="information-circle" size={18} color={colors.gold} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Versão do aplicativo</Text>
            <Text style={styles.rowSub}>1.0.0</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.rowIcon}><Ionicons name="shield-checkmark" size={18} color={colors.gold} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>GoldCast Streaming</Text>
            <Text style={styles.rowSub}>Seu player IPTV premium</Text>
          </View>
        </View>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: "center", padding: spacing.lg, gap: 4 },
  appName: { color: colors.gold, fontSize: 20, fontWeight: "700", letterSpacing: 0.5, marginTop: spacing.sm },
  appVersion: { color: colors.textMuted, fontSize: 12 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionTitle: { color: colors.textMuted, fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: spacing.sm, marginLeft: spacing.xs },
  card: { backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  actionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, justifyContent: "center" },
  addLabel: { color: colors.gold, fontSize: 14, fontWeight: "600" },
  hint: { color: colors.textMuted, padding: spacing.md, textAlign: "center", fontSize: 13 },
  pillBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.gold },
  pillText: { color: colors.gold, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  focused: { borderWidth: 2 },
});
