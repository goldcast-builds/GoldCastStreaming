import { useCallback, useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, TextInput, Modal, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSession } from "../../src/store/session";
import { xtream, Category } from "../../src/services/xtream";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function SeriesTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession((s) => s.session);
  const catalog = useSession((s) => s.catalog);
  const loadSeries = useSession((s) => s.loadSeries);

  const [search, setSearch] = useState("");
  const [seriesCategories, setSeriesCategories] = useState<Category[]>([]);
  const [selectedCatName, setSelectedCatName] = useState<string>("Todas as séries");
  const [showCatModal, setShowCatModal] = useState(false);
  const [activeProfile, setActiveProfile] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      if (loadSeries) loadSeries();
      AsyncStorage.getItem("@goldcast_active_profile").then((raw) => {
        if (raw) {
          try {
            setActiveProfile(JSON.parse(raw));
          } catch {}
        }
      });
      if (session) {
        xtream.seriesCategories(session).then(setSeriesCategories).catch(() => {});
      }
    }, [session, loadSeries])
  );

  const seriesList = useMemo(() => {
    let list = catalog.series || [];

    if (activeProfile?.isKids) {
      list = list.filter((s) => {
        const title = (s.name || "").toLowerCase();
        const catName = (s.category_name || "").toLowerCase();
        return /infantil|kids|anima|desenho|disney|pixar|cartoon|turma|peppa|patrulha|barbie|lego|baby|nickelodeon|turma da mônica|galinha pintadinha|patrulha canina|ben 10|spider|herói|hero|frozen|princesa|sonic|pokemon|minions/i.test(
          title + " " + catName
        );
      });
    }

    if (selectedCatName !== "Todas as séries") {
      const catObj = seriesCategories.find((c) => c.category_name === selectedCatName);
      if (catObj && catalog.seriesByCategory?.[catObj.category_id]) {
        list = catalog.seriesByCategory[catObj.category_id];
      } else {
        const kw = selectedCatName.toLowerCase();
        list = list.filter((s) => s.name.toLowerCase().includes(kw));
      }
    }

    if (search.trim()) {
      list = list.filter((s) => s.name.toLowerCase().includes(search.toLowerCase().trim()));
    }

    return list.filter((s) => !!s.cover);
  }, [catalog.series, catalog.seriesByCategory, seriesCategories, activeProfile, selectedCatName, search]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Séries</Text>
          <Pressable onPress={() => setShowCatModal(true)} style={styles.catPickerBtn}>
            <Text style={styles.catPickerBtnText} numberOfLines={1}>{selectedCatName}</Text>
            <Ionicons name="chevron-down" size={14} color="#E50914" />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            placeholder="Buscar séries..."
            placeholderTextColor="#777"
            value={search}
            onChangeText={setSearch}
            style={styles.input}
          />
        </View>

        <View style={styles.grid}>
          {seriesList.map((item) => (
            <Pressable
              key={item.series_id}
              style={styles.card}
              onPress={() =>
                router.push({ pathname: "/series/[id]", params: { id: String(item.series_id) } })
              }
            >
              <Image source={{ uri: item.cover }} style={styles.poster} resizeMode="cover" />
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal visible={showCatModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: SCREEN_HEIGHT * 0.75 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Categorias de Séries</Text>
              <Pressable onPress={() => setShowCatModal(false)}>
                <Ionicons name="close-circle" size={26} color="#FFF" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 4, paddingBottom: 20 }}>
              <Pressable
                onPress={() => {
                  setSelectedCatName("Todas as séries");
                  setShowCatModal(false);
                }}
                style={styles.catRow}
              >
                <Text
                  style={[
                    styles.catText,
                    selectedCatName === "Todas as séries" && { color: "#E50914", fontWeight: "900" },
                  ]}
                >
                  Todas as séries
                </Text>
              </Pressable>
              {seriesCategories.map((c) => (
                <Pressable
                  key={c.category_id}
                  onPress={() => {
                    setSelectedCatName(c.category_name);
                    setShowCatModal(false);
                  }}
                  style={styles.catRow}
                >
                  <Text
                    style={[
                      styles.catText,
                      selectedCatName === c.category_name && { color: "#E50914", fontWeight: "900" },
                    ]}
                  >
                    {c.category_name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 10 },
  title: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" },
  catPickerBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#181A20", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", maxWidth: 180 },
  catPickerBtnText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#181A20", marginHorizontal: 16, paddingHorizontal: 12, borderRadius: 10, height: 44, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  input: { flex: 1, color: "#FFF", fontSize: 14, marginLeft: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12 },
  card: { width: "30%", aspectRatio: 2/3, backgroundColor: "#14161D", borderRadius: 8, overflow: "hidden", marginBottom: 8 },
  poster: { width: "100%", height: "82%" },
  cardTitle: { color: "#D1D5DB", fontSize: 11, fontWeight: "700", padding: 4, textAlign: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  modalBox: { width: "100%", maxWidth: 380, backgroundColor: "#181818", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  catRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  catText: { color: "#E5E7EB", fontSize: 14, fontWeight: "600" },
});
