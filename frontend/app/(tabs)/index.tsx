import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Logo } from "../../src/components/Logo";
import { GoldButton } from "../../src/components/GoldButton";
import { colors, radius, spacing } from "../../src/utils/theme";
import { deleteList, IPTVList, listLists, refreshList, setActiveListId } from "../../src/utils/api";

function fmtExp(exp?: string | null): string | null {
  if (!exp) return null;
  try {
    const d = new Date(exp);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return null;
  }
}

function StatusDot({ status }: { status: IPTVList["status"] }) {
  const map: Record<IPTVList["status"], { color: string; label: string }> = {
    connected: { color: colors.success, label: "Conectada" },
    updating: { color: colors.warning, label: "Atualizando" },
    offline: { color: colors.textDim, label: "Offline" },
    error: { color: colors.error, label: "Erro" },
  };
  const s = map[status] ?? map.offline;
  return (
    <View style={styles.statusRow}>
      <View style={[styles.dot, { backgroundColor: s.color }]} />
      <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

function ListCard({
  item,
  onOpen,
  onDelete,
  onRefresh,
}: {
  item: IPTVList;
  onOpen: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const exp = fmtExp(item.meta?.expiration_date);
  const rows: { label: string; value: string }[] = [];
  if (item.meta?.channels_count != null) rows.push({ label: "Canais", value: String(item.meta.channels_count) });
  if (item.meta?.movies_count != null) rows.push({ label: "Filmes", value: String(item.meta.movies_count) });
  if (item.meta?.series_count != null) rows.push({ label: "Séries", value: String(item.meta.series_count) });
  if (exp) rows.push({ label: "Expira", value: exp });

  return (
    <Pressable
      testID={`list-card-${item.id}`}
      onPress={onOpen}
      style={({ focused, pressed }) => [
        styles.card,
        focused && styles.cardFocused,
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <StatusDot status={item.status} />
        </View>
        <View style={styles.iconActions}>
          <Pressable testID={`refresh-list-${item.id}`} onPress={onRefresh} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="refresh" size={18} color={colors.gold} />
          </Pressable>
          <Pressable testID={`delete-list-${item.id}`} onPress={onDelete} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {rows.length > 0 ? (
        <View style={styles.metaRow}>
          {rows.map((r) => (
            <View key={r.label} style={styles.metaItem}>
              <Text style={styles.metaLabel}>{r.label}</Text>
              <Text style={styles.metaValue}>{r.value}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.metaHint}>Informações não disponíveis</Text>
      )}
    </Pressable>
  );
}

export default function HomeTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [lists, setLists] = useState<IPTVList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listLists();
      setLists(data);
    } catch (e: any) {
      console.warn("load lists", e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const handleDelete = (item: IPTVList) => {
    if (typeof window !== "undefined" && (window as any).confirm) {
      const ok = (window as any).confirm(`Excluir "${item.name}"?`);
      if (!ok) return;
      deleteList(item.id).then(load).catch(() => {});
      return;
    }
    Alert.alert("Excluir lista", `Deseja remover "${item.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try { await deleteList(item.id); load(); } catch {}
        },
      },
    ]);
  };

  const handleRefresh = async (item: IPTVList) => {
    try { await refreshList(item.id); load(); } catch {}
  };

  const handleOpen = async (item: IPTVList) => {
    await setActiveListId(item.id);
    router.push("/(tabs)/live");
  };

  return (
    <ScrollView
      testID="home-screen"
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl }]}
      refreshControl={<RefreshControl tintColor={colors.gold} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View style={styles.logoWrap}>
        <Logo size={140} />
      </View>

      <Text style={styles.welcome}>Bem-vindo ao</Text>
      <Text style={styles.brand}>GoldCast Streaming</Text>
      <Text style={styles.subtitle}>
        Seu player IPTV completo.{"\n"}Adicione sua lista e aproveite o melhor conteúdo.
      </Text>

      <GoldButton
        testID="add-list-primary"
        label="+ ADICIONAR LISTA"
        icon={<Ionicons name="add-circle" size={20} color={colors.onGold} />}
        onPress={() => router.push("/add-list")}
        style={{ marginTop: spacing.xl }}
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Minhas listas</Text>
        {lists.length > 0 && (
          <Pressable testID="add-list-secondary" onPress={() => router.push("/add-list")} hitSlop={8}>
            <Text style={styles.link}>+ Adicionar nova lista</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : lists.length === 0 ? (
        <View style={styles.emptyState} testID="empty-lists">
          <Ionicons name="list-outline" size={40} color={colors.textDim} />
          <Text style={styles.emptyText}>Nenhuma lista cadastrada ainda.</Text>
          <Text style={styles.emptyHint}>Toque em "Adicionar Lista" para começar.</Text>
        </View>
      ) : (
        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          {lists.map((l) => (
            <ListCard
              key={l.id}
              item={l}
              onOpen={() => handleOpen(l)}
              onDelete={() => handleDelete(l)}
              onRefresh={() => handleRefresh(l)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg },
  logoWrap: { alignItems: "center", marginTop: spacing.md, marginBottom: spacing.md },
  welcome: { color: colors.textMuted, fontSize: 16, textAlign: "center" },
  brand: {
    color: colors.gold,
    fontSize: 30,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.6,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "600" },
  link: { color: colors.gold, fontSize: 13, fontWeight: "600" },
  emptyState: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.xxl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  emptyHint: { color: colors.textMuted, fontSize: 13 },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardFocused: { borderColor: colors.gold, borderWidth: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "600" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "600" },
  iconActions: { flexDirection: "row", gap: spacing.sm },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface3,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  metaItem: { minWidth: 70 },
  metaLabel: { color: colors.textDim, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { color: colors.text, fontSize: 15, fontWeight: "600", marginTop: 2 },
  metaHint: { color: colors.textDim, fontSize: 12, marginTop: spacing.sm, fontStyle: "italic" },
});
