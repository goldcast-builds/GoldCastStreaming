import { useCallback, useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, TextInput, Modal, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSession } from "../../src/store/session";
import { xtream, Category } from "../../src/services/xtream";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function LiveTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession((s) => s.session);
  const catalog = useSession((s) => s.catalog);
  const loadLive = useSession((s) => s.loadLive);

  const [search, setSearch] = useState("");
  const [liveCategories, setLiveCategories] = useState<Category[]>([]);
  const [selectedCatName, setSelectedCatName] = useState<string>("Todos os canais");
  const [showCatModal, setShowCatModal] = useState(false);
  const [activeProfile, setActiveProfile] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (session && !catalog.liveLoaded) {
        loadLive().catch(() => {});
      }
      AsyncStorage.getItem("@goldcast_active_profile").then((raw) => {
        if (raw && active) {
          try {
            setActiveProfile(JSON.parse(raw));
          } catch {}
        }
      });
      if (session) {
        xtream.liveCategories(session).then((cats) => {
          if (active && cats) setLiveCategories(cats);
        }).catch(() => {});
      }
      return () => { active = false; };
    }, [session, catalog.liveLoaded, loadLive])
  );

  const isKidsContent = (name: string, categoryName: string = "") => {
    const text = (name + " " + categoryName).toLowerCase();
    return /infantil|kids|anima|desenho|disney|pixar|cartoon|turma|peppa|patrulha|barbie|lego|baby|nickelodeon|turma da mônica|galinha pintadinha|patrulha canina|ben 10|spider|herói|hero|frozen|princesa|sonic|pokemon|minions/i.test(
      text
    );
  };

  const liveList = useMemo(() => {
    let list = catalog.live || [];

    if (activeProfile?.isKids) {
      list = list.filter((ch) => isKidsContent(ch.name, ch.category_name));
    }

    if (selectedCatName !== "Todos os canais") {
      const catObj = liveCategories.find((c) => c.category_name === selectedCatName);
      if (catObj && catalog.liveByCategory?.[catObj.category_id]) {
        list = catalog.liveByCategory[catObj.category_id];
      } else {
        const kw = selectedCatName.toLowerCase();
        list = list.filter((ch) => ch.name.toLowerCase().includes(kw));
      }
    }

    if (search.trim()) {
      list = list.filter((ch) => ch.name.toLowerCase().includes(search.toLowerCase().trim()));
    }

    return list;
  }, [catalog.live, catalog.liveByCategory, liveCategories, activeProfile, selectedCatName, search]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>TV ao Vivo</Text>
          <Pressable onPress={() => setShowCatModal(true)} style={styles.catPickerBtn}>
            <Text style={styles.catPickerBtnText} numberOfLines={1}>{selectedCatName}</Text>
            <Ionicons name="chevron-down" size={14} color="#E50914" />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            placeholder="Buscar canais..."
            placeholderTextColor="#777"
            value={search}
            onChangeText={setSearch}
            style={styles.input}
          />
        </View>

        <View style={styles.grid}>
          {liveList.map((ch) => (
            <Pressable
              key={ch.stream_id}
              style={styles.card}
              onPress={() =>
                router.push({ pathname: "/player", params: { channelId: String(ch.stream_id) } })
              }
            >
              <View style={styles.posterBox}>
                {ch.stream_icon ? (
                  <Image source={{ uri: ch.stream_icon }} style={styles.poster} resizeMode="contain" />
                ) : (
                  <Ionicons name="tv" size={32} color="#E50914" />
                )}
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {ch.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal visible={showCatModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: SCREEN_HEIGHT * 0.75 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Categorias de Canais</Text>
              <Pressable onPress={() => setShowCatModal(false)}>
                <Ionicons name="close-circle" size={26} color="#FFF" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 4, paddingBottom: 20 }}>
              <Pressable
                onPress={() => {
                  setSelectedCatName("Todos os canais");
                  setShowCatModal(false);
                }}
                style={styles.catRow}
              >
                <Text
                  style={[
                    styles.catText,
                    selectedCatName === "Todos os canais" && { color: "#E50914", fontWeight: "900" },
                  ]}
                >
                  Todos os canais
                </Text>
              </Pressable>
              {liveCategories.map((c) => (
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
  card: { width: "30%", aspectRatio: 1, backgroundColor: "#14161D", borderRadius: 10, overflow: "hidden", marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  posterBox: { width: "100%", height: "72%", alignItems: "center", justifyContent: "center", backgroundColor: "#101218" },
  poster: { width: "80%", height: "80%" },
  cardTitle: { color: "#D1D5DB", fontSize: 10.5, fontWeight: "700", padding: 4, textAlign: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  modalBox: { width: "100%", maxWidth: 380, backgroundColor: "#181818", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  catRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  catText: { color: "#E5E7EB", fontSize: 14, fontWeight: "600" },
});
