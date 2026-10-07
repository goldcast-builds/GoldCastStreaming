import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, Switch, useWindowDimensions } from "react-native";
import { useCallback, useState } from "react";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Logo } from "../../src/components/Logo";
import { AccountCard } from "../../src/components/AccountCard";
import { colors, radius, spacing } from "../../src/utils/theme";
import { deleteList, IPTVList, listLists, refreshList, setActiveListId } from "../../src/utils/api";
import { useSession } from "../../src/store/session";

type SectionKey = "account" | "lists" | "refresh" | "playback" | "device" | "history" | "cache" | "about";

const TILES: { key: SectionKey | "logout"; label: string; icon: any }[] = [
  { key: "account", label: "Conta", icon: "person-circle-outline" },
  { key: "lists", label: "Listas M3U", icon: "list-outline" },
  { key: "refresh", label: "Atualizar conteúdo", icon: "cloud-download-outline" },
  { key: "playback", label: "Reprodução", icon: "play-circle-outline" },
  { key: "device", label: "Tipo de aparelho", icon: "tv-outline" },
  { key: "history", label: "Histórico e favoritos", icon: "time-outline" },
  { key: "cache", label: "Limpar cache", icon: "brush-outline" },
  { key: "about", label: "Sobre", icon: "information-circle-outline" },
  { key: "logout", label: "Sair", icon: "log-out-outline" },
];

const TYPE_LABEL: Record<IPTVList["type"], string> = { xtream: "Xtream Codes", m3u_url: "URL M3U", m3u_file: "Arquivo M3U" };

function confirm(title: string, msg: string, onOk: () => void) {
  if (typeof window !== "undefined" && (window as any).confirm) { if ((window as any).confirm(msg)) onOk(); return; }
  Alert.alert(title, msg, [{ text: "Cancelar", style: "cancel" }, { text: "OK", style: "destructive", onPress: onOk }]);
}

export default function SettingsTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [section, setSection] = useState<SectionKey | null>(null);
  const session = useSession((s) => s.session);
  const logout = useSession((s) => s.logout);
  const cols = width > 900 ? 6 : width > 600 ? 4 : 3;
  const tile = (width - spacing.lg * 2 - spacing.md * (cols - 1)) / cols;

  const onTile = (key: SectionKey | "logout") => {
    if (key === "logout") {
      confirm("Sair", "Sair da conta? Favoritos e histórico ficam guardados neste dispositivo.", async () => { await logout(); router.replace("/login"); });
      return;
    }
    setSection(key);
  };

  return (
    <ScrollView testID="settings-screen" style={styles.root} contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: 120 }}>
      <View style={styles.header}>
        {section ? (
          <Pressable testID="settings-back" onPress={() => setSection(null)} hitSlop={10} style={({ focused }) => [styles.backBtn, focused && styles.focused]}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : <View style={{ width: 40 }} />}
        <Text style={styles.title}>{section ? TILES.find((t) => t.key === section)?.label.toUpperCase() : "CONFIGURAÇÕES"}</Text>
        <View style={{ width: 40 }} />
      </View>

      {!section ? (
        <View style={styles.grid}>
          {TILES.filter((t) => t.key !== "logout" || session).map((t) => (
            <Pressable key={t.key} testID={`tile-${t.key}`} onPress={() => onTile(t.key)} style={({ focused, pressed }) => [styles.tile, { width: tile, height: tile }, focused && styles.tileFocused, pressed && { opacity: 0.85 }]}>
              <Ionicons name={t.icon} size={tile * 0.34} color={t.key === "logout" ? colors.error : colors.textMuted} />
              <Text style={styles.tileLabel} numberOfLines={2}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          {section === "account" && <AccountSection />}
          {section === "lists" && <ListsSection />}
          {section === "refresh" && <RefreshSection />}
          {section === "playback" && <PlaybackSection />}
          {section === "device" && <DeviceSection />}
          {section === "history" && <HistorySection />}
          {section === "cache" && <CacheSection />}
          {section === "about" && <AboutSection />}
        </View>
      )}
    </ScrollView>
  );
}

function Card({ children }: { children: React.ReactNode }) { return <View style={styles.card}>{children}</View>; }
function Row({ icon, title, sub, right }: { icon: any; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={18} color={colors.gold} /></View>
      <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{title}</Text>{!!sub && <Text style={styles.rowSub}>{sub}</Text>}</View>
      {right}
    </View>
  );
}
function PillBtn({ label, icon, onPress, testID, color = colors.gold, busy }: { label: string; icon: any; onPress: () => void; testID: string; color?: string; busy?: boolean }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ focused }) => [styles.pillBtn, { borderColor: color }, focused && styles.focused]}>
      {busy ? <ActivityIndicator color={color} size="small" /> : <Ionicons name={icon} size={16} color={color} />}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function AccountSection() {
  const router = useRouter();
  const session = useSession((s) => s.session);
  const refreshAccount = useSession((s) => s.refreshAccount);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!session) {
    return (
      <Card>
        <Pressable testID="settings-login" style={styles.addRow} onPress={() => router.push("/login")}>
          <Ionicons name="log-in-outline" size={20} color={colors.gold} /><Text style={styles.addLabel}>Entrar com usuário e senha</Text>
        </Pressable>
      </Card>
    );
  }
  return (
    <View style={{ gap: spacing.md }}>
      <AccountCard />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <PillBtn testID="account-refresh" label="ATUALIZAR CONTA" icon="refresh" busy={busy} onPress={async () => { setBusy(true); setMsg(null); try { await refreshAccount(); setMsg("Conta atualizada."); } catch (e: any) { setMsg(e?.message || "Falha ao atualizar."); } finally { setBusy(false); } }} />
        <PillBtn testID="account-switch-btn" label="TROCAR CONTA" icon="swap-horizontal" onPress={() => router.push("/login")} />
      </View>
      {!!msg && <Text style={styles.hint}>{msg}</Text>}
    </View>
  );
}

function ListsSection() {
  const router = useRouter();
  const setSource = useSession((s) => s.setSource);
  const [lists, setLists] = useState<IPTVList[]>([]);
  const load = useCallback(async () => { try { setLists(await listLists()); } catch {} }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <Card>
      {lists.length === 0 ? <Text style={styles.hint}>Nenhuma lista M3U cadastrada.</Text> : lists.map((l) => (
        <View key={l.id} style={styles.row}>
          <View style={styles.rowIcon}><Ionicons name={l.type === "xtream" ? "key" : l.type === "m3u_url" ? "link" : "document"} size={18} color={colors.gold} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>{l.name}</Text>
            <Text style={styles.rowSub}>{TYPE_LABEL[l.type]}{l.meta?.channels_count != null ? ` · ${l.meta.channels_count} canais` : ""}{l.last_updated ? ` · ${new Date(l.last_updated).toLocaleDateString("pt-BR")}` : ""}</Text>
          </View>
          <Pressable testID={`activate-${l.id}`} onPress={async () => { await setActiveListId(l.id); await setSource({ kind: "list", listId: l.id }); router.push("/(tabs)/live"); }} style={styles.actionBtn} hitSlop={6}><Ionicons name="play" size={16} color={colors.gold} /></Pressable>
          <Pressable testID={`refresh-${l.id}`} onPress={async () => { try { await refreshList(l.id); load(); } catch {} }} style={styles.actionBtn} hitSlop={6}><Ionicons name="refresh" size={16} color={colors.textMuted} /></Pressable>
          <Pressable testID={`del-${l.id}`} onPress={() => confirm("Excluir", `Remover "${l.name}"?`, async () => { try { await deleteList(l.id); load(); } catch {} })} style={styles.actionBtn} hitSlop={6}><Ionicons name="trash-outline" size={16} color={colors.error} /></Pressable>
        </View>
      ))}
      <Pressable testID="settings-add-list" style={styles.addRow} onPress={() => router.push("/add-list")}>
        <Ionicons name="add-circle" size={20} color={colors.gold} /><Text style={styles.addLabel}>Adicionar nova lista</Text>
      </Pressable>
    </Card>
  );
}

function RefreshSection() {
  const session = useSession((s) => s.session);
  const catalog = useSession((s) => s.catalog);
  const loading = useSession((s) => s.loading);
  const loadLive = useSession((s) => s.loadLive);
  const loadVod = useSession((s) => s.loadVod);
  const loadSeries = useSession((s) => s.loadSeries);
  if (!session) return <Card><Text style={styles.hint}>Entre com uma conta para atualizar o conteúdo.</Text></Card>;
  return (
    <Card>
      <Row icon="tv-outline" title="Canais" sub={catalog.liveLoaded ? `${catalog.live.length} canais` : "Não carregado"} right={<PillBtn testID="refresh-live" label="ATUALIZAR" icon="refresh" busy={loading.live} onPress={() => loadLive(true)} />} />
      <Row icon="film-outline" title="Filmes" sub={catalog.vodLoaded ? `${catalog.vod.length} filmes` : "Não carregado"} right={<PillBtn testID="refresh-vod" label="ATUALIZAR" icon="refresh" busy={loading.vod} onPress={() => loadVod(true)} />} />
      <Row icon="albums-outline" title="Séries" sub={catalog.seriesLoaded ? `${catalog.series.length} séries` : "Não carregado"} right={<PillBtn testID="refresh-series" label="ATUALIZAR" icon="refresh" busy={loading.series} onPress={() => loadSeries(true)} />} />
    </Card>
  );
}

function PlaybackSection() {
  const prefs = useSession((s) => s.prefs);
  const setPrefs = useSession((s) => s.setPrefs);
  const session = useSession((s) => s.session);
  const formats = (session?.userInfo?.allowed_output_formats || []).map((f) => String(f).toLowerCase());
  return (
    <Card>
      <Row icon="play" title="Auto play" sub="Iniciar reprodução ao abrir o conteúdo" right={<Switch testID="pref-autoplay" value={prefs.autoplay} onValueChange={(v) => setPrefs({ autoplay: v })} trackColor={{ true: colors.gold, false: colors.surface3 }} thumbColor={colors.text} />} />
      <Row icon="refresh" title="Reconexão automática" sub="Até 3 tentativas em caso de falha" right={<Switch testID="pref-reconnect" value={prefs.autoReconnect} onValueChange={(v) => setPrefs({ autoReconnect: v })} trackColor={{ true: colors.gold, false: colors.surface3 }} thumbColor={colors.text} />} />
      <View style={[styles.row, { flexDirection: "column", alignItems: "stretch", gap: spacing.sm }]}>
        <Text style={styles.rowTitle}>Formato dos canais ao vivo</Text>
        <Text style={styles.rowSub}>Formatos permitidos pela conta: {formats.length ? formats.join(", ") : "não informado"}</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {(["auto", "m3u8", "ts"] as const).map((f) => {
            const disabled = f !== "auto" && formats.length > 0 && !formats.includes(f);
            return (
              <Pressable key={f} testID={`pref-format-${f}`} disabled={disabled} onPress={() => setPrefs({ liveFormat: f })} style={({ focused }) => [styles.chip, prefs.liveFormat === f && styles.chipActive, focused && styles.focused, disabled && { opacity: 0.35 }]}>
                <Text style={[styles.chipText, prefs.liveFormat === f && { color: colors.onGold }]}>{f === "auto" ? "Automático" : f.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Card>
  );
}

function DeviceSection() {
  const deviceMode = useSession((s) => s.deviceMode);
  const setDeviceMode = useSession((s) => s.setDeviceMode);
  return (
    <Card>
      {([["tv", "Smart TV / TV Box", "Controle remoto (D-pad)", "tv"], ["mobile", "Celular / Tablet", "Tela sensível ao toque", "phone-portrait"]] as const).map(([k, t, s, ic]) => (
        <Pressable key={k} testID={`device-${k}`} onPress={() => setDeviceMode(k)} style={({ focused }) => [styles.row, focused && styles.focused]}>
          <View style={styles.rowIcon}><Ionicons name={ic} size={18} color={colors.gold} /></View>
          <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{t}</Text><Text style={styles.rowSub}>{s}</Text></View>
          <Ionicons name={deviceMode === k ? "radio-button-on" : "radio-button-off"} size={20} color={colors.gold} />
        </Pressable>
      ))}
    </Card>
  );
}

function HistorySection() {
  const ud = useSession((s) => s.ud);
  const clearHistory = useSession((s) => s.clearHistory);
  return (
    <Card>
      <Row icon="time-outline" title="Recentes" sub={`${ud.recents.live.length} canais · ${ud.recents.vod.length} filmes · ${ud.recents.series.length} séries`} right={<PillBtn testID="clear-history" label="LIMPAR" icon="trash-outline" color={colors.error} onPress={() => confirm("Limpar histórico", "Apagar o histórico de canais, filmes e séries?", () => clearHistory())} />} />
      <Row icon="play-skip-forward-outline" title="Continuar assistindo" sub={`${Object.keys(ud.progress).length} itens com progresso salvo`} />
      <Row icon="star" title="Favoritos" sub={`${ud.favorites.live.length} canais · ${ud.favorites.vod.length} filmes · ${ud.favorites.series.length} séries`} />
    </Card>
  );
}

function CacheSection() {
  const clearCatalog = useSession((s) => s.clearCatalog);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card>
      <Row icon="images-outline" title="Cache de imagens" sub="Logos e pôsteres guardados no dispositivo" />
      <Row icon="list-outline" title="Cache de listas" sub="Canais, filmes e séries carregados em memória" />
      <View style={{ padding: spacing.md }}>
        <PillBtn testID="clear-cache" label="LIMPAR CACHE" icon="brush-outline" onPress={async () => { try { await Image.clearDiskCache(); await Image.clearMemoryCache(); } catch {} clearCatalog(); setMsg("Cache limpo. Suas credenciais e favoritos foram mantidos."); }} />
        {!!msg && <Text style={[styles.hint, { marginTop: spacing.sm }]}>{msg}</Text>}
      </View>
    </Card>
  );
}

function AboutSection() {
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ alignItems: "center", gap: 4 }}><Logo size={90} /><Text style={styles.appName}>GoldCast Streaming</Text></View>
      <Card>
        <Row icon="information-circle" title="Versão do aplicativo" sub="1.0.0" />
        <Row icon="shield-checkmark" title="Política de privacidade" sub="Credenciais ficam apenas no seu dispositivo; nenhuma lista ou histórico é enviado a terceiros." />
        <Row icon="document-text" title="Termos de uso" sub="Use apenas conteúdo autorizado pelo seu provedor." />
        <Row icon="help-buoy" title="Suporte" sub="Entre em contato com seu provedor de acesso." />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { color: colors.textMuted, fontSize: 16, fontWeight: "600", letterSpacing: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, padding: spacing.lg },
  tile: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.sm },
  tileFocused: { borderColor: colors.gold, borderWidth: 2, backgroundColor: colors.surface3, transform: [{ scale: 1.04 }] },
  tileLabel: { color: colors.text, fontSize: 12, fontWeight: "600", textAlign: "center" },
  focused: { borderWidth: 2, borderColor: colors.gold },
  appName: { color: colors.gold, fontSize: 20, fontWeight: "700", letterSpacing: 0.5, marginTop: spacing.sm },
  card: { backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  actionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, justifyContent: "center" },
  addLabel: { color: colors.gold, fontSize: 14, fontWeight: "600" },
  hint: { color: colors.textMuted, padding: spacing.md, textAlign: "center", fontSize: 13 },
  pillBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  pillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  chip: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surface3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, justifyContent: "center" },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
});
