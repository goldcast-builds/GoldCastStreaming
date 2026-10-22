import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  NativeModules,
  StatusBar,
  DeviceEventEmitter,
  AppState,
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

  const queue = useSession((s: any) => s.queue || []) as PlayItem[];
  const queueIndex = useSession((s: any) => s.queueIndex ?? s.currentIndex ?? s.index ?? 0);
  const session = useSession((s: any) => s.session || s);
  const ud = useSession((s: any) => s.ud);
  const saveProgress = useSession((s: any) => s.saveProgress);
  const removeProgress = useSession((s: any) => s.removeProgress);
  const addRecent = useSession((s: any) => s.addRecent);

  const activePlayItem = useMemo(() => {
    if (Array.isArray(queue) && queue.length > 0 && queueIndex >= 0 && queueIndex < queue.length) {
      return queue[queueIndex];
    }
    return null;
  }, [queue, queueIndex]);

  const title = useMemo(() => {
    return (
      rawParams.title ||
      rawParams.name ||
      rawParams.stream_name ||
      activePlayItem?.title ||
      "Transmissão GoldCast"
    );
  }, [rawParams, activePlayItem]);

  const streamType = useMemo(() => {
    return (
      rawParams.type ||
      rawParams.stream_type ||
      rawParams.kind ||
      activePlayItem?.kind ||
      "live"
    ).toLowerCase();
  }, [rawParams, activePlayItem]);

  const streamId = useMemo(() => {
    return (
      rawParams.stream_id ||
      rawParams.streamId ||
      rawParams.id ||
      activePlayItem?.streamId ||
      activePlayItem?.id ||
      ""
    );
  }, [rawParams, activePlayItem]);

  const progressKey = useMemo(() => {
    if (activePlayItem?.progressKey) return activePlayItem.progressKey;
    if (streamId) {
      return streamType !== "live" ? `${streamType}_${streamId}` : "";
    }
    return "";
  }, [activePlayItem, streamId, streamType]);

  const savedProgress = useMemo(() => {
    if (!progressKey || streamType === "live") return null;
    const allProgress = ud?.progress || {};
    return allProgress[progressKey] || (streamId ? allProgress[String(streamId)] : null) || null;
  }, [progressKey, streamId, streamType, ud]);

  const startPositionMs = useMemo(() => {
    if (!savedProgress) return 0;
    const pos = Number(savedProgress.position) || 0;
    const dur = Number(savedProgress.duration) || 0;

    if (dur > 0 && pos / dur >= 0.95) return 0;
    if (pos < 10) return 0;

    return pos > 100000 ? pos : Math.round(pos * 1000);
  }, [savedProgress]);

  const streamUrl = useMemo(() => {
    let rawUrl = "";

    if (activePlayItem?.urls && activePlayItem.urls.length > 0) {
      const firstUrl = activePlayItem.urls[0];
      if (firstUrl && typeof firstUrl === "string" && (firstUrl.startsWith("http://") || firstUrl.startsWith("https://"))) {
        rawUrl = firstUrl;
      }
    }

    if (!rawUrl) {
      const directUrl =
        rawParams.url ||
        rawParams.streamUrl ||
        rawParams.stream_url ||
        rawParams.uri ||
        rawParams.videoUrl ||
        rawParams.link;

      if (directUrl && typeof directUrl === "string" && (directUrl.startsWith("http://") || directUrl.startsWith("https://"))) {
        rawUrl = directUrl;
      }
    }

    if (!rawUrl) {
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

        rawUrl = `${cleanServer}/${typeFolder}/${username}/${password}/${streamId}.${extension}`;
      }
    }

    if (!rawUrl) return "";

    if (rawUrl.toLowerCase().startsWith("https://")) {
      rawUrl = "http://" + rawUrl.substring(8);
    }

    return rawUrl;
  }, [rawParams, activePlayItem, session, streamId, streamType]);

  // Listener para retornar ao catálogo automaticamente quando o usuário fecha o player externo e volta ao app
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        // Se o usuário voltou para o app vindo do player externo, volta para a tela anterior
        if (router.canGoBack()) {
          router.back();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      "onPlayerProgress",
      (data: {
        progressKey: string;
        position: number;
        duration: number;
        streamType: string;
      }) => {
        if (!data || !data.progressKey || data.streamType === "live") return;

        const posSec = Math.round(data.position);
        const durSec = Math.round(data.duration);

        if (durSec > 0 && posSec > 10) {
          const ratio = posSec / durSec;
          if (ratio >= 0.95) {
            removeProgress(data.progressKey);
          } else {
            const itemToSave: PlayItem = activePlayItem || {
              kind: (data.streamType as any) || "vod",
              id: String(streamId),
              title: title,
              urls: streamUrl ? [streamUrl] : [],
              progressKey: data.progressKey,
              logo: rawParams.logo || rawParams.stream_icon,
            };

            saveProgress(data.progressKey, {
              position: posSec,
              duration: durSec,
              title: title,
              logo: activePlayItem?.logo || rawParams.logo || rawParams.stream_icon,
              item: itemToSave,
            });
          }
        }
      }
    );

    return () => {
      sub.remove();
    };
  }, [activePlayItem, saveProgress, removeProgress, streamId, title, streamUrl, rawParams]);

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
      if (
        Platform.OS === "android" &&
        NativeModules.JustPlayer &&
        typeof NativeModules.JustPlayer.play === "function"
      ) {
        if (activePlayItem || streamId) {
          addRecent((streamType as any) || "live", activePlayItem || { id: streamId, title, urls: [streamUrl] });
        }

        NativeModules.JustPlayer.play(
          streamUrl,
          title,
          startPositionMs,
          progressKey,
          streamType
        );
        setLaunching(false);
        return;
      }

      throw new Error("Módulo nativo Just Player não encontrado no pacote atual.");
    } catch (err: any) {
      const msg = err?.message || "Falha ao abrir o reprodutor.";
      setErrorMsg(msg);
      reportError("just_player_launch_error", err, `URL: ${streamUrl} | Title: ${title}`);
    } finally {
      setLaunching(false);
    }
  }, [streamUrl, title, startPositionMs, progressKey, streamType, activePlayItem, streamId, addRecent]);

  useEffect(() => {
    if (!hasAutoLaunched.current && streamUrl) {
      hasAutoLaunched.current = true;
      const timer = setTimeout(() => {
        abrirNoJustPlayer();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [streamUrl, abrirNoJustPlayer]);

  // Reseta o gatilho de auto-launch se o índice da fila mudar (permite avançar/voltar episódios)
  useEffect(() => {
    hasAutoLaunched.current = false;
  }, [queueIndex]);

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
          A transmissão está a ser processada com aceleração de hardware nativa e sincronização de histórico ativa.
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
