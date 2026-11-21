import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { ProfilesStore, XtreamProfile } from "../src/store/profiles";
import { useSession } from "../src/store/session";

export default function ProfilesScreen() {
  const router = useRouter();
  const session = useSession((s: any) => s.session || s);

  const [profiles, setProfiles] = useState<XtreamProfile[]>(() => ProfilesStore.getProfiles());
  const [activeId, setActiveId] = useState<string | null>(() => ProfilesStore.getActiveId());

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [server, setServer] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    ProfilesStore.init().then(({ profiles: list, activeId: currentActive }) => {
      setProfiles(list);
      setActiveId(currentActive);

      // Se já houver sessão ativa mas nenhum perfil salvo ainda, guarda como base inicial
      if (
        list.length === 0 &&
        session?.server &&
        (session?.username || session?.user) &&
        (session?.password || session?.pass)
      ) {
        ProfilesStore.upsertProfile({
          label: "Lista Principal",
          server: String(session.server),
          username: String(session.username || session.user),
          password: String(session.password || session.pass),
          setAsActive: true,
        }).then((created) => {
          setProfiles(ProfilesStore.getProfiles());
          setActiveId(created.id);
        });
      }
    });

    const unsub = ProfilesStore.subscribe(() => {
      setProfiles(ProfilesStore.getProfiles());
      setActiveId(ProfilesStore.getActiveId());
    });

    return () => unsub();
  }, [session]);

  const applySessionFromProfile = useCallback(async (profile: XtreamProfile) => {
    setSwitchingId(profile.id);
    try {
      await ProfilesStore.setActiveProfile(profile.id);
      const store = useSession.getState() as any;

      if (typeof store.setSession === "function") {
        store.setSession({
          server: profile.server,
          username: profile.username,
          password: profile.password,
          user: profile.username,
          pass: profile.password,
        });
      }

      if (typeof store.loadLive === "function") store.loadLive().catch(() => {});
      if (typeof store.loadVod === "function") store.loadVod(true).catch(() => {});
      if (typeof store.loadSeries === "function") store.loadSeries(true).catch(() => {});

      Alert.alert("Lista Ativada", `Agora está a utilizar o perfil "${profile.label}".`, [
        { text: "Ir para Início", onPress: () => router.replace("/(tabs)") },
        { text: "OK" },
      ]);
    } finally {
      setSwitchingId(null);
    }
  }, [router]);

  const handleSaveNewProfile = async () => {
    if (!server.trim() || !username.trim() || !password.trim()) {
      Alert.alert("Campos obrigatórios", "Preencha o servidor, o utilizador e a palavra-passe.");
      return;
    }

    const created = await ProfilesStore.upsertProfile({
      label: label.trim(),
      server: server.trim(),
      username: username.trim(),
      password: password.trim(),
      setAsActive: true,
    });

    setLabel("");
    setServer("");
    setUsername("");
    setPassword("");
    setShowForm(false);

    await applySessionFromProfile(created);
  };

  const handleDeleteProfile = (profile: XtreamProfile) => {
    Alert.alert(
      "Remover Lista",
      `Deseja remover o perfil "${profile.label}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: () => ProfilesStore.removeProfile(profile.id),
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          focusable={true}
          onPress={() => router.back()}
          style={({ focused }) => [styles.backBtn, focused && styles.cardFocused]}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>LISTAS E PERFIS IPTV</Text>
          <Text style={styles.headerSub}>
            Guarde várias listas e alterne entre servidores num toque
          </Text>
        </View>

        <Pressable
          focusable={true}
          onPress={() => setShowForm((prev) => !prev)}
          style={({ focused }) => [styles.addBtn, focused && styles.cardFocused]}
        >
          <Ionicons name={showForm ? "close" : "add"} size={18} color="#000" />
          <Text style={styles.addBtnText}>{showForm ? "Fechar" : "Nova Lista"}</Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Adicionar Nova Lista Xtream</Text>

          <TextInput
            style={styles.input}
            placeholder="Nome da lista (ex: Lista Principal, Reserva)"
            placeholderTextColor="#7C8594"
            value={label}
            onChangeText={setLabel}
          />
          <TextInput
            style={styles.input}
            placeholder="Servidor / URL (ex: http://servidor.com:8080)"
            placeholderTextColor="#7C8594"
            value={server}
            onChangeText={setServer}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.rowInputs}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Utilizador"
              placeholderTextColor="#7C8594"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Palavra-passe"
              placeholderTextColor="#7C8594"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={true}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Pressable
            focusable={true}
            onPress={handleSaveNewProfile}
            style={({ focused }) => [styles.saveBtn, focused && styles.cardFocused]}
          >
            <Ionicons name="checkmark-circle" size={18} color="#000" />
            <Text style={styles.saveBtnText}>Guardar e Ativar Lista</Text>
          </Pressable>
        </View>
      )}

      {profiles.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="server-outline" size={44} color="#E9C46A" />
          <Text style={styles.emptyTitle}>Nenhuma lista guardada ainda</Text>
          <Text style={styles.emptySub}>
            Toque em "Nova Lista" para adicionar a sua primeira conta Xtream.
          </Text>
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isActive = item.id === activeId;
            const isSwitching = switchingId === item.id;

            return (
              <View style={[styles.profileCard, isActive && styles.profileCardActive]}>
                <View style={styles.profileInfo}>
                  <View style={styles.profileTopRow}>
                    <Ionicons
                      name={isActive ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={isActive ? "#E9C46A" : "#9CA3AF"}
                    />
                    <Text style={styles.profileLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {isActive && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>ATIVA</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.profileServer} numberOfLines={1}>
                    {item.server}
                  </Text>
                  <Text style={styles.profileUser} numberOfLines={1}>
                    Utilizador: {item.username}
                  </Text>
                </View>

                <View style={styles.profileActions}>
                  {!isActive && (
                    <Pressable
                      focusable={true}
                      disabled={isSwitching}
                      onPress={() => applySessionFromProfile(item)}
                      style={({ focused }) => [styles.useBtn, focused && styles.cardFocused]}
                    >
                      {isSwitching ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.useBtnText}>Ativar</Text>
                      )}
                    </Pressable>
                  )}

                  <Pressable
                    focusable={true}
                    onPress={() => handleDeleteProfile(item)}
                    style={({ focused }) => [styles.deleteBtn, focused && styles.cardFocused]}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1B3B4B",
    paddingHorizontal: 32,
    paddingVertical: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
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
  headerTitle: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 1,
  },
  headerSub: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E9C46A",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  addBtnText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "900",
  },
  formCard: {
    backgroundColor: "#152E3B",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.3)",
    gap: 10,
  },
  formTitle: {
    color: "#E9C46A",
    fontSize: 13,
    fontWeight: "900",
  },
  input: {
    backgroundColor: "#0E222D",
    color: "#FFF",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12.5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  rowInputs: {
    flexDirection: "row",
    gap: 10,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E9C46A",
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  saveBtnText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "900",
  },
  listContainer: {
    gap: 10,
    paddingBottom: 24,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#152E3B",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  profileCardActive: {
    borderColor: "#E9C46A",
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileLabel: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
  },
  activeBadge: {
    backgroundColor: "rgba(233,196,106,0.18)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E9C46A",
  },
  activeBadgeText: {
    color: "#E9C46A",
    fontSize: 9.5,
    fontWeight: "900",
  },
  profileServer: {
    color: "#D1D5DB",
    fontSize: 11.5,
    fontWeight: "600",
  },
  profileUser: {
    color: "#9CA3AF",
    fontSize: 11,
  },
  profileActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  useBtn: {
    backgroundColor: "#E9C46A",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  useBtnText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "900",
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(239,68,68,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardFocused: {
    borderColor: "#E9C46A",
    transform: [{ scale: 1.02 }],
  },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
  emptySub: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
  },
});
