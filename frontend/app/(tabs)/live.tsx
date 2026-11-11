import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useSession } from "../../src/store/session";

export default function LiveScreen() {
  const router = useRouter();
  const session = useSession((s) => s.session);
  const catalog = useSession((s) => s.catalog);
  const loadLive = useSession((s) => s.loadLive);
  const setQueue = useSession((s) => s.setQueue);
  const loading = useSession((s) => s.loading.live);
  const parentalPin = useSession((s) => s.parentalPin || s.settings?.parentalPin || "1234");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!catalog.liveLoaded || (catalog.live || []).length === 0) {
      loadLive().catch(() => {});
    }
  }, []);

  const adultKeywords = ["adult", "xxx", "18+", "private", "hot", "erotic", "senhoril"];

  const isAdultContent = (name: string) => {
    if (!name) return false;
    const lower = name.toLowerCase();
    return adultKeywords.some((kw) => lower.includes(kw));
  };

  const categories = catalog?.liveCats || catalog?.categories?.live || [];
  const channels = catalog?.live || catalog?.channels || [];

  const filteredChannels = useMemo(() => {
    let result = channels;

    if (selectedCategory !== "all") {
      result = result.filter((c) => String(c?.category_id) === String(selectedCategory));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((c) => (c?.name || c?.title || "").toLowerCase().includes(query));
    }

    return result;
  }, [channels, selectedCategory, searchQuery]);

  const verifyPinAndExecute = (action: () => void) => {
    setPendingAction(() => action);
    setEnteredPin("");
    setPinModalVisible(true);
  };

  const handleCategoryPress = (catId: string, catName: string) => {
    if (isAdultContent(catName)) {
      verifyPinAndExecute(() => setSelectedCategory(catId));
    } else {
      setSelectedCategory(catId);
    }
  };

  const handleChannelPress = (channelId: string, channelName: string, logoUri: string, rawItem: any) => {
    const action = () => {
      if (!session) return;
      const liveStreamUrl = `${session.server.replace(/\/+$/, "")}/live/${session.username}/${session.password}/${channelId}.ts`;

      setQueue([{
        kind: "live",
        id: channelId,
        title: channelName,
        subtitle: "Canal ao Vivo",
        logo: logoUri,
        urls: [liveStreamUrl],
        raw: rawItem,
      }], 0);

      router.push("/player");
    };

    if (isAdultContent(channelName)) {
      verifyPinAndExecute(action);
    } else {
      action();
    }
  };

  const confirmPin = () => {
    if (enteredPin === parentalPin) {
      setPinModalVisible(false);
      if (pendingAction) pendingAction();
      setPendingAction(null);
    } else {
      Alert.alert("PIN Incorreto", "O código PIN introduzido está errado.");
      setEnteredPin("");
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable focusable={true} accessible={true} onPress={() => router.back()} style={({ focused }) => [styles.backBtn, focused && styles.cardFocused]} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>CANAIS</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#E9C46A" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar canais..."
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
          blurOnSubmit={false}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.contentBody}>
        {loading && channels.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E9C46A" />
            <Text style={styles.loadingText}>A carregar lista de canais...</Text>
          </View>
        ) : (
          <View style={styles.gridWrapper}>
            <FlatList
              data={filteredChannels}
              keyExtractor={(item, idx) => `live-${item?.stream_id || item?.id || idx}-${idx}`}
              numColumns={4}
              contentContainerStyle={styles.gridContainer}
              columnWrapperStyle={styles.columnWrapper}
              showsVerticalScrollIndicator={false}
              initialNumToRender={16}
              maxToRenderPerBatch={16}
              windowSize={5}
              removeClippedSubviews={true}
              renderItem={({ item }) => {
                const channelId = String(item?.stream_id || item?.id || "");
                const channelName = item?.name || item?.title || "Canal sem nome";
                const logoUri = item?.stream_icon || "";
                
                return (
                  <Pressable
                    focusable={true}
                    accessible={true}
                    onPress={() => handleChannelPress(channelId, channelName, logoUri, item)}
                    style={({ focused }) => [styles.mediaCard, focused && styles.cardFocused]}
                  >
                    {logoUri ? (
                      <Image source={{ uri: logoUri }} style={styles.logo} contentFit="contain" cachePolicy="memory-disk" />
                    ) : (
                      <View style={styles.noLogo}>
                        <Ionicons name="tv-outline" size={24} color="#E9C46A" />
                      </View>
                    )}
                    <Text style={styles.mediaTitle} numberOfLines={1}>{channelName}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        )}

        <View style={styles.sidebarCategories}>
          <Text style={styles.sidebarTitle}>CATEGORIAS</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sidebarScroll}>
            <Pressable
              focusable={true}
              accessible={true}
              onPress={() => setSelectedCategory("all")}
              style={({ focused }) => [
                styles.catItem,
                selectedCategory === "all" && styles.catItemActive,
                focused && styles.cardFocused,
              ]}
            >
              <Text style={[styles.catText, selectedCategory === "all" && styles.catTextActive]}>Todas</Text>
            </Pressable>

            {categories.map((cat, idx) => {
              const catId = String(cat?.category_id || cat?.id || idx);
              const catName = cat?.category_name || cat?.name || "Categoria";
              const isSelected = selectedCategory === catId;
              return (
                <Pressable
                  key={`cat-live-${catId}-${idx}`}
                  focusable={true}
                  accessible={true}
                  onPress={() => handleCategoryPress(catId, catName)}
                  style={({ focused }) => [
                    styles.catItem,
                    isSelected && styles.catItemActive,
                    focused && styles.cardFocused,
                  ]}
                >
                  <Text style={[styles.catText, isSelected && styles.catTextActive]} numberOfLines={2}>
                    {catName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Modal de PIN Parental */}
      {pinModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Ionicons name="lock-closed" size={32} color="#E9C46A" />
            <Text style={styles.modalTitle}>Controlo Parental</Text>
            <Text style={styles.modalSub}>Introduza o PIN para aceder ao canal restrito</Text>
            
            <TextInput
              style={styles.pinInput}
              keyboardType="numeric"
              secureTextEntry={true}
              placeholder="PIN"
              placeholderTextColor="#6B7280"
              value={enteredPin}
              onChangeText={setEnteredPin}
              maxLength={6}
              autoFocus={true}
            />

            <View style={styles.modalActions}>
              <Pressable
                focusable={true}
                onPress={() => setPinModalVisible(false)}
                style={({ focused }) => [styles.modalBtnCancel, focused && styles.cardFocused]}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </Pressable>

              <Pressable
                focusable={true}
                onPress={confirmPin}
                style={({ focused }) => [styles.modalBtnConfirm, focused && styles.cardFocused]}
              >
                <Text style={styles.modalBtnConfirmText}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1B3B4B", paddingHorizontal: 36, paddingVertical: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "900", letterSpacing: 1.2 },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#152E3B", borderRadius: 12, paddingHorizontal: 14, height: 40, marginBottom: 12, borderWidth: 1, borderColor: "rgba(233,196,106,0.2)", gap: 10 },
  searchInput: { flex: 1, color: "#FFF", fontSize: 13, fontWeight: "700" },
  contentBody: { flex: 1, flexDirection: "row", gap: 16 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#E9C46A", fontSize: 13, fontWeight: "700" },
  gridWrapper: { flex: 1 },
  gridContainer: { paddingBottom: 20 },
  columnWrapper: { justifyContent: "space-between", marginBottom: 12 },
  mediaCard: { width: "23.5%", height: 95, backgroundColor: "#152E3B", borderRadius: 10, padding: 8, justifyContent: "space-between", borderWidth: 2, borderColor: "transparent", alignItems: "center" },
  cardFocused: { borderColor: "#E9C46A", borderWidth: 3, transform: [{ scale: 1.05 }], backgroundColor: "rgba(233,196,106,0.15)" },
  logo: { width: "100%", height: 46 },
  noLogo: { width: "100%", height: 46, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 6 },
  mediaTitle: { color: "#FFF", fontSize: 10, fontWeight: "800", textAlign: "center" },
  sidebarCategories: { width: 220, backgroundColor: "#152E3B", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "rgba(233,196,106,0.2)" },
  sidebarTitle: { color: "#E9C46A", fontSize: 12, fontWeight: "900", marginBottom: 8, textAlign: "center", letterSpacing: 1 },
  sidebarScroll: { gap: 6 },
  catItem: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 2, borderColor: "transparent" },
  catItemActive: { backgroundColor: "#E9C46A" },
  catText: { color: "#9CA3AF", fontSize: 11, fontWeight: "700" },
  catTextActive: { color: "#000", fontWeight: "900" },

  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modalBox: { width: 340, backgroundColor: "#152E3B", borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 2, borderColor: "#E9C46A" },
  modalTitle: { color: "#FFF", fontSize: 18, fontWeight: "900", marginTop: 10 },
  modalSub: { color: "#9CA3AF", fontSize: 11, textAlign: "center", marginVertical: 10 },
  pinInput: { width: "100%", height: 46, backgroundColor: "#0B1920", borderRadius: 8, color: "#FFF", textAlign: "center", fontSize: 18, fontWeight: "900", borderWidth: 1, borderColor: "rgba(233,196,106,0.3)", marginBottom: 16 },
  modalActions: { flexDirection: "row", gap: 12, width: "100%" },
  modalBtnCancel: { flex: 1, height: 40, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  modalBtnCancelText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  modalBtnConfirm: { flex: 1, height: 40, backgroundColor: "#E9C46A", borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  modalBtnConfirmText: { color: "#000", fontSize: 12, fontWeight: "900" },
});
