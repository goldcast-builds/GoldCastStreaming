import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { CatalogGrid, GridItem } from "../../src/components/CatalogGrid";
import { useSession } from "../../src/store/session";
import { NoVod } from "../../src/components/NoVod";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Modal, View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

interface UserProfile {
  id: string;
  name: string;
  type: "normal" | "kids" | "adult" | "football";
}

export default function SeriesTab() {
  const router = useRouter();
  const source = useSession((s) => s.source);
  const catalog = useSession((s) => s.catalog);
  const loading = useSession((s) => s.loading.series);
  const error = useSession((s) => s.errors.series);
  const loadSeries = useSession((s) => s.loadSeries);
  const favIds = useSession((s) => s.ud.favorites.series);
  const recents = useSession((s) => s.ud.recents.series);
  const toggleFav = useSession((s) => s.toggleFav);

  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [adultPin, setAdultPin] = useState("0000");
  const [adultLocked, setAdultLocked] = useState(true);
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pendingItemToOpen, setPendingItemToOpen] = useState<any>(null);

  useFocusEffect(useCallback(() => {
    if (source?.kind === "xtream") loadSeries();
    let isMounted = true;
    AsyncStorage.getItem("@goldcast_active_profile").then((raw) => {
      if (raw && isMounted) {
        try { setCurrentProfile(JSON.parse(raw)); } catch {}
      }
    });
    AsyncStorage.getItem("@goldcast_adult_pin").then((val) => { if (val && isMounted) setAdultPin(val); });
    AsyncStorage.getItem("@goldcast_adult_locked").then((val) => { if (val !== null && isMounted) setAdultLocked(val === "true"); });
    return () => { isMounted = false; };
  }, [source?.kind, loadSeries]));

  const isAdultContent = (name: string, categoryName: string = "") => {
    const text = (name + " " + categoryName).toLowerCase();
    return /adult|xxx|\+18|18\+|private|sensual|erot|sex|playboy|venus|hot|seventeen|privates|séries xxx/i.test(text);
  };

  const isKidsContent = (name: string, categoryName: string = "") => {
    const text = (name + " " + categoryName).toLowerCase();
    return /infantil|kids|anima|desenho|disney|pixar|cartoon|turma|peppa|patrulha|barbie|lego|baby|nickelodeon|turma da mônica|galinha pintadinha|patrulha canina|ben 10|frozen|princesa|sonic|pokemon|minions|super onze|dragon ball|naruto|one piece|crunchyroll/i.test(text);
  };

  // Filtragem estrita das séries pelo perfil ativo
  const filteredSeries = useMemo(() => {
    if (!catalog.series) return [];
    const profileType = currentProfile?.type;

    return catalog.series.filter((s) => {
      const name = s.name || "";
      const cat = s.category_name || "";

      if (profileType === "kids") return isKidsContent(name, cat);
      if (profileType === "adult") return isAdultContent(name, cat);
      if (profileType === "football") return false; // Perfil de futebol não foca em séries

      if (adultLocked && isAdultContent(name, cat)) return false;
      return true;
    });
  }, [catalog.series, currentProfile?.type, adultLocked]);

  const items: GridItem[] = useMemo(() => filteredSeries.map((s) => ({
    id: String(s.series_id), name: s.name, poster: s.cover, categoryId: s.category_id,
    year: s.releaseDate ? String(s.releaseDate).slice(0, 4) : undefined, genre: s.genre || undefined, rating: s.rating != null ? String(s.rating) : undefined,
  })), [filteredSeries]);

  const handleOpenSeries = (item: GridItem) => {
    const openAction = () => {
      router.push({ pathname: "/series/[id]", params: { id: item.id } });
    };

    if (currentProfile?.type === "kids" && isAdultContent(item.name)) {
      Alert.alert("Conteúdo Restrito", "Este perfil infantil não tem permissão para aceder a esta série.");
      return;
    }

    if (adultLocked && currentProfile?.type !== "adult" && isAdultContent(item.name)) {
      setPendingItemToOpen(() => openAction);
      setEnteredPin("");
      setShowPinModal(true);
    } else {
      openAction();
    }
  };

  const verifyPinAndOpen = () => {
    if (enteredPin === adultPin) {
      setShowPinModal(false);
      setEnteredPin("");
      if (pendingItemToOpen) {
        pendingItemToOpen();
        setPendingItemToOpen(null);
      }
    } else {
      Alert.alert("Senha Incorreta", "A senha padrão é 0000.");
      setEnteredPin("");
    }
  };

  if (source?.kind !== "xtream") return <NoVod title="Séries" />;

  return (
    <>
      <CatalogGrid
        title={currentProfile?.type === "kids" ? "Séries Infantis & Animes" : currentProfile?.type === "adult" ? "Séries Adultas (+18)" : "Séries"}
        testIDPrefix="series"
        searchPlaceholder={currentProfile?.type === "kids" ? "Buscar animes, desenhos..." : "Buscar séries..."}
        items={items}
        cats={catalog.seriesCats}
        loading={loading && !catalog.seriesLoaded}
        error={!catalog.seriesLoaded ? error : null}
        onRetry={() => loadSeries(true)}
        favIds={favIds}
        recentIds={recents.map((r) => String(r.series_id))}
        onOpen={handleOpenSeries}
        onFav={(i) => toggleFav("series", i.id)}
        emptyText="Nenhuma série disponível para este perfil."
      />

      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={() => setShowPinModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.pinCard}>
            <Ionicons name="lock-closed" size={32} color="#EF4444" />
            <Text style={styles.pinTitle}>Conteúdo Protegido (+18)</Text>
            <Text style={styles.pinSub}>Digite a senha PIN (padrão: 0000)</Text>
            <TextInput
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              placeholder="••••"
              placeholderTextColor="#777"
              value={enteredPin}
              onChangeText={setEnteredPin}
              style={styles.pinInput}
            />
            <View style={{ flexDirection: "row", gap: 10, width: "100%", marginTop: 10 }}>
              <Pressable onPress={() => setShowPinModal(false)} style={[styles.pinBtn, { backgroundColor: "#262936" }]}>
                <Text style={{ color: "#FFF", fontWeight: "800" }}>CANCELAR</Text>
              </Pressable>
              <Pressable onPress={verifyPinAndOpen} style={[styles.pinBtn, { backgroundColor: "#EF4444" }]}>
                <Text style={{ color: "#FFF", fontWeight: "900" }}>LIBERAR</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: 20 },
  pinCard: { width: "100%", maxWidth: 360, backgroundColor: "#181818", borderRadius: 20, padding: 22, alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "#EF4444" },
  pinTitle: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  pinSub: { color: "#9CA3AF", fontSize: 12, textAlign: "center" },
  pinInput: { width: "100%", height: 48, backgroundColor: "#262626", borderRadius: 10, paddingHorizontal: 14, color: "#FFF", fontSize: 22, textAlign: "center", letterSpacing: 8 },
  pinBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
