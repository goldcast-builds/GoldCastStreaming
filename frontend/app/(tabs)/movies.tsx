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

export default function MoviesTab() {
  const router = useRouter();
  const source = useSession((s) => s.source);
  const catalog = useSession((s) => s.catalog);
  const loading = useSession((s) => s.loading.vod);
  const error = useSession((s) => s.errors.vod);
  const loadVod = useSession((s) => s.loadVod);
  const favIds = useSession((s) => s.ud.favorites.vod);
  const recents = useSession((s) => s.ud.recents.vod);
  const progress = useSession((s) => s.ud.progress);
  const toggleFav = useSession((s) => s.toggleFav);

  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [adultPin, setAdultPin] = useState("0000");
  const [adultLocked, setAdultLocked] = useState(true);
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pendingItemToOpen, setPendingItemToOpen] = useState<any>(null);

  useFocusEffect(useCallback(() => {
    if (source?.kind === "xtream") loadVod();
    let isMounted = true;
    AsyncStorage.getItem("@goldcast_active_profile").then((raw) => {
      if (raw && isMounted) {
        try { setCurrentProfile(JSON.parse(raw)); } catch {}
      }
    });
    AsyncStorage.getItem("@goldcast_adult_pin").then((val) => { if (val && isMounted) setAdultPin(val); });
    AsyncStorage.getItem("@goldcast_adult_locked").then((val) => { if (val !== null && isMounted) setAdultLocked(val === "true"); });
    return () => { isMounted = false; };
  }, [source?.kind, loadVod]));

  const isAdultContent = (name: string, categoryName: string = "") => {
    const text = (name + " " + categoryName).toLowerCase();
    return /adult|xxx|\+18|18\+|private|sensual|erot|sex|playboy|venus|hot|seventeen|privates|filmes xxx/i.test(text);
  };

  const isKidsContent = (name: string, categoryName: string = "") => {
    const text = (name + " " + categoryName).toLowerCase();
    return /infantil|kids|anima|desenho|disney|pixar|cartoon|turma|peppa|patrulha|barbie|lego|baby|nickelodeon|turma da mônica|galinha pintadinha|patrulha canina|ben 10|frozen|princesa|sonic|pokemon|minions|super onze|dragon ball|naruto|one piece/i.test(text);
  };

  // Filtragem estrita dos filmes pelo perfil ativo
  const filteredVod = useMemo(() => {
    if (!catalog.vod) return [];
    const profileType = currentProfile?.type;

    return catalog.vod.filter((v) => {
      const name = v.name || "";
      const cat = v.category_name || "";

      if (profileType === "kids") return isKidsContent(name, cat);
      if (profileType === "adult") return isAdultContent(name, cat);
      if (profileType === "football") return false; 

      // Se o bloqueio adulto estiver ativo num perfil normal, oculta da listagem inicial
      if (adultLocked && currentProfile?.type !== "adult" && isAdultContent(name, cat)) return false;
      return true;
    });
  }, [catalog.vod, currentProfile?.type, adultLocked]);

  const progressById = useMemo(() => {
    const m: Record<string, number> = {};
    Object.values(progress).forEach((p) => { if (p.item.kind === "vod" && p.duration > 0) m[p.item.id] = p.position / p.duration; });
    return m;
  }, [progress]);

  const continueIds = useMemo(() => Object.values(progress).filter((p) => p.item.kind === "vod" && p.duration > 0 && p.position / p.duration < 0.97).sort((a, b) => b.updatedAt - a.updatedAt).map((p) => p.item.id), [progress]);

  const items: GridItem[] = useMemo(() => filteredVod.map((v) => ({
    id: String(v.stream_id), name: v.name, poster: v.stream_icon, categoryId: v.category_id,
    year: v.year || undefined, genre: v.genre || undefined, rating: v.rating != null ? String(v.rating) : undefined, progress: progressById[String(v.stream_id)],
  })), [filteredVod, progressById]);

  const handleOpenMovie = (item: GridItem) => {
    const openAction = () => {
      router.push({ pathname: "/movie/[id]", params: { id: item.id } });
    };

    if (currentProfile?.type === "kids" && isAdultContent(item.name)) {
      Alert.alert("Conteúdo Restrito", "Este perfil infantil não tem permissão para aceder a este filme.");
      return;
    }

    // Solicita o PIN de segurança se for conteúdo adulto e o bloqueio estiver ativo
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

  if (source?.kind !== "xtream") return <NoVod title="Filmes" />;

  return (
    <>
      <CatalogGrid
        title={currentProfile?.type === "kids" ? "Filmes Infantis & Animações" : currentProfile?.type === "adult" ? "Filmes Adultos (+18)" : "Filmes"}
        testIDPrefix="movies"
        searchPlaceholder={currentProfile?.type === "kids" ? "Buscar filmes infantis..." : "Buscar filmes..."}
        items={items}
        cats={catalog.vodCats}
        loading={loading && !catalog.vodLoaded}
        error={!catalog.vodLoaded ? error : null}
        onRetry={() => loadVod(true)}
        favIds={favIds}
        recentIds={recents.map((r) => String(r.stream_id))}
        continueIds={continueIds}
        onOpen={handleOpenMovie}
        onFav={(i) => toggleFav("vod", i.id)}
        emptyText="Nenhum filme disponível para este perfil."
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
