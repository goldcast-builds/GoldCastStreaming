import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  NativeModules,
  DeviceEventEmitter,
  Modal,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { Logo } from "../src/components/Logo";
import { colors, radius, spacing } from "../src/utils/theme";
import { reportError } from "../src/utils/logger";
import { useSession, PlayItem } from "../src/store/session";

function buildLiveUrl(sessionObj: any, channelId: string | number): string {
  const server = sessionObj?.server || sessionObj?.url || "";
  const username = sessionObj?.user || sessionObj?.username || sessionObj?.userInfo?.username || "";
  const password = sessionObj?.pass || sessionObj?.password || sessionObj?.userInfo?.password || "";
  if (!server || !username || !password || !channelId) return "";
  const cleanServer = String(server).replace(/\/+$/, "");
  let url = `${cleanServer}/live/${username}/${password}/${channelId}.ts`;
  if (url.toLowerCase().startsWith("https://")) {
    url = "http://" + url.substring(8);
  }
  return url;
}

export default function PlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rawParams = useLocalSearchParams<Record<string, any>>();

  const queue = useSession((s: any) => s.queue || []) as PlayItem[];
  const queueIndex = useSession((s: any) => s.queueIndex ?? s.currentIndex ?? s.index ?? 0);
  const setQueue = useSession((s: any) => s.setQueue);
  const session = useSession((s: any) => s.session || s);
  const catalog = useSession((s: any) => s.catalog);
  const ud = useSession((s: any) => s.ud);
  const saveProgress = useSession((s: any) => s.saveProgress);
  const removeProgress = useSession((s: any) => s.removeProgress);
  const addRecent = useSession((s: any) => s.addRecent);

  const [channelPickerVisible, setChannelPickerVisible] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hasAutoLaunched = useRef(false);
  const lastAutoUrlRef = useRef<string>("");

  const liveChannelsList = useMemo(() => {
    const rawList = catalog?.live || catalog?.channels || [];
    return Array.isArray(rawList) ? rawList : [];
  }, [catalog]);

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
    return String(
      rawParams.type ||
        rawParams.stream_type ||
        rawParams.kind ||
        activePlayItem?.kind ||
        "live"
    ).toLowerCase();
  }, [rawParams, activePlayItem]);

  const isLive = streamType === "live";

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
      return !isLive ? `${streamType}_${streamId}` : "";
    }
    return "";
  }, [activePlayItem, streamId, streamType, isLive]);

  const savedProgress = useMemo(() => {
    if (!progressKey || isLive) return null;
    const allProgress = ud?.progress || {};
    return allProgress[progressKey] || (streamId ? allProgress[String(streamId)] : null) || null;
  }, [progressKey, streamId, isLive, ud]);

  const startPositionMs = useMemo(() => {
    if (isLive) return 0;

    const paramResumeSec = Number(rawParams?.resumeSec || rawParams?.resume || 0);
    if (paramResumeSec > 10) {
      return Math.round(paramResumeSec * 1000);
    }

    if (!savedProgress) return 0;
    const pos = Number(savedProgress.position) || 0;
    const dur = Number(savedProgress.duration) || 0;

    if (dur > 0 && pos / dur >= 0.95) return 0;
    if (pos < 10) return 0;

    return pos > 100000 ? pos : Math.round(pos * 1000);
  }, [savedProgress, isLive, rawParams]);

  const streamUrl = useMemo(() => {
    let rawUrl = "";

    if (activePlayItem?.urls && activePlayItem.urls.length > 0) {
      const firstUrl = activePlayItem.urls[0];
      if (
        firstUrl &&
        typeof firstUrl === "string" &&
        (firstUrl.startsWith("http://") || firstUrl.startsWith("https://"))
      ) {
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

      if (
        directUrl &&
        typeof directUrl === "string" &&
        (directUrl.startsWith("http://") || directUrl.startsWith("https://"))
      ) {
        rawUrl = directUrl;
      }
    }

    if (!rawUrl) {
      const server = session?.server || session?.url || "";
      const username = session?.user || session?.username || session?.userInfo?.username || "";
      const password = session?.pass || session?.password || session?.userInfo?.password || "";

      if (streamId && server && username && password) {
        const cleanServer = String(server).replace(/\/+$/, "");
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

  const currentLiveIndex = useMemo(() => {
    if (!isLive || liveChannelsList.length === 0 || !streamId) return -1;
    return liveChannelsList.findIndex(
      (c: any) => String(c?.stream_id || c?.id || "") === String(streamId)
    );
  }, [isLive, liveChannelsList, streamId]);

  const switchToLiveChannel = useCallback(
    (channelItem: any) => {
      if (!channelItem) return;
      const chId = String(channelItem?.stream_id || channelItem?.id || "");
      const chName = channelItem?.name || channelItem?.title || "Canal ao Vivo";
      const chLogo = channelItem?.stream_icon || "";
      const url = buildLiveUrl(session, chId);

      if (!url) {
        setErrorMsg("Não foi possível gerar a URL deste canal.");
        return;
      }

      const nextPlayItem: PlayItem = {
        kind: "live" as any,
        id: chId,
        title: chName,
        subtitle: "Canal ao Vivo",
        logo: chLogo,
        urls: [url],
        raw: channelItem,
      };

      setChannelPickerVisible(false);
      setErrorMsg(null);
      hasAutoLaunched.current = false;
      lastAutoUrlRef.current = "";

      if (typeof setQueue === "function") {
        setQueue([nextPlayItem], 0);
      }

      router.replace({
        pathname: "/player",
        params: {
          title: chName,
          type: "live",
          stream_id: chId,
          url,
          logo: chLogo,
        },
      });
    },
    [session, setQueue, router]
  );

  const handleStepChannel = useCallback(
    (delta: -1 | 1) => {
      if (!isLive || liveChannelsList.length === 0) return;
      const baseIdx = currentLiveIndex >= 0 ? currentLiveIndex : 0;
      const nextIdx = (baseIdx + delta + liveChannelsList.length) % liveChannelsList.length;
      switchToLiveChannel(liveChannelsList[nextIdx]);
    },
    [isLive, liveChannelsList, currentLiveIndex, switchToLiveChannel]
  );

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

        const posSec = Math.round(Number(data.position) || 0);
        const durSec = Math.round(Number(data.duration) || 0);

        if (durSec > 0 && posSec > 10) {
          const ratio = posSec / durSec;
          if (ratio >= 0.95) {
            if (typeof removeProgress === "function") {
              removeProgress(data.progressKey);
            }
          } else if (typeof saveProgress === "function") {
            const itemToSave: PlayItem = activePlayItem || {
              kind: (data.streamType as any) || "vod",
              id: String(streamId),
              title: String(title),
              urls: streamUrl ? [streamUrl] : [],
              progressKey: data.progressKey,
              logo: rawParams.logo || rawParams.stream_icon,
            };

            saveProgress(data.progressKey, {
              position: posSec,
              duration: durSec,
              title: String(title),
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
        if ((activePlayItem || streamId) && typeof addRecent === "function") {
          addRecent(
            (streamType as any) || "live",
            activePlayItem || { id: streamId, title, urls: [streamUrl] }
          );
        }

        NativeModules.JustPlayer.play(
          streamUrl,
          String(title),
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
    if (!streamUrl) return;
    if (!hasAutoLaunched.current || lastAutoUrlRef.current !== streamUrl) {
      hasAutoLaunched.current = true;
      lastAutoUrlRef.current = streamUrl;
      const timer = setTimeout(() => {
        abrirNoJustPlayer();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [streamUrl, abrirNoJustPlayer]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar hidden={true} translucent={true} />

      <View style={styles.header}>
        <Pressable
          focusable={true}
          accessible={true}
          style={({ focused }) => [styles.backBtn, focused && styles.cardFocused]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.gold} />
          <Text style={styles.backBtnText}>Voltar</Text>
        </Pressable>

        {isLive && liveChannelsList.length > 0 && (
          <View style={styles.zappingHeaderGroup}>
            <Pressable
              focusable={true}
              accessible={true}
              style={({ focused }) => [styles.zappingBtn, focused && styles.cardFocused]}
              onPress={() => handleStepChannel(-1)}
            >
              <Ionicons name="chevron-back" size={18} color="#FFF" />
              <Text style={styles.zappingBtnText}>Anterior</Text>
            </Pressable>

            <Pressable
              focusable={true}
              accessible={true}
              style={({ focused }) => [styles.zappingBtnGold, focused && styles.cardFocused]}
              onPress={() => setChannelPickerVisible(true)}
            >
              <Ionicons name="list" size={16} color="#000" />
              <Text style={styles.zappingBtnGoldText}>Canais</Text>
            </Pressable>

            <Pressable
              focusable={true}
              accessible={true}
              style={({ focused }) => [styles.zappingBtn, focused && styles.cardFocused]}
              onPress={() => handleStepChannel(1)}
            >
              <Text style={styles.zappingBtnText}>Próximo</Text>
              <Ionicons name="chevron-forward" size={18} color="#FFF" />
            </Pressable>
          </View>
        )}
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
          <Pressable
            focusable={true}
            accessible={true}
            hasTVPreferredFocus={true}
            disabled={launching}
            style={({ focused }) => [
              styles.primaryActionBtn,
              focused && styles.cardFocused,
              launching && { opacity: 0.7 },
            ]}
            onPress={abrirNoJustPlayer}
          >
            {launching ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Ionicons name="play" size={18} color="#000" />
            )}
            <Text style={styles.primaryActionText}>
              {launching ? "A CONECTAR..." : "REPRODUZIR NOVAMENTE"}
            </Text>
          </Pressable>

          <Pressable
            focusable={true}
            accessible={true}
            style={({ focused }) => [styles.exitBtn, focused && styles.cardFocused]}
            onPress={() => router.back()}
          >
            <Ionicons name="close-circle-outline" size={18} color="#8E929C" />
            <Text style={styles.exitBtnText}>Sair e Voltar ao Catálogo</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={channelPickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setChannelPickerVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Troca Rápida de Canal</Text>
              <Pressable
                focusable={true}
                accessible={true}
                onPress={() => setChannelPickerVisible(false)}
                style={({ focused }) => [styles.pickerClose, focused && styles.cardFocused]}
              >
                <Ionicons name="close" size={20} color="#FFF" />
              </Pressable>
            </View>

            <FlatList
              data={liveChannelsList.slice(0, 120)}
              keyExtractor={(item: any, idx) => `qp-${item?.stream_id || item?.id || idx}-${idx}`}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={false}
              renderItem={({ item }: { item: any }) => {
                const chId = String(item?.stream_id || item?.id || "");
                const chName = item?.name || item?.title || "Canal";
                const chLogo = item?.stream_icon || "";
                const isCurrent = String(chId) === String(streamId);

                return (
                  <Pressable
                    focusable={true}
                    accessible={true}
                    onPress={() => switchToLiveChannel(item)}
                    style={({ focused }) => [
                      styles.pickerRow,
                      isCurrent && styles.pickerRowActive,
                      focused && styles.cardFocused,
                    ]}
                  >
                    {chLogo ? (
                      <Image
                        source={{ uri: chLogo }}
                        style={styles.pickerLogo}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <Ionicons name="tv-outline" size={20} color={colors.gold} />
                    )}
                    <Text style={styles.pickerRowText} numberOfLines={1}>
                      {chName}
                    </Text>
                    {isCurrent && <Ionicons name="radio" size={16} color={colors.gold} />}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#07080A",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 12,
    flexWrap: "wrap",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: "rgba(229, 169, 59, 0.08)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  backBtnText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "700",
  },
  zappingHeaderGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  zappingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: radius.sm,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  zappingBtnText: {
    color: "#FFF",
    fontSize: 12.5,
    fontWeight: "700",
  },
  zappingBtnGold: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: "transparent",
  },
  zappingBtnGoldText: {
    color: "#000",
    fontSize: 12.5,
    fontWeight: "900",
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
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.gold,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "transparent",
  },
  primaryActionText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  exitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: "transparent",
  },
  exitBtnText: {
    color: "#8E929C",
    fontSize: 13,
    fontWeight: "600",
  },
  cardFocused: {
    borderColor: "#E9C46A",
    borderWidth: 3,
    transform: [{ scale: 1.02 }],
    backgroundColor: "rgba(229, 169, 59, 0.15)",
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerCard: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "82%",
    backgroundColor: "#141722",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(229,169,59,0.4)",
    padding: 16,
    gap: 10,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerTitle: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: "800",
  },
  pickerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#222634",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#1A1E2D",
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  pickerRowActive: {
    borderColor: "rgba(229,169,59,0.5)",
  },
  pickerLogo: {
    width: 34,
    height: 24,
  },
  pickerRowText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
});
