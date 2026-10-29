import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSession } from "../../src/store/session";

export default function LiveScreen() {
  const router = useRouter();
  const catalog = useSession((s) => s.catalog);
  const [searchQuery, setSearchQuery] = useState("");

  const channels = catalog.live || [];
  const filteredChannels = channels.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

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

      <ScrollView contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
        {filteredChannels.map((c, idx) => (
          <Pressable
            key={`live-${c.stream_id}-${idx}`}
            focusable={true}
            onPress={() => router.push({ pathname: "/live/[id]", params: { id: String(c.stream_id) } })}
            style={({ focused }) => [styles.mediaCard, focused && styles.cardFocused]}
          >
            <Text style={styles.mediaTitle} numberOfLines={2}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1B3B4B", paddingHorizontal: 36, paddingVertical: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "900", letterSpacing: 1.2 },

  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#152E3B", borderRadius: 12, paddingHorizontal: 14, height: 44, marginBottom: 18, borderWidth: 1, borderColor: "rgba(233,196,106,0.2)", gap: 10 },
  searchInput: { flex: 1, color: "#FFF", fontSize: 13, fontWeight: "700" },

  gridContainer: { flexDirection: "row", flexWrap: "wrap", gap: 16, paddingBottom: 20 },
  mediaCard: { width: 150, height: 110, backgroundColor: "#152E3B", borderRadius: 10, padding: 8, justifyContent: "flex-end", borderWidth: 2, borderColor: "transparent" },
  cardFocused: { borderColor: "#E9C46A", borderWidth: 3, transform: [{ scale: 1.05 }] },
  mediaTitle: { color: "#FFF", fontSize: 11, fontWeight: "800", textAlign: "center" },
});
