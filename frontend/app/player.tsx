import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList, AppState, useWindowDimensions, StatusBar } from "react-native";
import { useEvent, useEventListener } from "expo";
import { VideoView, useVideoPlayer, VideoSource } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius, spacing } from "../src/utils/theme";
import { PlayItem, useSession } from "../src/store/session";
import { EpgEntry, fmtTimeSP, xtream } from "../src/services/xtream";

const MAX_RETRIES = 3;
const CONTROLS_TIMEOUT = 4500;
type UiState = "connecting" | "loading" | "buffering" | "playing" | "paused" | "error";
const STATE_LABEL: Record<UiState, string> = {
  connecting: "Conectando...",
  loading: "Carregando...",
  buffering: "Buffering...",
  playing: "Reproduzindo",
  paused: "Pausado",
  error: "Não foi possível reproduzir este canal.",
};

function fmtClock(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return (h ? `${h}:` : "") + `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const queue = useSession((s) => s.queue);
  const queueIndex = useSession((s) => s.queueIndex);
  const setQueueIndex = useSession((s) => s.setQueueIndex);
  const session = useSession((s) => s.session);
  const isFav = useSession((s) => s.isFav);
  const toggleFav = useSession((s) => s.toggleFav);
  const addRecent = useSession((s) => s.addRecent);
  const saveProgress = useSession((s) => s.saveProgress);
  const progressMap = useSession((s) => s.ud.progress);

  const item: PlayItem | undefined = queue[queueIndex];
  const isLive = item?.kind === "live";

  const [ui, setUi] = useState<UiState>("connecting");
  const [attempt, setAttempt] = useState(0);
  const [fatal, setFatal] = useState(false);
  const [controls, setControls] = useState(true);
  const [panel, setPanel] = useState<null | "channels" | "info" | "audio" | "subs">(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [epg, setEpg] = useState<EpgEntry[]>([]);
  const [time, setTime] = useState({ cur: 0, dur: 0 });
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const urlIndex = useRef(0);
  const retryTimer = useRef<any>(null);
  const hideTimer = useRef<any>(null);
  const lastSaved = useRef(0);
  const viewRef = useRef<VideoView>(null);
  const resumedRef = useRef<string | null>(null);

  const makeSource = useCallback((it: PlayItem | undefined): VideoSource => {
    if (!it || !it.urls.length) return null;
    const uri = it.urls[urlIndex.current % it.urls.length];
    return { uri, headers: { "User-Agent": "GoldCastStreaming/1.0" }, metadata: { title: it.title, artist: it.subtitle } };
  }, []);

  // Single player instance for the whole screen; channels are swapped with replaceAsync.
  const player = useVideoPlayer(makeSource(item), (p) => {
    p.timeUpdateEventInterval = 1;
    p.staysActiveInBackground = false;
    p.showNowPlayingNotification = true; // MediaSession (Android) / Now Playing (iOS)
    p.play();
  });

  const { status, error } = useEvent(player, "statusChange", { status: player.status, error: undefined as any });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const audioTracks = useEvent(player, "availableAudioTracksChange", { availableAudioTracks: player.availableAudioTracks }).availableAudioTracks || [];
  const subTracks = useEvent(player, "availableSubtitleTracksChange", { availableSubtitleTracks: player.availableSubtitleTracks }).availableSubtitleTracks || [];

  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    const dur = player.duration || 0;
    setTime({ cur: currentTime, dur });
    if (!isLive && item?.progressKey && dur > 0 && Date.now() - lastSaved.current > 5000) {
      lastSaved.current = Date.now();
      saveProgress(item.progressKey, { position: currentTime, duration: dur, title: item.title, logo: item.logo, item });
    }
  });

  // Map native status -> UI state, with controlled reconnection (max 3 attempts, then manual)
  useEffect(() => {
    if (!item) return;
    if (status === "error") {
      if (attempt < MAX_RETRIES) {
        setUi("connecting");
        clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => {
          urlIndex.current += 1; // alternate https/http/backup candidates
          setAttempt((a) => a + 1);
          player.replaceAsync(makeSource(item)).then(() => player.play()).catch(() => {});
        }, 1500);
      } else {
        setUi("error");
        setFatal(true);
      }
      return;
    }
    if (status === "loading") setUi((u) => (u === "playing" || u === "paused" ? "buffering" : "loading"));
    else if (status === "readyToPlay") setUi(isPlaying ? "playing" : "paused");
  }, [status, isPlaying, attempt, item?.id]);

  useEffect(() => () => clearTimeout(retryTimer.current), []);

  // Load a different queue item (channel change / next episode)
  const loadIndex = useCallback((idx: number) => {
    if (!queue.length) return;
    const n = ((idx % queue.length) + queue.length) % queue.length;
    const it = queue[n];
    setQueueIndex(n);
    urlIndex.current = 0;
    setAttempt(0);
    setFatal(false);
    setUi("connecting");
    setEpg([]);
    setPanel(null);
    lastSaved.current = 0;
    resumedRef.current = null;
    player.replaceAsync(makeSource(it)).then(() => player.play()).catch(() => {});
  }, [queue, player, makeSource, setQueueIndex]);

  // Resume VOD progress once ready
  useEffect(() => {
    if (!item || isLive || status !== "readyToPlay" || resumedRef.current === item.id) return;
    resumedRef.current = item.id;
    const p = item.progressKey ? progressMap[item.progressKey] : undefined;
    if (p && p.duration > 0 && p.position > 10 && p.position < p.duration - 15) {
      player.currentTime = p.position;
    }
  }, [status, item?.id]);

  // Recents + EPG per item
  useEffect(() => {
    if (!item) return;
    addRecent(item.kind, item.raw ?? { id: item.id, name: item.title, stream_icon: item.logo });
    if (isLive && session && item.streamId != null) {
      let cancelled = false;
      xtream.shortEpg(session, item.streamId, 3).then((e) => !cancelled && setEpg(e));
      return () => { cancelled = true; };
    }
  }, [item?.id]);

  // Background/foreground lifecycle
  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "background" || st === "inactive") player.pause();
      else if (st === "active" && !fatal) player.play();
    });
    return () => sub.remove();
  }, [player, fatal]);

  // Auto-hide controls
  const bump = useCallback(() => {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), CONTROLS_TIMEOUT);
  }, []);
  useEffect(() => { bump(); return () => clearTimeout(hideTimer.current); }, [bump]);

  // Fullscreen = landscape lock + hidden status bar (keeps our own controls usable on Android)
  const toggleFullscreen = useCallback(async () => {
    const next = !fullscreen;
    setFullscreen(next);
    try {
      if (next) await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      else await ScreenOrientation.unlockAsync();
    } catch {}
  }, [fullscreen]);
  useEffect(() => () => { ScreenOrientation.unlockAsync().catch(() => {}); }, []);

  const goBack = useCallback(() => {
    try { player.pause(); } catch {}
    if (router.canGoBack()) router.back(); else router.replace("/(tabs)");
  }, [player, router]);

  const retryManual = () => {
    urlIndex.current = 0;
    setAttempt(0);
    setFatal(false);
    setUi("connecting");
    player.replaceAsync(makeSource(item)).then(() => player.play()).catch(() => {});
  };

  const changeVolume = (delta: number) => {
    const v = Math.min(1, Math.max(0, +(volume + delta).toFixed(2)));
    setVolume(v);
    player.volume = v;
    if (v > 0 && muted) { setMuted(false); player.muted = false; }
  };
  const toggleMute = () => { const m = !muted; setMuted(m); player.muted = m; };

  const now = epg.find((e) => e.start_timestamp * 1000 <= Date.now() && e.stop_timestamp * 1000 > Date.now()) || epg[0];
  const next = epg.find((e) => e.start_timestamp * 1000 > Date.now());
  const fav = item ? isFav(item.favKind || item.kind, item.favId || item.id) : false;

  if (!item) {
    return (
      <View style={styles.errorRoot} testID="player-empty">
        <Text style={styles.errorText}>Nenhum conteúdo selecionado.</Text>
        <Pressable onPress={goBack} style={styles.outlineBtn}><Text style={styles.outlineBtnText}>VOLTAR</Text></Pressable>
      </View>
    );
  }

  const side = landscape ? Math.min(380, width * 0.42) : width;
  const busy = ui === "connecting" || ui === "loading" || ui === "buffering";

  return (
    <View style={styles.root} testID="player-screen">
      <StatusBar hidden={fullscreen || landscape} />
      <VideoView ref={viewRef} player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} allowsPictureInPicture />

      {/* Tap layer */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => (controls ? setControls(false) : bump())} testID="player-tap" />

      {/* Status overlay */}
      {busy && !fatal && (
        <View style={styles.center} pointerEvents="none" testID="player-status">
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.stateText}>{STATE_LABEL[ui]}{attempt > 0 ? ` (tentativa ${attempt}/${MAX_RETRIES})` : ""}</Text>
        </View>
      )}
      {fatal && (
        <View style={styles.errorOverlay} testID="player-error">
          <Ionicons name="alert-circle" size={44} color={colors.error} />
          <Text style={styles.errorTitle}>Não foi possível reproduzir este conteúdo.</Text>
          {!!error?.message && <Text style={styles.errorHint} numberOfLines={2}>{String(error.message).slice(0, 140)}</Text>}
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Pressable testID="player-retry" onPress={retryManual} style={({ focused }) => [styles.goldBtn, focused && styles.focused]}>
              <Ionicons name="refresh" size={18} color={colors.onGold} /><Text style={styles.goldBtnText}>TENTAR NOVAMENTE</Text>
            </Pressable>
            <Pressable testID="player-back-error" onPress={goBack} style={({ focused }) => [styles.outlineBtn, focused && styles.focused]}>
              <Text style={styles.outlineBtnText}>VOLTAR</Text>
            </Pressable>
          </View>
        </View>
      )}

      {controls && (
        <>
          {/* Top bar */}
          <View style={[styles.topBar, { paddingTop: (fullscreen || landscape ? 8 : insets.top + 8) }]}>
            <IconBtn testID="player-close" name="chevron-back" onPress={goBack} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {isLive && <View style={styles.liveBadge}><Text style={styles.liveText}>🔴 AO VIVO</Text></View>}
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              </View>
              {!!item.subtitle && <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text>}
            </View>
            <IconBtn testID="player-fav" name={fav ? "star" : "star-outline"} color={fav ? colors.gold : colors.text} onPress={() => toggleFav(item.favKind || item.kind, item.favId || item.id)} />
            {audioTracks.length > 1 && <IconBtn testID="player-audio" name="musical-notes-outline" onPress={() => setPanel(panel === "audio" ? null : "audio")} />}
            {subTracks.length > 0 && <IconBtn testID="player-subs" name="text-outline" onPress={() => setPanel(panel === "subs" ? null : "subs")} />}
            <IconBtn testID="player-info" name="information-circle-outline" onPress={() => setPanel(panel === "info" ? null : "info")} />
            {isLive && queue.length > 1 && <IconBtn testID="player-list" name="list" onPress={() => setPanel(panel === "channels" ? null : "channels")} />}
          </View>

          {/* Bottom controls */}
          <View style={[styles.bottom, { paddingBottom: (fullscreen || landscape ? 12 : insets.bottom + 12) }]}>
            {isLive ? (
              <View style={styles.epgRow}>
                <Text style={styles.epgNow} numberOfLines={1}>{now ? `AGORA  ${fmtTimeSP(now.start_timestamp)}  ${now.title}` : "Programação não disponível."}</Text>
                {next && <Text style={styles.epgNext} numberOfLines={1}>Próximo: {fmtTimeSP(next.start_timestamp)} — {next.title}</Text>}
                {now && <ProgressBar value={(Date.now() / 1000 - now.start_timestamp) / Math.max(1, now.stop_timestamp - now.start_timestamp)} />}
              </View>
            ) : (
              <View style={styles.seekRow}>
                <Text style={styles.time}>{fmtClock(time.cur)}</Text>
                <Pressable
                  testID="player-seekbar"
                  style={styles.seekTrack}
                  onPress={(e) => {
                    const x = e.nativeEvent.locationX;
                    const w = (e.nativeEvent as any).target?.clientWidth || seekWidth.current || 1;
                    if (time.dur > 0) player.currentTime = Math.max(0, Math.min(time.dur, (x / w) * time.dur));
                    bump();
                  }}
                  onLayout={(e) => (seekWidth.current = e.nativeEvent.layout.width)}
                >
                  <View style={[styles.seekFill, { width: `${time.dur ? Math.min(100, (time.cur / time.dur) * 100) : 0}%` }]} />
                </Pressable>
                <Text style={styles.time}>{fmtClock(time.dur)}</Text>
              </View>
            )}

            <View style={styles.ctrlRow}>
              <IconBtn testID="player-mute" name={muted || volume === 0 ? "volume-mute" : "volume-high"} onPress={toggleMute} />
              <IconBtn testID="player-vol-down" name="remove" onPress={() => changeVolume(-0.1)} small />
              <View style={styles.volTrack}><View style={[styles.volFill, { width: `${muted ? 0 : volume * 100}%` }]} /></View>
              <IconBtn testID="player-vol-up" name="add" onPress={() => changeVolume(0.1)} small />
              <View style={{ flex: 1 }} />
              {isLive ? (
                <IconBtn testID="player-ch-prev" name="play-skip-back" onPress={() => loadIndex(queueIndex - 1)} label="CH-" disabled={queue.length < 2} />
              ) : (
                <IconBtn testID="player-rew" name="play-back" onPress={() => { player.seekBy(-10); bump(); }} />
              )}
              <Pressable
                testID="player-playpause"
                onPress={() => { if (isPlaying) player.pause(); else player.play(); bump(); }}
                style={({ focused }) => [styles.playBtn, focused && styles.focused]}
              >
                <Ionicons name={isPlaying ? "pause" : "play"} size={30} color={colors.onGold} />
              </Pressable>
              {isLive ? (
                <IconBtn testID="player-ch-next" name="play-skip-forward" onPress={() => loadIndex(queueIndex + 1)} label="CH+" disabled={queue.length < 2} />
              ) : (
                <IconBtn testID="player-fwd" name="play-forward" onPress={() => { player.seekBy(10); bump(); }} />
              )}
              <View style={{ flex: 1 }} />
              {!isLive && queue.length > 1 && <IconBtn testID="player-next-ep" name="play-skip-forward" onPress={() => loadIndex(queueIndex + 1)} />}
              <IconBtn testID="player-fullscreen" name={fullscreen ? "contract" : "expand"} onPress={toggleFullscreen} />
            </View>
          </View>
        </>
      )}

      {/* Side panels */}
      {panel && (
        <View style={[styles.panel, { width: side, paddingTop: (fullscreen || landscape ? 12 : insets.top + 12) }]} testID={`player-panel-${panel}`}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>
              {panel === "channels" ? "Canais" : panel === "info" ? "Informações" : panel === "audio" ? "Áudio" : "Legendas"}
            </Text>
            <IconBtn testID="player-panel-close" name="close" onPress={() => setPanel(null)} />
          </View>
          {panel === "channels" && (
            <FlatList
              data={queue}
              keyExtractor={(q) => q.id}
              initialScrollIndex={Math.min(queueIndex, Math.max(0, queue.length - 1))}
              getItemLayout={(_, i) => ({ length: 64, offset: 64 * i, index: i })}
              renderItem={({ item: q, index }) => (
                <Pressable testID={`player-ch-${q.id}`} onPress={() => loadIndex(index)} style={({ focused }) => [styles.chRow, index === queueIndex && styles.chRowActive, focused && styles.focused]}>
                  <View style={styles.chLogo}>{q.logo ? <Image source={{ uri: q.logo }} style={{ width: 40, height: 28 }} contentFit="contain" recyclingKey={q.id} /> : <Ionicons name="tv" size={18} color={colors.textDim} />}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.chName, index === queueIndex && { color: colors.gold }]} numberOfLines={1}>{q.title}</Text>
                    <Text style={styles.chCat} numberOfLines={1}>{index === queueIndex && now ? now.title : q.subtitle || ""}</Text>
                  </View>
                </Pressable>
              )}
              windowSize={5}
              removeClippedSubviews
            />
          )}
          {panel === "info" && (
            <View style={{ padding: spacing.lg, gap: spacing.sm }}>
              <Info label="Título" value={item.title} />
              {!!item.subtitle && <Info label="Categoria" value={item.subtitle} />}
              <Info label="Estado" value={STATE_LABEL[ui]} />
              <Info label="Tipo" value={isLive ? "Canal ao vivo" : item.kind === "vod" ? "Filme" : "Episódio"} />
              {!isLive && time.dur > 0 && <Info label="Duração" value={fmtClock(time.dur)} />}
              {audioTracks.length > 0 && <Info label="Faixas de áudio" value={String(audioTracks.length)} />}
              {subTracks.length > 0 && <Info label="Legendas" value={String(subTracks.length)} />}
              {isLive && (now ? <Info label="Agora" value={`${fmtTimeSP(now.start_timestamp)}–${fmtTimeSP(now.stop_timestamp)} ${now.title}`} /> : <Info label="Programação" value="Programação não disponível." />)}
              {isLive && next && <Info label="Próximo" value={`${fmtTimeSP(next.start_timestamp)} — ${next.title}`} />}
              {!!now?.description && <Text style={styles.desc} numberOfLines={6}>{now.description}</Text>}
            </View>
          )}
          {panel === "audio" && (
            <View style={{ padding: spacing.md }}>
              {audioTracks.map((t, i) => (
                <Pressable key={t.id || i} testID={`player-audio-${i}`} onPress={() => { player.audioTrack = t; setPanel(null); }} style={({ focused }) => [styles.chRow, player.audioTrack?.id === t.id && styles.chRowActive, focused && styles.focused]}>
                  <Text style={styles.chName}>{t.label || t.name || t.language || `Faixa ${i + 1}`}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {panel === "subs" && (
            <View style={{ padding: spacing.md }}>
              <Pressable testID="player-subs-off" onPress={() => { player.subtitleTrack = null; setPanel(null); }} style={({ focused }) => [styles.chRow, !player.subtitleTrack && styles.chRowActive, focused && styles.focused]}>
                <Text style={styles.chName}>Desativadas</Text>
              </Pressable>
              {subTracks.map((t, i) => (
                <Pressable key={t.id || i} testID={`player-subs-${i}`} onPress={() => { player.subtitleTrack = t; setPanel(null); }} style={({ focused }) => [styles.chRow, player.subtitleTrack?.id === t.id && styles.chRowActive, focused && styles.focused]}>
                  <Text style={styles.chName}>{t.label || t.name || t.language || `Legenda ${i + 1}`}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const seekWidth = { current: 0 };

function IconBtn({ name, onPress, testID, color, small, label, disabled }: { name: any; onPress: () => void; testID?: string; color?: string; small?: boolean; label?: string; disabled?: boolean }) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled} hitSlop={6} style={({ focused, pressed }) => [styles.iconBtn, small && styles.iconBtnSmall, focused && styles.focused, (pressed || disabled) && { opacity: 0.5 }]}>
      <Ionicons name={name} size={small ? 16 : 22} color={color || colors.text} />
      {label ? <Text style={styles.iconLabel}>{label}</Text> : null}
    </Pressable>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}
function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return <View style={styles.epgTrack}><View style={[styles.epgFill, { width: `${pct}%` }]} /></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: spacing.md },
  stateText: { color: colors.text, fontSize: 14, fontWeight: "600", backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md, backgroundColor: "rgba(0,0,0,0.55)" },
  title: { color: colors.text, fontSize: 16, fontWeight: "700", flexShrink: 1 },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  liveBadge: { backgroundColor: "rgba(244,67,54,0.25)", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  liveText: { color: colors.text, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingTop: spacing.md, backgroundColor: "rgba(0,0,0,0.6)", gap: spacing.sm },
  epgRow: { gap: 4 },
  epgNow: { color: colors.text, fontSize: 13, fontWeight: "600" },
  epgNext: { color: colors.textMuted, fontSize: 12 },
  epgTrack: { height: 3, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, marginTop: 4 },
  epgFill: { height: 3, backgroundColor: colors.gold, borderRadius: 2 },
  seekRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  seekTrack: { flex: 1, height: 24, justifyContent: "center" },
  seekFill: { height: 4, backgroundColor: colors.gold, borderRadius: 2 },
  time: { color: colors.textMuted, fontSize: 12, minWidth: 44, textAlign: "center" },
  ctrlRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  iconBtn: { minWidth: 44, height: 44, paddingHorizontal: 6, borderRadius: 22, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 2 },
  iconBtnSmall: { minWidth: 32, height: 32, borderRadius: 16 },
  iconLabel: { color: colors.text, fontSize: 10, fontWeight: "700" },
  playBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginHorizontal: spacing.sm },
  volTrack: { width: 70, height: 4, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 2 },
  volFill: { height: 4, backgroundColor: colors.gold, borderRadius: 2 },
  focused: { borderWidth: 2, borderColor: colors.gold, transform: [{ scale: 1.05 }] },
  errorOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: "rgba(0,0,0,0.88)", padding: spacing.xl },
  errorRoot: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: "#000" },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
  errorHint: { color: colors.textDim, fontSize: 12, textAlign: "center" },
  errorText: { color: colors.text, fontSize: 14, textAlign: "center" },
  goldBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.gold, paddingHorizontal: 18, height: 46, borderRadius: radius.pill },
  goldBtnText: { color: colors.onGold, fontWeight: "700", fontSize: 13 },
  outlineBtn: { paddingHorizontal: 18, height: 46, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  outlineBtnText: { color: colors.gold, fontWeight: "700", fontSize: 13 },
  panel: { position: "absolute", top: 0, right: 0, bottom: 0, backgroundColor: "rgba(10,10,10,0.96)", borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: spacing.lg, paddingRight: spacing.sm, paddingBottom: spacing.sm },
  panelTitle: { color: colors.gold, fontSize: 16, fontWeight: "700" },
  chRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, height: 64, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  chRowActive: { backgroundColor: "rgba(212,175,55,0.12)" },
  chLogo: { width: 48, height: 32, borderRadius: 4, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  chName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  chCat: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  infoLabel: { color: colors.textDim, fontSize: 12, width: 110, textTransform: "uppercase", letterSpacing: 0.4 },
  infoValue: { color: colors.text, fontSize: 13, flex: 1 },
  desc: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
});
