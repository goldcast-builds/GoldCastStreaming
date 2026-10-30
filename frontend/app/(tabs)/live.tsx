import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useSession } from "../../src/store/session";

export default function LiveScreen() {
  const router = useRouter();
  const catalog = useSession((s) => s.catalog);
  const loadLive = useSession((s) => s.loadLive);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    loadLive();
  }, []);

  const channels = catalog?.live || [];
  const categories = catalog?.liveCats || [];

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
  }, [channels, categories, selectedCategory, searchQuery]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable focusable={true} onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
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
        />
      </View>

      <View style={styles.contentBody}>
        <View style={styles.gridWrapper}>
          <FlatList
            data={filteredChannels}
            keyExtractor={(item, idx) => `live-${item?.stream_id || item?.id || idx}-${idx}`}
            numColumns={3}
            contentContainerStyle={styles.gridContainer}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            windowSize={5}
            renderItem={({ item }) => {
              const channelId = String(item?.stream_id || item?.id || "");
              const channelName = item?.name || item?.title || "Canal sem nome";
              const logoUri = item?.stream_icon || "";
              return (
                <Pressable
                  focusable={true}
                  onPress={() => router.push({ pathname: "/live/[id]", params: { id: channelId } })}
                  style={({ focused }) => [styles.mediaCard, focused && styles.cardFocused]}
                >
                  {logoUri ? (
                    <Image source={{ uri: logoUri }} style={styles.logo} contentFit="contain" />
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

        <View style={styles.sidebarCategories}>
          <Text style={styles.sidebarTitle}>CATEGORIAS</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sidebarScroll}>
            <Pressable
              focusable={true}
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
              const isSelected = selectedCategory === catId;
              return (
                <Pressable
                  key={`cat-live-${catId}-${idx}`}
                  focusable={true}
                  onPress={() => setSelectedCategory(catId)}
                  style={({ focused }) => [
                    styles.catItem,
                    isSelected && styles.catItemActive,
                    focused && styles.cardFocused,
                  ]}
                >
                  <Text style={[styles.catText, isSelected && styles.catTextActive]} numberOfLines={2}>
                    {cat?.category_name || cat?.name || "Categoria"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1B3B4B", paddingHorizontal: 36, paddingVertical: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "900", letterSpacing: 1.2 },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#152E3B", borderRadius: 12, paddingHorizontal: 14, height: 40, marginBottom: 12, borderWidth: 1, borderColor: "rgba(233,196,106,0.2)", gap: 10 },
  searchInput: { flex: 1, color: "#FFF", fontSize: 13, fontWeight: "700" },
  contentBody: { flex: 1, flexDirection: "row", gap: 16 },
  gridWrapper: { flex: 1 },
  gridContainer: { paddingBottom: 20 },
  columnWrapper: { gap: 14, marginBottom: 14 },
  mediaCard: { width: 160, height: 100, backgroundColor: "#152E3B", borderRadius: 10, padding: 8, justifyContent: "space-between", borderWidth: 2, borderColor: "transparent", alignItems: "center" },
  cardFocused: { borderColor: "#E9C46A", borderWidth: 3, transform: [{ scale: 1.05 }] },
  logo: { width: "100%", height: 50 },
  noLogo: { width: "100%", height: 50, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 6 },
  mediaTitle: { color: "#FFF", fontSize: 11, fontWeight: "800", textAlign: "center" },
  sidebarCategories: { width: 220, backgroundColor: "#152E3B", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "rgba(233,196,106,0.2)" },
  sidebarTitle: { color: "#E9C46A", fontSize: 12, fontWeight: "900", marginBottom: 8, textAlign: "center", letterSpacing: 1 },
  sidebarScroll: { gap: 6 },
  catItem: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.03)" },
  catItemActive: { backgroundColor: "#E9C46A" },
  catText: { color: "#9CA3AF", fontSize: 11, fontWeight: "700" },
  catTextActive: { color: "#000", fontWeight: "900" },
});
