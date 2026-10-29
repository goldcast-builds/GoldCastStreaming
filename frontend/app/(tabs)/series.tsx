import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useSession } from "../../src/store/session";

export default function SeriesScreen() {
  const router = useRouter();
  const catalog = useSession((s) => s.catalog);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const series = catalog.series || [];
  const categories = catalog.series_categories || [];

  const filteredSeries = useMemo(() => {
    let result = series;

    if (selectedCategory !== "all") {
      result = result.filter((s) => String(s.category_id) === String(selectedCategory));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) => s?.name && s.name.toLowerCase().includes(query));
    }

    return result;
  }, [series, categories, selectedCategory, searchQuery]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable focusable={true} onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>SÉRIES</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#E9C46A" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar séries..."
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
          blurOnSubmit={false}
        />
      </View>

      <View style={styles.categoriesWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
          <Pressable
            focusable={true}
            onPress={() => setSelectedCategory("all")}
            style={({ focused }) => [
              styles.catChip,
              selectedCategory === "all" && styles.catChipActive,
              focused && styles.cardFocused,
            ]}
          >
            <Text style={[styles.catText, selectedCategory === "all" && styles.catTextActive]}>Todas</Text>
          </Pressable>

          {categories.map((cat, idx) => {
            const catId = String(cat.category_id || cat.id || idx);
            const isSelected = selectedCategory === catId;
            return (
              <Pressable
                key={`cat-ser-${catId}-${idx}`}
                focusable={true}
                onPress={() => setSelectedCategory(catId)}
                style={({ focused }) => [
                  styles.catChip,
                  isSelected && styles.catChipActive,
                  focused && styles.cardFocused,
                ]}
              >
                <Text style={[styles.catText, isSelected && styles.catTextActive]} numberOfLines={1}>
                  {cat.category_name || cat.name || "Categoria"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filteredSeries}
        keyExtractor={(item, idx) => `ser-${item?.series_id || idx}-${idx}`}
        numColumns={5}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={5}
        renderItem={({ item }) => {
          const posterUri = item?.cover || item?.stream_icon || "";
          return (
            <Pressable
              focusable={true}
              onPress={() => router.push({ pathname: "/series/[id]", params: { id: String(item.series_id) } })}
              style={({ focused }) => [styles.mediaCard, focused && styles.cardFocused]}
            >
              {posterUri ? (
                <Image source={{ uri: posterUri }} style={styles.poster} contentFit="cover" />
              ) : (
                <View style={styles.noPoster}>
                  <Ionicons name="tv-outline" size={28} color="#E9C46A" />
                </View>
              )}
              <Text style={styles.mediaTitle} numberOfLines={1}>{item.name}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1B3B4B", paddingHorizontal: 36, paddingVertical: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "900", letterSpacing: 1.2 },

  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#152E3B", borderRadius: 12, paddingHorizontal: 14, height: 42, marginBottom: 12, borderWidth: 1, borderColor: "rgba(233,196,106,0.2)", gap: 10 },
  searchInput: { flex: 1, color: "#FFF", fontSize: 13, fontWeight: "700" },

  categoriesWrapper: { marginBottom: 14, height: 38 },
  catScroll: { gap: 8, alignItems: "center" },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#152E3B", borderRadius: 8, borderWidth: 1, borderColor: "rgba(233,196,106,0.2)", justifyContent: "center" },
  catChipActive: { backgroundColor: "#E9C46A", borderColor: "#E9C46A" },
  catText: { color: "#9CA3AF", fontSize: 11, fontWeight: "800" },
  catTextActive: { color: "#000", fontWeight: "900" },

  gridContainer: { paddingBottom: 20 },
  columnWrapper: { gap: 16, marginBottom: 16 },
  mediaCard: { width: 130, height: 180, backgroundColor: "#152E3B", borderRadius: 10, overflow: "hidden", borderWidth: 2, borderColor: "transparent", justifyContent: "space-between" },
  cardFocused: { borderColor: "#E9C46A", borderWidth: 3, transform: [{ scale: 1.05 }] },
  poster: { width: "100%", height: 142 },
  noPoster: { width: "100%", height: 142, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.2)" },
  mediaTitle: { color: "#FFF", fontSize: 10, fontWeight: "800", textAlign: "center", paddingHorizontal: 4, paddingBottom: 6 },
});
