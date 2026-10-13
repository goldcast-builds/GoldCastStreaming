import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  NativeModules,
  Linking,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Logo } from "../src/components/Logo";
import { GoldButton } from "../src/components/GoldButton";
import { colors, radius, spacing } from "../src/utils/theme";
import { reportError } from "../src/utils/logger";
import { useSession, PlayItem } from "../src/store/session";

export default function PlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rawParams = useLocalSearchParams<Record<string, any>>();

  // Obtém a sessão e a fila de reprodução ativa
  const queue = useSession((s: any) => s.queue || []) as PlayItem[];
  const queueIndex = useSession((s: any) => s.queueIndex ?? s.currentIndex ?? s.index ?? 0);
  const session = useSession((s: any) => s.session || s);

  // Item ativo na fila de reprodução do GoldCast
  const activePlayItem = useMemo(() => {
    if (Array.isArray(queue) && queue.length > 0 && queueIndex >= 0 && queueIndex < queue.length) {
      return queue[queueIndex];
    }
    return null;
  }, [queue, queueIndex]);

  // Identifica o título da transmissão
  const title = useMemo(() => {
    return (
      rawParams.title ||
      rawParams.name ||
      rawParams.stream_name ||
      activePlayItem?.title ||
      "Transmissão GoldCast"
    );
  }, [rawParams, activePlayItem]);

  // Identifica ou reconstrói a URL do stream
  const streamUrl = useMemo(() => {
    // 1. Tenta a URL direta da fila ativa (useSession)
    if (activePlayItem?.urls && activePlayItem.urls.length > 0) {
      const firstUrl = activePlayItem.urls[0];
      if (firstUrl && typeof firstUrl === "string" && firstUrl.startsWith("http")) {
        return firstUrl;
      }
    }

    // 2. Tenta parâmetros passados diretamente na rota
    const directUrl =
      rawParams.url ||
      rawParams.streamUrl ||
      rawParams.stream_url ||
      rawParams.uri ||
      rawParams.videoUrl ||
      rawParams.link;

    if (directUrl && typeof directUrl === "string" && directUrl.startsWith("http")) {
      return directUrl;
    }

    // 3. Fallback: reconstrói com credenciais Xtream se houver streamId
    const streamId =
      rawParams.stream_id ||
      rawParams.streamId ||
      rawParams.id ||
      activePlayItem?.streamId ||
      activePlayItem?.id;

    const streamType = (
      rawParams.type ||
      rawParams.stream_type ||
      activePlayItem?.kind ||
      "live"
    ).toLowerCase();

    const server = session?.server || session?.url || "";
    const username = session?.user || session?.username || session?.userInfo?.username || "";
    const password = session?.pass || session?.password || session?.userInfo?.password || "";

    if (streamId && server && username && password) {
      const cleanServer = server.replace(/\/+$/, "");
      let typeFolder = "live";
      let extension = "ts";

      if (streamType.includes("movie") || streamType.includes("vod")) {
        typeFolder = "movie";
        extension = "mp4";
      } else if (streamType.includes("series")) {
        typeFolder = "series";
        extension = "mp4";
      }

      return `${cleanServer}/${typeFolder}/${username}/${password}/${streamId}.${extension}`;
    }

    return "";
  }, [rawParams, activePlayItem, session]);

  const [launching, setLaunching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hasAutoLaunched = useRef(false);

  const abrirNoJustPlayer = useCallback(async () => {
    if (!streamUrl) {
      setErrorMsg("Nenhum endereço de vídeo foi detectado na fila de reprodução.");
      return;
    }

    setLaunching(true);
    setErrorMsg(null);

    try {
      // 1. Tenta acionar o módulo nativo compilado (JustPlayerModule)
      if (
        Platform.OS === "android" &&
        NativeModules.JustPlayer &&
        typeof NativeModules.JustPlayer.play === "function"
      ) {
        NativeModules.JustPlayer.play(streamUrl, title);
        setLaunching(false);
        return;
      }

      // 2. Fallback via Intent Launcher do Android
      try {
        const IntentLauncher = require("expo-intent-launcher");
        if (IntentLauncher && IntentLauncher.startActivityAsync) {
          await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
            data: streamUrl,
            type: "video/*",
            extra: {
              title: title,
            },
          });
          setLaunching(false);
          return;
        }
      } catch {}

      // 3. Fallback via Linking do sistema
      const canOpen = await Linking.canOpenURL(streamUrl);
      if (canOpen) {
        await Linking.openURL(streamUrl);
      } else {
        throw new Error("Não foi possível iniciar o reprodutor nativo.");
      }
    } catch (err: any) {
      const msg = err?.message || "Falha ao abrir o reprodutor.";
      setErrorMsg(msg);
      reportError("just_player_launch_error", err, `URL: ${streamUrl} | Title: ${title}`);
    } finally {
      setLaunching(false);
    }
  }, [streamUrl, title]);

  useEffect(() => {
    if (!hasAutoLaunched.current && streamUrl) {
      hasAutoLaunched.current = true;
      const timer = setTimeout(() => {
        abrirNoJustPlayer();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [streamUrl, abrirNoJustPlayer]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor="#07080A" hidden={false} />

      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.gold} />
          <Text style={styles.backBtnText}>Voltar</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Logo size={110} />
        </View>

        <View style={styles.badge}>
          <Ionicons name="play-circle" size={16} color={colors.gold} />
          <Text style={styles.badgeText}>JUST PLAYER NATIVO (MEDIA3)</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        <Text style={styles.subtitle}>
          A transmissão está a ser processada com aceleração de hardware nativa e suporte a múltiplos canais de áudio.
        </Text>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : (
          <View style={styles.statusBox}>
            {launching ? (
              <ActivityIndicator color={colors.gold} size="small" />
            ) : (
              <Ionicons name="tv-outline" size={20} color={colors.gold} />
            )}
            <Text style={styles.statusText}>
              {launching ? "A abrir reprodutor..." : "Janela de reprodução ativa"}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <GoldButton
            label={launching ? "A CONECTAR..." : "REPRODUZIR NOVAMENTE"}
            onPress={abrirNoJustPlayer}
            loading={launching}
          />

          <Pressable
            style={({ pressed }) => [styles.exitBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="close-circle-outline" size={18} color="#8E929C" />
            <Text style={styles.exitBtnText}>Sair e Voltar ao Catálogo</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#07080A",
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: "rgba(229, 169, 59, 0.08)",
  },
  backBtnText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  logoWrap: {
    marginBottom: spacing.md,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(229, 169, 59, 0.15)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.3)",
  },
  badgeText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  title: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "#8E929C",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: spacing.xl,
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.2)",
    marginBottom: spacing.xl,
  },
  statusText: {
    color: "#C2C6D1",
    fontSize: 13,
    fontWeight: "600",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(244, 67, 54, 0.12)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(244, 67, 54, 0.3)",
    marginBottom: spacing.xl,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    flex: 1,
  },
  actions: {
    width: "100%",
    gap: spacing.md,
  },
  exitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  exitBtnText: {
    color: "#8E929C",
    fontSize: 13,
    fontWeight: "600",
  },
});
