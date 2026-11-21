import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useSession } from "../../src/store/session";

export default function SeriesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWideTv = width >= 900;

  const catalog = useSession((s) => s.catalog);
  const loadSeries = useSession((s) => s.loadSeries);
  const loading = useSession((s) => s.loading.series);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    if (!catalog.seriesLoaded || (catalog.series || []).length === 0) {
      loadSeries().catch(() => {});
    }
  }, [catalog.seriesLoaded, catalog.series, loadSeries]);

  const series = catalog?.series || [];
  const categories = catalog?.seriesCats || (catalog as any)?.categories?.series || [];

  const filteredSeries = useMemo(() => {
    let result = series;

    if (selectedCategory !== "all") {
      result = result.filter((s) => String(s?.category_id) === String(selectedCategory));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) => s?.name && s.name.toLowerCase().includes(query));
    }

    return result;
  }, [series, selectedCategory, searchQuery]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          focusable={true}
          accessible={true}
          onPress={() => router.back()}
          style={({ focused }) => [styles.backBtn, focused && styles.cardFocused]}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={[styles.headerTitle, isWideTv && { fontSize: 22 }]}>SÉRIES</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#E9C46A" />
        <TextInput
          style={[styles.searchInput, isWideTv && { fontSize: 15 }]}
          placeholder="Buscar séries..."
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          blurOnSubmit={true}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.contentBody}>
        {loading && series.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E9C46A" />
            <Text style={styles.loadingText}>A carregar catálogo de séries...</Text>
          </View>
        ) : (
          <View style={styles.gridWrapper}>
            <FlatList
              data={filteredSeries}
              keyExtractor={(item, idx) => `ser-${item?.series_id || idx}-${idx}`}
              numColumns={5}
              contentContainerStyle={styles.gridContainer}
              columnWrapperStyle={styles.columnWrapper}
              showsVerticalScrollIndicator={false}
              initialNumToRender={15}
              maxToRenderPerBatch={15}
              windowSize={7}
              removeClippedSubviews={false}
              renderItem={({ item }) => {
                const posterUri = item?.cover || (item as any)?.stream_icon || "";
                return (
                  <Pressable
                    focusable={true}
                    accessible={true}
                    onPress={() =>
                      router.push({ pathname: "/series/[id]", params: { id: String(item.series_id) } })
                    }
                    style={({ focused }) => [
                      styles.mediaCard,
                      isWideTv && { height: 215 },
                      focused && styles.cardFocused,
                    ]}
                  >
                    {posterUri ? (
                      <Image
                        source={{ uri: posterUri }}
                        style={[styles.poster, isWideTv && { height: 178 }]}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={[styles.noPoster, isWideTv && { height: 178 }]}>
                        <Ionicons name="tv-outline" size={28} color="#E9C46A" />
                      </View>
                    )}
                    <Text
                      style={[styles.mediaTitle, isWideTv && { fontSize: 11.5 }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        )}

        <View style={[styles.sidebarCategories, isWideTv && { width: 250 }]}>
          <Text style={[styles.sidebarTitle, isWideTv && { fontSize: 14 }]}>CATEGORIAS</Text>
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
              <Text
                style={[
                  styles.catText,
                  isWideTv && { fontSize: 13 },
                  selectedCategory === "all" && styles.catTextActive,
                ]}
              >
                Todas
              </Text>
            </Pressable>

            {categories.map((cat: any, idx: number) => {
              const catId = String(cat?.category_id || cat?.id || idx);
              const isSelected = selectedCategory === catId;
              return (
                <Pressable
                  key={`cat-ser-${catId}-${idx}`}
                  focusable={true}
                  accessible={true}
                  onPress={() => setSelectedCategory(catId)}
                  style={({ focused }) => [
                    styles.catItem,
                    isSelected && styles.catItemActive,
                    focused && styles.cardFocused,
                  ]}
                >
                  <Text
                    style={[
                      styles.catText,
                      isWideTv && { fontSize: 13 },
                      isSelected && styles.catTextActive,
                    ]}
                    numberOfLines={2}
                  >
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
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "900", letterSpacing: 1.2 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#152E3B",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 42,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.2)",
    gap: 10,
  },
  searchInput: { flex: 1, color: "#FFF", fontSize: 13, fontWeight: "700" },
  contentBody: { flex: 1, flexDirection: "row", gap: 16 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#E9C46A", fontSize: 13, fontWeight: "700" },
  gridWrapper: { flex: 1 },
  gridContainer: { paddingBottom: 20 },
  columnWrapper: { justifyContent: "space-between", marginBottom: 14 },
  mediaCard: {
    width: "18.8%",
    height: 185,
    backgroundColor: "#152E3B",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    justifyContent: "space-between",
  },
  cardFocused: {
    borderColor: "#E9C46A",
    borderWidth: 3,
    transform: [{ scale: 1.04 }],
    backgroundColor: "rgba(233,196,106,0.15)",
  },
  poster: { width: "100%", height: 152 },
  noPoster: {
    width: "100%",
    height: 152,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  mediaTitle: {
    color: "#FFF",
    fontSize: 9.5,
    fontWeight: "800",
    textAlign: "center",
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  sidebarCategories: {
    width: 220,
    backgroundColor: "#152E3B",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.2)",
  },
  sidebarTitle: {
    color: "#E9C46A",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: 1,
  },
  sidebarScroll: { gap: 6 },
  catItem: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  catItemActive: { backgroundColor: "#E9C46A" },
  catText: { color: "#9CA3AF", fontSize: 11, fontWeight: "700" },
  catTextActive: { color: "#000", fontWeight: "900" },
});
