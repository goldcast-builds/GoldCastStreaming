import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as DocumentPicker from "expo-document-picker";
import { GoldButton } from "../src/components/GoldButton";
import { colors, radius, spacing } from "../src/utils/theme";
import { createM3UFile, createM3UUrl, createXtream } from "../src/utils/api";

type Method = "xtream" | "url" | "file";

const STAGES = ["Conectando...", "Validando servidor...", "Autenticando...", "Carregando conteúdo...", "Conectado!"];

export default function AddListModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState<Method>("xtream");

  // Xtream fields
  const [xName, setXName] = useState("");
  const [xServer, setXServer] = useState("");
  const [xUser, setXUser] = useState("");
  const [xPass, setXPass] = useState("");
  const [showPass, setShowPass] = useState(false);

  // URL fields
  const [uName, setUName] = useState("");
  const [uUrl, setUUrl] = useState("");

  // File
  const [fName, setFName] = useState("");
  const [fContent, setFContent] = useState("");
  const [fFileLabel, setFFileLabel] = useState("");

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const runStages = useCallback((count = 4) => {
    let i = 0;
    setStage(0);
    const iv = setInterval(() => {
      i += 1;
      if (i < count) setStage(i);
      else clearInterval(iv);
    }, 500);
    return () => clearInterval(iv);
  }, []);

  const submit = async () => {
    setError(null);
    try {
      setLoading(true);
      const stopStages = runStages();
      if (method === "xtream") {
        if (!xName.trim() || !xServer.trim() || !xUser.trim() || !xPass.trim()) {
          throw new Error("Preencha todos os campos.");
        }
        await createXtream({ name: xName.trim(), server: xServer.trim(), username: xUser.trim(), password: xPass });
      } else if (method === "url") {
        if (!uName.trim() || !uUrl.trim()) throw new Error("Preencha nome e URL.");
        await createM3UUrl({ name: uName.trim(), url: uUrl.trim() });
      } else {
        if (!fName.trim()) throw new Error("Informe o nome da lista.");
        if (!fContent.trim()) throw new Error("Selecione um arquivo M3U.");
        await createM3UFile({ name: fName.trim(), content: fContent });
      }
      stopStages();
      setStage(STAGES.length - 1);
      setTimeout(() => router.back(), 400);
    } catch (e: any) {
      setError(e?.message || "Falha ao adicionar lista.");
    } finally {
      setLoading(false);
    }
  };

  const pickFile = async () => {
    setError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["*/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;
      // read text via fetch
      const r = await fetch(asset.uri);
      const text = await r.text();
      if (!text || (!text.includes("#EXTM3U") && !text.includes("#EXTINF"))) {
        setError("Arquivo M3U inválido.");
        return;
      }
      setFContent(text);
      setFFileLabel(asset.name || "arquivo.m3u");
      if (!fName) setFName(asset.name?.replace(/\.[^.]+$/, "") || "Minha Lista");
    } catch (e: any) {
      setError(e?.message || "Erro ao abrir arquivo.");
    }
  };

  const methods: { key: Method; label: string; icon: any }[] = [
    { key: "xtream", label: "Xtream Codes", icon: "key" },
    { key: "url", label: "URL M3U", icon: "link" },
    { key: "file", label: "Arquivo M3U", icon: "document" },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="close-add-list" onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Adicionar Lista</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <View style={styles.segment}>
          {methods.map((m) => {
            const active = method === m.key;
            return (
              <Pressable
                key={m.key}
                testID={`method-${m.key}`}
                onPress={() => { setMethod(m.key); setError(null); }}
                style={[styles.segItem, active && styles.segItemActive]}
              >
                <Ionicons name={m.icon} size={16} color={active ? colors.onGold : colors.textMuted} />
                <Text style={[styles.segLabel, active && { color: colors.onGold }]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {method === "xtream" && (
          <View style={{ gap: spacing.md }}>
            <Field label="Nome da lista" value={xName} onChangeText={setXName} placeholder="Minha Lista" testID="input-x-name" />
            <Field label="Servidor / DNS" value={xServer} onChangeText={setXServer} placeholder="http://servidor.com:8080" autoCapitalize="none" testID="input-x-server" />
            <Field label="Usuário" value={xUser} onChangeText={setXUser} placeholder="usuario" autoCapitalize="none" testID="input-x-user" />
            <Field
              label="Senha"
              value={xPass}
              onChangeText={setXPass}
              placeholder="********"
              secureTextEntry={!showPass}
              autoCapitalize="none"
              testID="input-x-pass"
              rightIcon={
                <Pressable onPress={() => setShowPass((s) => !s)} hitSlop={8} testID="toggle-pass">
                  <Ionicons name={showPass ? "eye-off" : "eye"} size={18} color={colors.textMuted} />
                </Pressable>
              }
            />
          </View>
        )}

        {method === "url" && (
          <View style={{ gap: spacing.md }}>
            <Field label="Nome da lista" value={uName} onChangeText={setUName} placeholder="Minha Lista" testID="input-u-name" />
            <Field label="URL da M3U" value={uUrl} onChangeText={setUUrl} placeholder="https://exemplo.com/lista.m3u" autoCapitalize="none" testID="input-u-url" />
          </View>
        )}

        {method === "file" && (
          <View style={{ gap: spacing.md }}>
            <Field label="Nome da lista" value={fName} onChangeText={setFName} placeholder="Minha Lista" testID="input-f-name" />
            <Pressable testID="pick-m3u-file" onPress={pickFile} style={styles.filePicker}>
              <Ionicons name="cloud-upload-outline" size={22} color={colors.gold} />
              <Text style={styles.filePickerLabel}>
                {fFileLabel ? fFileLabel : "Selecionar arquivo .m3u ou .m3u8"}
              </Text>
            </Pressable>
          </View>
        )}

        {loading && (
          <View style={styles.stageBox} testID="loading-stage">
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.stageText}>{STAGES[stage]}</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBox} testID="error-box">
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <GoldButton
          testID="submit-add-list"
          label={method === "url" ? "CARREGAR LISTA" : method === "file" ? "SALVAR LISTA" : "CONECTAR"}
          onPress={submit}
          loading={loading}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  rightIcon,
  testID,
  ...props
}: any) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldWrap}>
        <TextInput
          testID={testID}
          placeholderTextColor={colors.textDim}
          style={styles.input}
          {...props}
        />
        {rightIcon ? <View style={{ marginLeft: spacing.sm }}>{rightIcon}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.xl,
    gap: 4,
  },
  segItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  segItemActive: { backgroundColor: colors.gold },
  segLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  fieldLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 14,
  },
  filePicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.gold,
    padding: spacing.lg,
  },
  filePickerLabel: { color: colors.text, fontSize: 14, flex: 1 },
  stageBox: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  stageText: { color: colors.text, fontSize: 14 },
  errorBox: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: "rgba(244,67,54,0.12)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(244,67,54,0.3)",
  },
  errorText: { color: colors.error, flex: 1, fontSize: 13 },
});
