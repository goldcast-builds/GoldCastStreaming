import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  AppState,
  Platform,
  useWindowDimensions,
  StatusBar,
  PanResponder,
  Modal,
} from "react-native";
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
const AUDIO_PRESETS = [
  { id: "original", label: "Original", icon: "pulse-outline" },
  { id: "clarity", label: "Voz Nítida", icon: "mic-outline" },
  { id: "movie", label: "Cinema", icon: "film-outline" },
  { id: "bass", label: "Reforço Graves", icon: "hardware-chip-outline" },
];
const SLEEP_OPTIONS = [0, 15, 30, 45, 60];
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
  const isFav = useSession((s) => s.isFav);
  const toggleFav = useSession((s) => s.toggleFav);
  const addRecent = useSession((s) => s.addRecent);
  const saveProgress = useSession((s) => s.saveProgress);
  const progressMap = useSession((s) => s.ud.progress);

  const item: PlayItem | undefined = queue[queueIndex];
  const isLive = item?.kind === "live";

  // Engine state
  const [status, setStatus] = useState<EngineStatus>("loading");
  const [errMsg, setErrMsg] = useState<string | undefined>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState({ cur: 0, dur: 0 });
  const [audioTracks, setAudioTracks] = useState<TrackInfo[]>([]);
  const [subTracks, setSubTracks] = useState<TrackInfo[]>([]);

  // UI & MX Tools state
  const [ui, setUi] = useState<UiState>("connecting");
  const [attempt, setAttempt] = useState(0);
  const [fatal, setFatal] = useState(false);
  const [controls, setControls] = useState(true);
  const [locked, setLocked] = useState(false);
  const [panel, setPanel] = useState<null | "channels" | "info" | "audio" | "subs" | "audioEffects" | "sleepTimer">(null);
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

  // Novas ferramentas MX Player
  const [audioOnly, setAudioOnly] = useState(false);
  const [audioPreset, setAudioPreset] = useState("original");
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [sleepRemaining, setSleepRemaining] = useState(0);

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

  const player = useVideoPlayer(isWeb ? null : makeSource(item), (p) => {
    p.timeUpdateEventInterval = 1;
    p.staysActiveInBackground = true;
    p.showNowPlayingNotification = true;
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

  // Contagem regressiva do Sleep Timer
  useEffect(() => {
    if (sleepMinutes <= 0) { setSleepRemaining(0); return; }
    setSleepRemaining(sleepMinutes * 60);
    const interval = setInterval(() => {
      setSleepRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setSleepMinutes(0);
          engine.pause();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepMinutes, engine]);

  useEffect(() => {
    if (!item) return;
    if (status === "error") {
      if (prefs.autoReconnect && attempt < MAX_RETRIES) {
        setUi("connecting");
        clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => {
          urlIndex.current += 1;
          setAttempt((a) => a + 1);
          engine.load(item);
        }, 1500);
      } else { setUi("error"); setFatal(true); }
      return;
    }
    if (status === "loading") setUi((u) => (u === "playing" || u === "paused" ? "buffering" : "loading"));
    else if (status === "readyToPlay") setUi(isPlaying ? "playing" : "paused");
  }, [status, isPlaying, attempt, item?.id]);

  useEffect(() => {
    if (isLive || !item?.progressKey || time.dur <= 0 || Date.now() - lastSaved.current < 5000) return;
    lastSaved.current = Date.now();
    saveProgress(item.progressKey, { position: time.cur, duration: time.dur, title: item.title, logo: item.logo, item });
  }, [time.cur]);

  useEffect(() => {
    if (!item || isLive || status !== "readyToPlay" || resumedRef.current === item.id) return;
    resumedRef.current = item.id;
    const p = item.progressKey ? progressMap[item.progressKey] : undefined;
    if (p && p.duration > 0 && p.position > 10 && p.position < p.duration - 15) engine.seekTo(p.position);
  }, [status, item?.id]);

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
    setAttempt(0); setFatal(false); setUi("connecting"); setEpg([]); setPanel(null);
    lastSaved.current = 0; resumedRef.current = null;
    setFlash({ side: idx > queueIndex ? "right" : "left", label: it.title });
    setTimeout(() => setFlash(null), 900);
    engine.load(it);
  }, [queue, queueIndex, engine, setQueueIndex]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if ((st === "background" || st === "inactive") && !audioOnly) engine.pause();
      else if (st === "active" && !fatal && !audioOnly) engine.play();
    });
    return () => sub.remove();
  }, [engine, fatal, audioOnly]);

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
    try {
      if (next) await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      else await ScreenOrientation.unlockAsync();
    } catch {}
  }, [fullscreen]);

  const goBack = useCallback(() => {
    try { engine.pause(); } catch {}
    if (router.canGoBack()) router.back(); else router.replace("/(tabs)");
  }, [engine, router]);

  const applyVolume = useCallback((v: number) => {
    v = Math.min(1, Math.max(0, v));
    setVolume(v);
    engine.setVolume(v);
    if (v > 0 && stateRef.current.muted) { setMuted(false); engine.setMuted(false); }
  }, [engine]);

  const toggleMute = () => { const m = !muted; setMuted(m); engine.setMuted(m); bump(); };
  const applyBrightness = (b: number) => {
    b = Math.min(1, Math.max(0.05, b));
    setBrightness(b);
    if (!isWeb) Brightness.setBrightnessAsync(b).catch(() => {});
  };

  const cycleFit = () => { setFitIdx((i) => (i + 1) % FITS.length); bump(); };
  const cycleSpeed = () => { const n = (speedIdx + 1) % SPEEDS.length; setSpeedIdx(n); engine.setRate(SPEEDS[n]); bump(); };
  const togglePlay = () => { if (isPlaying) engine.pause(); else engine.play(); bump(); };

  // Gestos MX Player
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
        setGesture({ kind: "seek", value: dur ? g.target / dur : 0, label: `${delta >= 0 ? "+" : "-"}${fmtClock(Math.abs(delta))} → ${fmtClock(g.target)}` });
      }
    },
    onPanResponderRelease: (e) => {
      const g = gRef.current;
      if (g.mode === "seek") engine.seekTo(g.target);
      if (g.mode !== "none") { g.mode = "none"; setTimeout(() => setGesture(null), 400); return; }
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
        if (stateRef.current.locked) return;
        if (stateRef.current.controls) { setControls(false); clearTimeout(hideTimer.current); } else bump();
      }, 280);
    },
  }), [width, height, engine, bump, loadIndex, queueIndex, applyVolume]);

  const fit = FITS[fitIdx];
  const busy = ui === "connecting" || ui === "loading" || ui === "buffering";
  const fav = item ? isFav(item.favKind || item.kind, item.favId || item.id) : false;

  if (!item) {
    return (
      <View style={styles.centerRoot}>
        <Text style={styles.infoTitle}>Nenhum conteúdo selecionado.</Text>
        <Pressable onPress={goBack} style={styles.outlineBtn}><Text style={styles.outlineBtnText}>VOLTAR</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar hidden={fullscreen || landscape} />
      
      {/* Vídeo Nativo / Web */}
      {isWeb ? (
        <WebVideo ref={webRef} fit={fit} onStatus={(s, e) => { setStatus(s); setErrMsg(e); }} onPlaying={setIsPlaying} onTime={(c, d) => setTime({ cur: c, dur: d })} onTracks={(a, s) => { setAudioTracks(a); setSubTracks(s); }} />
      ) : (
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit={fit} nativeControls={false} allowsPictureInPicture />
      )}
      {!isWeb && brightness < 1 && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${(1 - brightness) * 0.6})` }]} />}

      {/* Camada de Gestos */}
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />

      {/* Overlay Somente Áudio */}
      {audioOnly && (
        <Pressable style={styles.audioOnlyScreen} onPress={() => setAudioOnly(false)}>
          <Ionicons name="headset" size={60} color={colors.gold} />
          <Text style={styles.audioOnlyTitle}>Modo Somente Áudio Ativo</Text>
          <Text style={styles.audioOnlySub} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.audioOnlyHint}>Toque em qualquer lugar para reativar a imagem</Text>
        </Pressable>
      )}

      {/* Indicadores de Gesto na Tela */}
      {gesture && (
        <View style={styles.gestureBox} pointerEvents="none">
          <Ionicons name={gesture.kind === "volume" ? (gesture.value === 0 ? "volume-mute" : "volume-high") : gesture.kind === "brightness" ? "sunny" : "time"} size={26} color={colors.gold} />
          <Text style={styles.gestureText}>{gesture.label}</Text>
          <View style={styles.gestureTrack}><View style={[styles.gestureFill, { width: `${Math.round(gesture.value * 100)}%` }]} /></View>
        </View>
      )}
      {flash && (
        <View pointerEvents="none" style={[styles.flash, flash.side === "left" ? { left: 24 } : { right: 24 }]}>
          <Ionicons name={flash.side === "left" ? "play-back" : "play-forward"} size={28} color={colors.text} />
          <Text style={styles.flashText} numberOfLines={1}>{flash.label}</Text>
        </View>
      )}

      {/* Spinner de Carregamento */}
      {busy && !fatal && (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.stateText}>{STATE_LABEL[ui]}{attempt > 0 ? ` (${attempt}/${MAX_RETRIES})` : ""}</Text>
        </View>
      )}

      {/* Botão de Desbloqueio Flutuante quando a Tela está Bloqueada */}
      {locked && (
        <Pressable style={[styles.unlockBtn, { top: insets.top + 20 }]} onPress={() => { setLocked(false); bump(); }}>
          <Ionicons name="lock-open" size={20} color={colors.gold} />
          <Text style={styles.unlockBtnText}>DESBLOQUEAR TELA</Text>
        </Pressable>
      )}

      {/* CONTROLOS COMPLETOS */}
      {controls && !locked && (
        <View style={styles.controlsOverlay} pointerEvents="box-none">
          
          {/* BARRA SUPERIOR MX PLAYER */}
          <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
            <Pressable onPress={goBack} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
            <View style={styles.topInfo}
