import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, useWindowDimensions, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Logo } from "../../src/components/Logo";
import { GoldButton } from "../../src/components/GoldButton";
import { colors, radius, spacing } from "../../src/utils/theme";
import { listLists } from "../../src/utils/api";
import { useSession } from "../../src/store/session";

const MAIN = [
  { key: "live", label: "TV AO VIVO", sub: "Canais em tempo real", icon: "tv", path: "/(tabs)/live", testID: "home-live" },
  { key: "movies", label: "FILMES", sub: "Catálogo On-Demand", icon: "film", path: "/(tabs)/movies", testID: "home-movies" },
  { key: "series", label: "SÉRIES", sub: "Temporadas completas", icon: "albums", path: "/(tabs)/series", testID: "home-series" },
] as const;

export default function HomeTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const session = useSession((s) => s.session);
  const source = useSession((s) => s.source);
  const setSource = useSession((s) => s.setSource);
  const [hasLists, setHasLists] = useState(false);

  useFocusEffect(useCallback(() => { 
    listLists().then((l) => setHasLists(l.length > 0)).catch(() => {}); 
  }, []));

  const hasContent = !!session || hasLists;

  const go = async (path: string) => {
    if (session && source?.kind !== "list") await setSource({ kind: "xtream" });
    router.push(path as any);
  };

  return (
    <ScrollView 
      style={styles.root} 
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 90 }]} 
      testID="home-screen"
      showsVerticalScrollIndicator={false}
    >
      {/* Barra Superior Minimalista */}
      <View style={styles.topBar}>
        <Logo size={105} />
        <Pressable 
          testID="home-search" 
          onPress={() => router.push({ pathname: "/(tabs)/live", params: { focusSearch: "1" } })} 
          hitSlop={8} 
          style={({ focused, pressed }) => [styles.iconBtn, focused && styles.focused, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="search" size={22} color={colors.text} />
        </Pressable>
      </View>

      {hasContent ? (
        <View style={styles.mainContainer}>
          {/* Banner Hero Cinematográfico Estilo Streaming */}
          <View style={styles.heroBanner}>
            <LinearGradient
              colors={["#1C180E", "#151722", "#090A0E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            />
            
            <View style={styles.heroOverlayContent}>
              <View style={styles.heroTag}>
                <Ionicons name="sparkles" size={12} color={colors.gold} />
                <Text style={styles.heroTagText}>GOLDCAST PREMIUM</Text>
              </View>
              
              <Text style={styles.heroTitle}>Entretenimento Ilimitado</Text>
              <Text style={styles.heroSubtitle}>
                Aceda à grelha completa de canais ao vivo, filmes em alta definição e séries atualizadas.
              </Text>

              <View style={styles.heroActions}>
                <Pressable 
                  style={({ pressed }) => [styles.heroPrimaryBtn, pressed && { opacity: 0.85 }]} 
                  onPress={() => go("/(tabs)/live")}
                >
                  <Ionicons name="play" size={16} color={colors.onGold} />
                  <Text style={styles.heroPrimaryText}>Assistir TV</Text>
                </Pressable>

                <Pressable 
                  style={({ pressed }) => [styles.heroSecondaryBtn, pressed && { opacity: 0.85 }]} 
                  onPress={() => go("/(tabs)/movies")}
                >
                  <Ionicons name="film-outline" size={16} color={colors.text} />
                  <Text style={styles.heroSecondaryText}>Ver Filmes</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Secção de Categorias Principais (Estilo Hub de Conteúdos) */}
          <Text style={styles.sectionHeader}>O QUE PRETENDE ASSISTIR?</Text>

          <View style={styles.gridNav}>
            {MAIN.map((m) => (
              <Pressable
                key={m.key}
                testID={m.testID}
                onPress={() => go(m.path)}
                hasTVPreferredFocus={m.key === "live"}
                style={({ focused, pressed }) => [
                  styles.navCard,
                  focused && styles.navCardFocused,
                  pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }
                ]}
              >
                <View style={styles.navCardIconBox}>
                  <Ionicons name={m.icon as any} size={28} color={colors.gold} />
                </View>
                <View style={styles.navCardTextBox}>
                  <Text style={styles.navCardTitle}>{m.label}</Text>
                  <Text style={styles.navCardSub}>{m.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
              </Pressable>
            ))}
          </View>

          {/* Secção de Atalhos Rápidos */}
          <View style={styles.quickActionsRow}>
            <SmallTile testID="home-favorites" icon="star-outline" label="Favoritos" onPress={() => router.push({ pathname: "/(tabs)/live", params: { cat: "__fav" } })} />
            <SmallTile testID="home-account" icon="person-outline" label="Conta" onPress={() => router.push(session ? "/(tabs)/settings" : "/login")} />
            <SmallTile testID="home-settings" icon="settings-outline" label="Ajustes" onPress={() => router.push("/(tabs)/settings")} />
          </View>
        </View>
      ) : (
        /* Ecrã de Boas-vindas para Utilizador Desconectado */
        <View style={styles.loggedOutBox}>
          <Text style={styles.brand}>GoldCast Streaming</Text>
          <Text style={styles.hint}>Inicie sessão com os dados fornecidos pelo seu serviço para carregar a programação.</Text>
          <GoldButton testID="home-login" label="ENTRAR NO SERVIÇO" icon={<Ionicons name="log-in-outline" size={20} color={colors.onGold} />} onPress={() => router.push("/login")} style={{ alignSelf: "stretch", marginTop: spacing.md }} />
          <GoldButton testID="add-list-primary" label="ADICIONAR LISTA M3U" variant="outline" icon={<Ionicons name="add-circle" size={20} color={colors.gold} />} onPress={() => router.push("/add-list")} style={{ alignSelf: "stretch" }} />
        </View>
      )}
    </ScrollView>
  );
}

function SmallTile({ icon, label, onPress, testID }: { icon: any; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ focused, pressed }) => [styles.tile, focused && styles.tileFocused, pressed && { opacity: 0.8 }]}>
      <Ionicons name={icon} size={20} color={colors.gold} />
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  
  mainContainer: { gap: spacing.lg },

  // Hero Banner Estilo Netflix/Prime
  heroBanner: {
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.25)",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlayContent: {
    padding: 20,
    gap: 8,
  },
  heroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(229, 169, 59, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  heroTagText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginTop: 2,
  },
  heroSubtitle: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
    maxWidth: "92%",
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  heroPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.gold,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
  },
  heroPrimaryText: {
    color: colors.onGold,
    fontSize: 13,
    fontWeight: "800",
  },
  heroSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
  },
  heroSecondaryText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },

  // Lista de Navegação Principal
  sectionHeader: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 6,
    marginBottom: -6,
  },
  gridNav: {
    gap: 10,
  },
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  navCardFocused: {
    borderColor: colors.gold,
    borderWidth: 2,
    backgroundColor: colors.surface2,
    transform: [{ scale: 1.02 }],
  },
  navCardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "rgba(229, 169, 59, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  navCardTextBox: {
    flex: 1,
  },
  navCardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  navCardSub: {
    color: colors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
  },

  // Atalhos Inferiores em Cápsula
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  tile: {
    flex: 1,
    flexDirection: "row",
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tileFocused: {
    borderColor: colors.gold,
    borderWidth: 2,
  },
  tileLabel: {
    color: colors.text,
    fontSize: 11.5,
    fontWeight: "600",
  },

  // Estado Sem Sessão
  loggedOutBox: {
    width: "100%",
    maxWidth: 420,
    gap: spacing.md,
    alignItems: "center",
    alignSelf: "center",
    marginTop: 40,
  },
  brand: { color: colors.gold, fontSize: 26, fontWeight: "800", letterSpacing: 0.6 },
  hint: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  focused: { borderWidth: 2, borderColor: colors.gold },
});
