import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList, AppState, Platform, useWindowDimensions, StatusBar, PanResponder } from "react-native";
import { useEventListener } from "expo";
import { VideoView, useVideoPlayer, VideoSource } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Brightness from "expo-brightness";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius, spacing } from "../src/utils/theme";
import { PlayItem, useSession } from "../src/store/session";
import { EpgEntry, fmtTimeSP, redactUrl, xtream } from "../src/services/xtream";
import { EngineStatus, TrackInfo, WebVideo, WebVideoHandle } from "../src/components/WebVideo";

const MAX_RETRIES = 3;
const CONTROLS_TIMEOUT = 4500;
const SPEEDS = [1, 1.25, 1.5, 2, 0.5, 0.75];
const FITS = ["contain", "cover", "fill"] as const;
const FIT_LABEL: Record<(typeof FITS)[number], string> = { contain: "AJUSTAR", cover: "PREENCHER", fill: "ESTICAR" };
const UA = "GoldCastStreaming/1.0";
const isWeb = Platform.OS === "web";

type UiState = "connecting" | "loading" | "buffering" | "playing" | "paused" | "error";
const STATE_LABEL: Record<UiState, string> = {
  connecting: "Conectando...", loading: "Carregando...", buffering: "Buffering...", playing: "Reproduzindo", paused: "Pausado", error: "Não foi possível reproduzir este canal.",
};

function fmtClock(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return (h ? `${h}:` : "") + `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function nowClock(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  const prefs = useSession((s) => s.prefs);
  const deviceMode = useSession((s) => s.deviceMode);
  const isFav = useSession((s) => s.isFav);
  const toggleFav = useSession((s) => s.toggleFav);
  const addRecent = useSession((s) => s.addRecent);
  const saveProgress = useSession((s) => s.saveProgress);
  const progressMap = useSession((s) => s.ud.progress);

  const item: PlayItem | undefined = queue[queueIndex];
  const isLive = item?.kind === "live";
  const big = deviceMode === "tv";

  // ---------- engine state ----------
  const [status, setStatus] = useState<EngineStatus>("loading");
  const [errMsg, setErrMsg] = useState<string | undefined>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState({ cur: 0, dur: 0 });
  const [audioTracks, setAudioTracks] = useState<TrackInfo[]>([]);
  const [subTracks, setSubTracks] = useState<TrackInfo[]>([]);
  const [audioSel, setAudioSel] = useState<string | null>(null);
  const [subSel, setSubSel] = useState<string | null>(null);

  // ---------- ui state ----------
  const [ui, setUi] = useState<UiState>("connecting");
  const [attempt, setAttempt] = useState(0);
  const [fatal, setFatal] = useState(false);
  const [controls, setControls] = useState(true);
  const [locked, setLocked] = useState(false);
  const [lockHint, setLockHint] = useState(false);
  const [panel, setPanel] = useState<null | "channels" | "info" | "audio" | "subs">(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fitIdx, setFitIdx] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [epg, setEpg] = useState<EpgEntry[]>([]);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [brightness, setBrightness] = useState(1);
  const [gesture, setGesture] = useState<null | { kind: "volume" | "brightness" | "seek"; value: number; label: string }>(null);
  const [flash, setFlash] = useState<null | { side: "left" | "right"; label: string }>(null);
  const [clock, setClock] = useState(nowClock());

  const urlIndex = useRef(0);
  const retryTimer = useRef<any>(null);
  const hideTimer = useRef<any>(null);
  const lastSaved = useRef(0);
  const resumedRef = useRef<string | null>(null);
  const webRef = useRef<WebVideoHandle>(null);
  const seekWidth = useRef(1);
  const stateRef = useRef({ volume: 1, brightness: 1, time: { cur: 0, dur: 0 }, isLive: false, locked: false, controls: true, queueLen: 0, muted: false });
  stateRef.current = { volume, brightness, time, isLive, locked, controls, queueLen: queue.length, muted };

  const currentUri = useCallback((it: PlayItem | undefined) => (it && it.urls.length ? it.urls[urlIndex.current % it.urls.length] : null), []);
  const makeSource = useCallback((it: PlayItem | undefined): VideoSource => {
    const uri = currentUri(it);
    return uri ? { uri, headers: { "User-Agent": UA }, metadata: { title: it!.title, artist: it!.subtitle } } : null;
  }, [currentUri]);

  // Single native player instance (Media3/ExoPlayer on Android). Web uses <video>+hls.js via WebVideo.
  const player = useVideoPlayer(isWeb ? null : makeSource(item), (p) => {
    p.timeUpdateEventInterval = 1;
    p.staysActiveInBackground = false;
    p.showNowPlayingNotification = true; // MediaSession / Now Playing
    if (prefs.autoplay) p.play();
  });
  useEventListener(player, "statusChange", ({ status: s, error }) => { if (!isWeb) { setStatus(s === "idle" ? "loading" : (s as EngineStatus)); setErrMsg(error?.message); } });
  useEventListener(player, "playingChange", ({ isPlaying: p }) => { if (!isWeb) setIsPlaying(p); });
  useEventListener(player, "timeUpdate", ({ currentTime }) => { if (!isWeb) setTime({ cur: currentTime, dur: player.duration || 0 }); });
  useEventListener(player, "availableAudioTracksChange", ({ availableAudioTracks }) => setAudioTracks((availableAudioTracks || []).map((t, i) => ({ id: t.id || String(i), label: t.label || t.name || t.language || `Faixa ${i + 1}`, language: t.language }))));
  useEventListener(player, "availableSubtitleTracksChange", ({ availableSubtitleTracks }) => setSubTracks((availableSubtitleTracks || []).map((t, i) => ({ id: t.id || String(i), label: t.label || t.name || t.language || `Legenda ${i + 1}`, language: t.language }))));

  const engine = useMemo(() => ({
    load: (it: PlayItem | undefined) => {
      const uri = currentUri(it);
      if (!uri) return;
      if (isWeb) webRef.current?.load(uri);
      else player.replaceAsync(makeSource(it)).then(() => player.play()).catch(() => {});
    },
    play: () => (isWeb ? webRef.current?.play() : player.play()),
    pause: () => (isWeb ? webRef.current?.pause() : player.pause()),
    seekTo: (s: number) => { if (isWeb) webRef.current?.seekTo(s); else player.currentTime = s; },
    seekBy: (s: number) => (isWeb ? webRef.current?.seekBy(s) : player.seekBy(s)),
    setVolume: (v: number) => { if (isWeb) webRef.current?.setVolume(v); else player.volume = v; },
    setMuted: (m: boolean) => { if (isWeb) webRef.current?.setMuted(m); else player.muted = m; },
    setRate: (r: number) => { if (isWeb) webRef.current?.setRate(r); else player.playbackRate = r; },
    setAudio: (id: string | null) => { if (isWeb) webRef.current?.setAudioTrack(id); else player.audioTrack = player.availableAudioTracks.find((t, i) => (t.id || String(i)) === id) || null; },
    setSub: (id: string | null) => { if (isWeb) webRef.current?.setSubtitleTrack(id); else player.subtitleTrack = id == null ? null : player.availableSubtitleTracks.find((t, i) => (t.id || String(i)) === id) || null; },
  }), [player, makeSource, currentUri]);

  // Web: load initial source once the <video> is mounted
  useEffect(() => { if (isWeb && item) setTimeout(() => engine.load(item), 50); }, []);

  // Map engine status -> UI state with controlled reconnection
  useEffect(() => {
    if (!item) return;
    if (status === "error") {
      if (prefs.autoReconnect && attempt < MAX_RETRIES) {
        setUi("connecting");
        clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => {
          urlIndex.current += 1; // alternate https / http / backup server candidates
          setAttempt((a) => a + 1);
          engine.load(item);
        }, 1500);
      } else { setUi("error"); setFatal(true); }
      return;
    }
    if (status === "loading") setUi((u) => (u === "playing" || u === "paused" ? "buffering" : "loading"));
    else if (status === "readyToPlay") setUi(isPlaying ? "playing" : "paused");
  }, [status, isPlaying, attempt, item?.id]);
  useEffect(() => () => clearTimeout(retryTimer.current), []);

  // Progress save (VOD)
  useEffect(() => {
    if (isLive || !item?.progressKey || time.dur <= 0 || Date.now() - lastSaved.current < 5000) return;
    lastSaved.current = Date.now();
    saveProgress(item.progressKey, { position: time.cur, duration: time.dur, title: item.title, logo: item.logo, item });
  }, [time.cur]);

  // Resume VOD position
  useEffect(() => {
    if (!item || isLive || status !== "readyToPlay" || resumedRef.current === item.id) return;
    resumedRef.current = item.id;
    const p = item.progressKey ? progressMap[item.progressKey] : undefined;
    if (p && p.duration > 0 && p.position > 10 && p.position < p.duration - 15) engine.seekTo(p.position);
  }, [status, item?.id]);

  // Recents + EPG
  useEffect(() => {
    if (!item) return;
    addRecent(item.kind, item.raw ?? { id: item.id, name: item.title, stream_icon: item.logo });
    if (isLive && session && item.streamId != null) {
      let cancelled = false;
      xtream.shortEpg(session, item.streamId, 3).then((e) => !cancelled && setEpg(e));
      return () => { cancelled = true; };
    }
  }, [item?.id]);

  const loadIndex = useCallback((idx: number) => {
    if (!queue.length) return;
    const n = ((idx % queue.length) + queue.length) % queue.length;
    const it = queue[n];
    setQueueIndex(n);
    urlIndex.current = 0;
    setAttempt(0); setFatal(false); setUi("connecting"); setEpg([]); setPanel(null); setAudioTracks([]); setSubTracks([]);
    lastSaved.current = 0; resumedRef.current = null;
    setFlash({ side: idx > queueIndex ? "right" : "left", label: it.title });
    setTimeout(() => setFlash(null), 900);
    engine.load(it);
  }, [queue, queueIndex, engine, setQueueIndex]);

  // Lifecycle
  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "background" || st === "inactive") engine.pause();
      else if (st === "active" && !fatal) engine.play();
    });
    return () => sub.remove();
  }, [engine, fatal]);
  useEffect(() => { const t = setInterval(() => setClock(nowClock()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!isWeb) Brightness.getBrightnessAsync().then((b) => setBrightness(b)).catch(() => {}); }, []);

  const bump = useCallback(() => {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), CONTROLS_TIMEOUT);
  }, []);
  useEffect(() => { bump(); return () => clearTimeout(hideTimer.current); }, [bump]);

  const toggleFullscreen = useCallback(async () => {
    const next = !fullscreen;
    setFullscreen(next);
    try { if (next) await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); else await ScreenOrientation.unlockAsync(); } catch {}
  }, [fullscreen]);
  useEffect(() => () => { ScreenOrientation.unlockAsync().catch(() => {}); }, []);

  const goBack = useCallback(() => {
    try { engine.pause(); } catch {}
    if (router.canGoBack()) router.back(); else router.replace("/(tabs)");
  }, [engine, router]);

  const retryManual = () => { urlIndex.current = 0; setAttempt(0); setFatal(false); setUi("connecting"); engine.load(item); };
  const applyVolume = useCallback((v: number) => { v = Math.min(1, Math.max(0, v)); setVolume(v); engine.setVolume(v); if (v > 0 && stateRef.current.muted) { setMuted(false); engine.setMuted(false); } }, [engine]);
  const toggleMute = () => { const m = !muted; setMuted(m); engine.setMuted(m); bump(); };
  const applyBrightness = (b: number) => { b = Math.min(1, Math.max(0.05, b)); setBrightness(b); if (!isWeb) Brightness.setBrightnessAsync(b).catch(() => {}); };
  const cycleFit = () => { setFitIdx((i) => (i + 1) % FITS.length); bump(); };
  const cycleSpeed = () => { const n = (speedIdx + 1) % SPEEDS.length; setSpeedIdx(n); engine.setRate(SPEEDS[n]); bump(); };
  const togglePlay = () => { if (isPlaying) engine.pause(); else engine.play(); bump(); };

  // ---------- MX-style gestures: tap, double-tap seek, vertical swipe (brightness left / volume right), horizontal swipe seek ----------
  const gRef = useRef({ mode: "none" as "none" | "seek" | "volume" | "brightness", x0: 0, y0: 0, v0: 1, b0: 1, t0: 0, target: 0, lastTap: 0, tapTimer: null as any });
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
    onPanResponderGrant: (e) => {
      const g = gRef.current;
      g.mode = "none"; g.x0 = e.nativeEvent.pageX; g.y0 = e.nativeEvent.pageY;
      g.v0 = stateRef.current.volume; g.b0 = stateRef.current.brightness; g.t0 = stateRef.current.time.cur;
    },
    onPanResponderMove: (e, gs) => {
      const g = gRef.current;
      if (stateRef.current.locked) return;
      if (g.mode === "none") {
        if (Math.abs(gs.dx) > 14 && Math.abs(gs.dx) > Math.abs(gs.dy)) g.mode = stateRef.current.isLive ? "none" : "seek";
        else if (Math.abs(gs.dy) > 14) g.mode = g.x0 < width / 2 ? "brightness" : "volume";
        if (g.mode === "none") return;
      }
      if (g.mode === "volume") {
        const v = Math.min(1, Math.max(0, g.v0 - gs.dy / (height * 0.6)));
        applyVolume(v);
        setGesture({ kind: "volume", value: v, label: `${Math.round(v * 100)}%` });
      } else if (g.mode === "brightness") {
        const b = Math.min(1, Math.max(0.05, g.b0 - gs.dy / (height * 0.6)));
        applyBrightness(b);
        setGesture({ kind: "brightness", value: b, label: `${Math.round(b * 100)}%` });
      } else if (g.mode === "seek") {
        const dur = stateRef.current.time.dur || 0;
        const delta = (gs.dx / width) * Math.min(180, Math.max(60, dur * 0.25));
        g.target = Math.min(dur || Infinity, Math.max(0, g.t0 + delta));
        setGesture({ kind: "seek", value: dur ? g.target / dur : 0, label: `${delta >= 0 ? "+" : "-"}${fmtClock(Math.abs(delta))}  →  ${fmtClock(g.target)}` });
      }
    },
    onPanResponderRelease: (e) => {
      const g = gRef.current;
      if (g.mode === "seek") engine.seekTo(g.target);
      if (g.mode !== "none") { g.mode = "none"; setTimeout(() => setGesture(null), 400); return; }
      // tap / double tap
      const now = Date.now();
      const x = e.nativeEvent.pageX;
      if (now - g.lastTap < 300) {
        clearTimeout(g.tapTimer); g.lastTap = 0;
        if (stateRef.current.locked) return;
        if (stateRef.current.isLive) { if (stateRef.current.queueLen > 1) loadIndex(queueIndex + (x < width / 2 ? -1 : 1)); return; }
        const d = x < width / 2 ? -10 : 10;
        engine.seekBy(d);
        setFlash({ side: d < 0 ? "left" : "right", label: `${d < 0 ? "-" : "+"}10s` });
        setTimeout(() => setFlash(null), 600);
        return;
      }
      g.lastTap = now;
      g.tapTimer = setTimeout(() => {
        if (stateRef.current.locked) { setLockHint(true); setTimeout(() => setLockHint(false), 1800); return; }
        if (stateRef.current.controls) { setControls(false); clearTimeout(hideTimer.current); } else bump();
      }, 280);
    },
  }), [width, height, engine, bump, loadIndex, queueIndex, applyVolume]);

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

  const side = landscape ? Math.min(400, width * 0.42) : width;
  const busy = ui === "connecting" || ui === "loading" || ui === "buffering";
  const topPad = fullscreen || landscape ? 8 : insets.top + 8;
  const botPad = fullscreen || landscape ? 12 : insets.bottom + 12;
  const sz = big ? 1.25 : 1;
  const fit = FITS[fitIdx];
  const showControls = controls && !locked;

  return (
    <View style={styles.root} testID="player-screen">
      <StatusBar hidden={fullscreen || landscape} />
      {isWeb ? (
        <WebVideo ref={webRef} fit={fit} onStatus={(s, e) => { setStatus(s); setErrMsg(e); }} onPlaying={setIsPlaying} onTime={(c, d) => setTime({ cur: c, dur: d })} onTracks={(a, s) => { setAudioTracks(a); setSubTracks(s); }} />
      ) : (
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit={fit} nativeControls={false} allowsPictureInPicture />
      )}
      {!isWeb && brightness < 1 && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${(1 - brightness) * 0.6})` }]} />}

      {/* Gesture layer */}
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} testID="player-tap" />

      {/* Gesture indicator */}
      {gesture && (
        <View style={styles.gestureBox} pointerEvents="none" testID="player-gesture">
          <Ionicons name={gesture.kind === "volume" ? (gesture.value === 0 ? "volume-mute" : "volume-high") : gesture.kind === "brightness" ? "sunny" : "time"} size={28} color={colors.gold} />
          <Text style={styles.gestureText}>{gesture.label}</Text>
          <View style={styles.gestureTrack}><View style={[styles.gestureFill, { width: `${Math.round(gesture.value * 100)}%` }]} /></View>
        </View>
      )}
      {flash && (
        <View pointerEvents="none" style={[styles.flash, flash.side === "left" ? { left: 24 } : { right: 24 }]}>
          <Ionicons name={flash.side === "left" ? "play-back" : "play-forward"} size={30} color={colors.text} />
          <Text style={styles.flashText} numberOfLines={1}>{flash.label}</Text>
        </View>
      )}

      {/* Status */}
      {busy && !fatal && (
        <View style={styles.center} pointerEvents="none" testID="player-status">
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.stateText}>{STATE_LABEL[ui]}{attempt > 0 ? ` (tentativa ${attempt}/${MAX_RETRIES})` : ""}</Text>
        </View>
      )}
      {!busy && !fatal && !isPlaying && !controls && (
        <View style={styles.center} pointerEvents="none"><Ionicons name="play-circle" size={72} color="rgba(255,255,255,0.8)" /></View>
      )}
      {fatal && (
        <View style={styles.errorOverlay} testID="player-error">
          <Ionicons name="alert-circle" size={44} color={colors.error} />
          <Text style={styles.errorTitle}>Não foi possível reproduzir este conteúdo.</Text>
          {!!errMsg && <Text style={styles.errorHint} numberOfLines={2}>{redactUrl(String(errMsg)).slice(0, 140)}</Text>}
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Pressable testID="player-retry" onPress={retryManual} hasTVPreferredFocus style={({ focused }) => [styles.goldBtn, focused && styles.focused]}>
              <Ionicons name="refresh" size={18} color={colors.onGold} /><Text style={styles.goldBtnText}>TENTAR NOVAMENTE</Text>
            </Pressable>
            <Pressable testID="player-back-error" onPress={goBack} style={({ focused }) => [styles.outlineBtn, focused && styles.focused]}>
              <Text style={styles.outlineBtnText}>VOLTAR</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Lock */}
      {locked && (lockHint || controls) && (
        <Pressable testID="player-unlock" onPress={() => { setLocked(false); bump(); }} style={[styles.lockBtn, { top: topPad + 8 }]}>
          <Ionicons name="lock-closed" size={22} color={colors.gold} />
          <Text style={styles.lockText}>Toque para desbloquear</Text>
        </Pressable>
      )}

      {showControls && (
        <>
          <View style={[styles.topBar, { paddingTop: topPad }]}>
            <IconBtn testID="player-close" name="chevron-back" onPress={goBack} sz={sz} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {isLive && <View style={styles.liveBadge}><Text style={styles.liveText}>🔴 AO VIVO</Text></View>}
                <Text style={[styles.title, big && { fontSize: 20 }]} numberOfLines={1}>{item.title}</Text>
              </View>
              {!!item.subtitle && <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text>}
            </View>
            <Text style={styles.clock}>{clock}</Text>
            <IconBtn testID="player-fav" name={fav ? "star" : "star-outline"} color={fav ? colors.gold : colors.text} onPress={() => { toggleFav(item.favKind || item.kind, item.favId || item.id); bump(); }} sz={sz} />
            <IconBtn testID="player-info" name="information-circle-outline" onPress={() => setPanel(panel === "info" ? null : "info")} sz={sz} />
            {isLive && queue.length > 1 && <IconBtn testID="player-list" name="list" onPress={() => setPanel(panel === "channels" ? null : "channels")} sz={sz} />}
          </View>

          <View style={[styles.bottom, { paddingBottom: botPad }]}>
            {isLive ? (
              <View style={styles.epgRow}>
                <Text style={styles.epgNow} numberOfLines={1}>{now ? `AGORA  ${fmtTimeSP(now.start_timestamp)}  ${now.title}` : "Programação não disponível."}</Text>
                {next && <Text style={styles.epgNext} numberOfLines={1}>Próximo: {fmtTimeSP(next.start_timestamp)} — {next.title}</Text>}
                {now && <View style={styles.epgTrack}><View style={[styles.epgFill, { width: `${Math.max(0, Math.min(100, ((Date.now() / 1000 - now.start_timestamp) / Math.max(1, now.stop_timestamp - now.start_timestamp)) * 100))}%` }]} /></View>}
              </View>
            ) : (
              <View style={styles.seekRow}>
                <Text style={styles.time}>{fmtClock(time.cur)}</Text>
                <Pressable
                  testID="player-seekbar"
                  style={styles.seekTrack}
                  onLayout={(e) => (seekWidth.current = e.nativeEvent.layout.width || 1)}
                  onPress={(e) => { if (time.dur > 0) engine.seekTo(Math.max(0, Math.min(time.dur, (e.nativeEvent.locationX / seekWidth.current) * time.dur))); bump(); }}
                >
                  <View style={styles.seekBg} />
                  <View style={[styles.seekFill, { width: `${time.dur ? Math.min(100, (time.cur / time.dur) * 100) : 0}%` }]} />
                  <View style={[styles.seekKnob, { left: `${time.dur ? Math.min(100, (time.cur / time.dur) * 100) : 0}%` }]} />
                </Pressable>
                <Text style={styles.time}>{fmtClock(time.dur)}</Text>
              </View>
            )}

            {(() => {
              const left = (
                <>
                  <IconBtn testID="player-lock" name="lock-open-outline" onPress={() => { setLocked(true); setControls(false); setLockHint(true); setTimeout(() => setLockHint(false), 1500); }} sz={sz} />
                  <IconBtn testID="player-fit" name="scan-outline" label={FIT_LABEL[fit]} onPress={cycleFit} sz={sz} />
                  {!isLive && <IconBtn testID="player-speed" name="speedometer-outline" label={`${SPEEDS[speedIdx]}x`} onPress={cycleSpeed} sz={sz} />}
                  <IconBtn testID="player-mute" name={muted || volume === 0 ? "volume-mute" : volume < 0.5 ? "volume-low" : "volume-high"} onPress={toggleMute} sz={sz} />
                </>
              );
              const right = (
                <>
                  {!isLive && queue.length > 1 && <IconBtn testID="player-next-ep" name="play-skip-forward" label="PRÓX." onPress={() => loadIndex(queueIndex + 1)} sz={sz} />}
                  {audioTracks.length > 1 && <IconBtn testID="player-audio" name="musical-notes-outline" onPress={() => setPanel(panel === "audio" ? null : "audio")} sz={sz} />}
                  {subTracks.length > 0 && <IconBtn testID="player-subs" name="text-outline" onPress={() => setPanel(panel === "subs" ? null : "subs")} sz={sz} />}
                  <IconBtn testID="player-fullscreen" name={fullscreen ? "contract" : "expand"} onPress={toggleFullscreen} sz={sz} />
                </>
              );
              const transport = (
                <>
                  {isLive ? (
                    <IconBtn testID="player-ch-prev" name="play-skip-back" label="CH-" onPress={() => loadIndex(queueIndex - 1)} disabled={queue.length < 2} sz={sz} />
                  ) : (
                    <IconBtn testID="player-rew" name="play-back" onPress={() => { engine.seekBy(-10); bump(); }} sz={sz} />
                  )}
                  <Pressable testID="player-playpause" onPress={togglePlay} hasTVPreferredFocus style={({ focused }) => [styles.playBtn, big && { width: 72, height: 72, borderRadius: 36 }, focused && styles.focused]}>
                    <Ionicons name={isPlaying ? "pause" : "play"} size={big ? 36 : 30} color={colors.onGold} />
                  </Pressable>
                  {isLive ? (
                    <IconBtn testID="player-ch-next" name="play-skip-forward" label="CH+" onPress={() => loadIndex(queueIndex + 1)} disabled={queue.length < 2} sz={sz} />
                  ) : (
                    <IconBtn testID="player-fwd" name="play-forward" onPress={() => { engine.seekBy(10); bump(); }} sz={sz} />
                  )}
                </>
              );
              if (landscape) {
                return <View style={styles.ctrlRow}>{left}<View style={{ flex: 1 }} />{transport}<View style={{ flex: 1 }} />{right}</View>;
              }
              return (
                <>
                  <View style={[styles.ctrlRow, { justifyContent: "center" }]}>{transport}</View>
                  <View style={[styles.ctrlRow, { justifyContent: "space-between" }]}><View style={styles.ctrlRow}>{left}</View><View style={styles.ctrlRow}>{right}</View></View>
                </>
              );
            })()}
          </View>
        </>
      )}

      {panel && !locked && (
        <View style={[styles.panel, { width: side, paddingTop: topPad + 4 }]} testID={`player-panel-${panel}`}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>{panel === "channels" ? "Canais" : panel === "info" ? "Informações" : panel === "audio" ? "Áudio" : "Legendas"}</Text>
            <IconBtn testID="player-panel-close" name="close" onPress={() => setPanel(null)} />
          </View>
          {panel === "channels" && (
            <FlatList
              data={queue}
              keyExtractor={(q) => q.id}
              initialScrollIndex={Math.min(queueIndex, Math.max(0, queue.length - 1))}
              getItemLayout={(_, i) => ({ length: 64, offset: 64 * i, index: i })}
              renderItem={({ item: q, index }) => (
                <Pressable testID={`player-ch-${q.id}`} onPress={() => loadIndex(index)} hasTVPreferredFocus={index === queueIndex} style={({ focused }) => [styles.chRow, index === queueIndex && styles.chRowActive, focused && styles.focused]}>
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
              <Info label="Motor" value={isWeb ? "Navegador (hls.js)" : Platform.OS === "android" ? "Media3 / ExoPlayer" : "AVPlayer"} />
              <Info label="Formato" value={(currentUri(item) || "").split("?")[0].split(".").pop()?.toUpperCase() || "—"} />
              {!isLive && time.dur > 0 && <Info label="Duração" value={fmtClock(time.dur)} />}
              <Info label="Áudio" value={audioTracks.length ? `${audioTracks.length} faixa(s)` : "Faixa única / não informado"} />
              <Info label="Legendas" value={subTracks.length ? `${subTracks.length}` : "Não disponíveis"} />
              {isLive && (now ? <Info label="Agora" value={`${fmtTimeSP(now.start_timestamp)}–${fmtTimeSP(now.stop_timestamp)} ${now.title}`} /> : <Info label="Programação" value="Programação não disponível." />)}
              {isLive && next && <Info label="Próximo" value={`${fmtTimeSP(next.start_timestamp)} — ${next.title}`} />}
              {!!now?.description && <Text style={styles.desc} numberOfLines={6}>{now.description}</Text>}
            </View>
          )}
          {panel === "audio" && (
            <View style={{ padding: spacing.md }}>
              {audioTracks.map((t) => (
                <Pressable key={t.id} testID={`player-audio-${t.id}`} onPress={() => { engine.setAudio(t.id); setAudioSel(t.id); setPanel(null); }} style={({ focused }) => [styles.chRow, audioSel === t.id && styles.chRowActive, focused && styles.focused]}>
                  <Text style={styles.chName}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {panel === "subs" && (
            <View style={{ padding: spacing.md }}>
              <Pressable testID="player-subs-off" onPress={() => { engine.setSub(null); setSubSel(null); setPanel(null); }} style={({ focused }) => [styles.chRow, subSel == null && styles.chRowActive, focused && styles.focused]}>
                <Text style={styles.chName}>Desativadas</Text>
              </Pressable>
              {subTracks.map((t) => (
                <Pressable key={t.id} testID={`player-subs-${t.id}`} onPress={() => { engine.setSub(t.id); setSubSel(t.id); setPanel(null); }} style={({ focused }) => [styles.chRow, subSel === t.id && styles.chRowActive, focused && styles.focused]}>
                  <Text style={styles.chName}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function IconBtn({ name, onPress, testID, color, label, disabled, sz = 1 }: { name: any; onPress: () => void; testID?: string; color?: string; label?: string; disabled?: boolean; sz?: number }) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled} hitSlop={6} style={({ focused, pressed }) => [styles.iconBtn, { minWidth: 44 * sz, height: 44 * sz }, focused && styles.focused, (pressed || disabled) && { opacity: 0.5 }]}>
      <Ionicons name={name} size={22 * sz} color={color || colors.text} />
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

const ABS = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { ...ABS, alignItems: "center", justifyContent: "center", gap: spacing.md },
  stateText: { color: colors.text, fontSize: 14, fontWeight: "600", backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingBottom: spacing.md, backgroundColor: "rgba(0,0,0,0.55)" },
  title: { color: colors.text, fontSize: 16, fontWeight: "700", flexShrink: 1 },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  clock: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginHorizontal: 4 },
  liveBadge: { backgroundColor: "rgba(244,67,54,0.25)", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  liveText: { color: colors.text, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.sm, paddingTop: spacing.md, backgroundColor: "rgba(0,0,0,0.6)", gap: spacing.xs },
  epgRow: { gap: 4, paddingHorizontal: spacing.sm },
  epgNow: { color: colors.text, fontSize: 13, fontWeight: "600" },
  epgNext: { color: colors.textMuted, fontSize: 12 },
  epgTrack: { height: 3, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, marginTop: 4 },
  epgFill: { height: 3, backgroundColor: colors.gold, borderRadius: 2 },
  seekRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm },
  seekTrack: { flex: 1, height: 28, justifyContent: "center" },
  seekBg: { position: "absolute", left: 0, right: 0, height: 4, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 2 },
  seekFill: { height: 4, backgroundColor: colors.gold, borderRadius: 2 },
  seekKnob: { position: "absolute", width: 14, height: 14, borderRadius: 7, backgroundColor: colors.gold, marginLeft: -7 },
  time: { color: colors.textMuted, fontSize: 12, minWidth: 44, textAlign: "center" },
  ctrlRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  iconBtn: { paddingHorizontal: 6, borderRadius: 22, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 3 },
  iconLabel: { color: colors.text, fontSize: 10, fontWeight: "700" },
  playBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginHorizontal: spacing.sm },
  focused: { borderWidth: 2, borderColor: colors.gold, transform: [{ scale: 1.05 }] },
  gestureBox: { position: "absolute", alignSelf: "center", top: "38%", backgroundColor: "rgba(0,0,0,0.75)", borderRadius: radius.md, paddingHorizontal: 22, paddingVertical: 14, alignItems: "center", gap: 8, minWidth: 160 },
  gestureText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  gestureTrack: { width: 140, height: 4, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 2 },
  gestureFill: { height: 4, backgroundColor: colors.gold, borderRadius: 2 },
  flash: { position: "absolute", top: "42%", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10, maxWidth: 220 },
  flashText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  lockBtn: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: radius.pill, paddingHorizontal: 16, height: 44, borderWidth: 1, borderColor: colors.gold },
  lockText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  errorOverlay: { ...ABS, alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: "rgba(0,0,0,0.88)", padding: spacing.xl },
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
  infoLabel: { color: colors.textDim, fontSize: 12, width: 100, textTransform: "uppercase", letterSpacing: 0.4 },
  infoValue: { color: colors.text, fontSize: 13, flex: 1 },
  desc: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
});
