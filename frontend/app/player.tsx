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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, spacing } from "../src/utils/theme";
import { PlayItem, useSession } from "../src/store/session";
import { EpgEntry, redactUrl, xtream } from "../src/services/xtream";
import { EngineStatus, TrackInfo, WebVideo, WebVideoHandle } from "../src/components/WebVideo";

const MAX_RETRIES = 3, TIMEOUT = 4500, SPEEDS = [1, 1.25, 1.5, 2, 0.5];
const FITS = ["contain", "cover", "fill"] as const;
const AUDIO_PRESETS = [
  { id: "original", label: "Original", icon: "pulse-outline" },
  { id: "clarity", label: "Voz Nítida", icon: "mic-outline" },
  { id: "movie", label: "Cinema", icon: "film-outline" },
  { id: "bass", label: "Reforço Graves", icon: "hardware-chip-outline" },
];
const SLEEP_OPTS = [0, 15, 30, 45, 60];

// Assinatura padrão aceita de primeira por todos os balanceadores Xtream Codes
const UA = "IPTVSmartersPlayer";
const isWeb = Platform.OS === "web";

const STATE_LABEL: Record<string, string> = {
  connecting: "Conectando...",
  loading: "Carregando...",
  buffering: "Buffering...",
  playing: "Reproduzindo",
  paused: "Pausado",
  error: "Falha na reprodução.",
};

function fmt(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return (h ? `${h}:` : "") + `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getClock() {
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

  const [status, setStatus] = useState<EngineStatus>("loading");
  const [errMsg, setErrMsg] = useState<string | undefined>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState({ cur: 0, dur: 0 });
  const [audioTracks, setAudioTracks] = useState<TrackInfo[]>([]);

  const [ui, setUi] = useState("connecting");
  const [attempt, setAttempt] = useState(0);
  const [fatal, setFatal] = useState(false);
  const [controls, setControls] = useState(true);
  const [locked, setLocked] = useState(false);
  const [panel, setPanel] = useState<null | "channels" | "audio" | "audioEffects" | "sleepTimer">(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fitIdx, setFitIdx] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [brightness, setBrightness] = useState(1);
  const [gesture, setGesture] = useState<null | { kind: string; value: number; label: string }>(null);
  const [flash, setFlash] = useState<null | { side: "left" | "right"; label: string }>(null);
  const [clock, setClock] = useState(getClock());
  const [audioOnly, setAudioOnly] = useState(false);
  const [audioPreset, setAudioPreset] = useState("original");
  const [sleepMin, setSleepMin] = useState(0);
  const [sleepSec, setSleepSec] = useState(0);

  const urlIndex = useRef(0);
  const retryTimer = useRef<any>(null);
  const hideTimer = useRef<any>(null);
  const lastSaved = useRef(0);
  const resumedRef = useRef<string | null>(null);
  const webRef = useRef<WebVideoHandle>(null);
  const seekWidth = useRef(1);
  const stateRef = useRef({ volume: 1, brightness: 1, time: { cur: 0, dur: 0 }, isLive: false, locked: false, controls: true, queueLen: 0, muted: false });
  stateRef.current = { volume, brightness, time, isLive, locked, controls, queueLen: queue.length, muted };

  const currentUri = useCallback((it: PlayItem | undefined) => (it?.urls.length ? it.urls[urlIndex.current % it.urls.length] : null), []);

  const makeSource = useCallback((it: PlayItem | undefined): VideoSource => {
    const uri = currentUri(it);
    return uri
      ? {
          uri,
          headers: {
            "User-Agent": UA,
            Accept: "*/*",
            Connection: "keep-alive",
          },
          metadata: { title: it!.title, artist: it!.subtitle },
        }
      : null;
  }, [currentUri]);

  // Configuração ExoPlayer com buffer otimizado estilo Just Player
  const player = useVideoPlayer(isWeb ? null : makeSource(item), (p) => {
    p.timeUpdateEventInterval = 1;
    p.staysActiveInBackground = true;
    p.showNowPlayingNotification = true;
    try {
      (p as any).bufferOptions = {
        preferredForwardBufferDuration: isLive ? 2 : 8,
        minBufferForPlayback: 0.5,
      };
    } catch {}
    if (prefs.autoplay) p.play();
  });

  useEventListener(player, "statusChange", ({ status: s, error }) => {
    if (!isWeb) {
      setStatus(s === "idle" ? "loading" : (s as EngineStatus));
      setErrMsg(error?.message);
    }
  });

  useEventListener(player, "playingChange", ({ isPlaying: p }) => {
    if (!isWeb) setIsPlaying(p);
  });

  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    if (!isWeb) setTime({ cur: currentTime, dur: player.duration || 0 });
  });

  useEventListener(player, "availableAudioTracksChange", ({ availableAudioTracks }) =>
    setAudioTracks(
      (availableAudioTracks || []).map((t, i) => ({
        id: t.id || String(i),
        label: t.label || t.name || t.language || `Faixa ${i + 1}`,
        language: t.language,
      }))
    )
  );

  const engine = useMemo(() => ({
    load: (it: PlayItem | undefined) => {
      const src = makeSource(it);
      if (!src) return;
      if (isWeb) {
        const uri = currentUri(it);
        if (uri) webRef.current?.load(uri);
      } else {
        player
          .replaceAsync(src)
          .then(() => {
            if (prefs.autoplay) player.play();
          })
          .catch(() => {
            if (it && it.urls.length > 1) {
              urlIndex.current += 1;
              player.replaceAsync(makeSource(it)).then(() => player.play()).catch(() => {});
            }
          });
      }
    },
    play: () => (isWeb ? webRef.current?.play() : player.play()),
    pause: () => (isWeb ? webRef.current?.pause() : player.pause()),
    seekTo: (s: number) => { if (isWeb) webRef.current?.seekTo(s); else player.currentTime = s; },
    seekBy: (s: number) => (isWeb ? webRef.current?.seekBy(s) : player.seekBy(s)),
    setVolume: (v: number) => { if (isWeb) webRef.current?.setVolume(v); else player.volume = v; },
    setMuted: (m: boolean) => { if (isWeb) webRef.current?.setMuted(m); else player.muted = m; },
    setRate: (r: number) => { if (isWeb) webRef.current?.setRate(r); else player.playbackRate = r; },
    setAudio: (id: string | null) => {
      if (isWeb) webRef.current?.setAudioTrack(id);
      else player.audioTrack = player.availableAudioTracks.find((t, i) => (t.id || String(i)) === id) || null;
    },
  }), [player, makeSource, currentUri, prefs.autoplay]);

  useEffect(() => {
    if (sleepMin <= 0) { setSleepSec(0); return; }
    setSleepSec(sleepMin * 60);
    const id = setInterval(() => {
      setSleepSec((p) => {
        if (p <= 1) { clearInterval(id); setSleepMin(0); engine.pause(); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [sleepMin, engine]);

  useEffect(() => {
    if (!item) return;
    if (status === "error") {
      if (prefs.autoReconnect && attempt < MAX_RETRIES) {
        setUi("connecting");
        clearTimeout(retryTimer.current);
        // Na primeira tentativa, reconecta imediatamente (250ms) sem travar a tela
        const retryDelay = attempt === 0 ? 250 : 1200;
        retryTimer.current = setTimeout(() => {
          urlIndex.current += 1;
          setAttempt((a) => a + 1);
          engine.load(item);
        }, retryDelay);
      } else {
        setUi("error");
        setFatal(true);
      }
      return;
    }
    if (status === "loading") setUi((u) => (u === "playing" || u === "paused" ? "buffering" : "loading"));
    else if (status === "readyToPlay") setUi(isPlaying ? "playing" : "paused");
  }, [status, isPlaying, attempt, item?.id, prefs.autoReconnect, engine, item]);

  useEffect(() => {
    if (isLive || !item?.progressKey || time.dur <= 0 || Date.now() - lastSaved.current < 5000) return;
    lastSaved.current = Date.now();
    saveProgress(item.progressKey, { position: time.cur, duration: time.dur, title: item.title, logo: item.logo, item });
  }, [time.cur, isLive, item, time.dur, saveProgress]);

  useEffect(() => {
    if (!item || isLive || status !== "readyToPlay" || resumedRef.current === item.id) return;
    resumedRef.current = item.id;
    const p = item.progressKey ? progressMap[item.progressKey] : undefined;
    if (p && p.duration > 0 && p.position > 10 && p.position < p.duration - 15) engine.seekTo(p.position);
  }, [status, item, isLive, progressMap, engine]);

  useEffect(() => {
    if (!item) return;
    addRecent(item.kind, item.raw ?? { id: item.id, name: item.title, stream_icon: item.logo });
  }, [item, addRecent]);

  const loadIndex = useCallback((idx: number) => {
    if (!queue.length) return;
    const n = ((idx % queue.length) + queue.length) % queue.length;
    const it = queue[n];
    setQueueIndex(n);
    urlIndex.current = 0;
    setAttempt(0);
    setFatal(false);
    setUi("connecting");
    setPanel(null);
    lastSaved.current = 0;
    resumedRef.current = null;
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

  useEffect(() => {
    const t = setInterval(() => setClock(getClock()), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isWeb) Brightness.getBrightnessAsync().then((b) => setBrightness(b)).catch(() => {});
  }, []);

  const bump = useCallback(() => {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), TIMEOUT);
  }, []);

  useEffect(() => {
    bump();
    return () => clearTimeout(hideTimer.current);
  }, [bump]);

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
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, [engine, router]);

  const applyVolume = useCallback((v: number) => {
    v = Math.min(1, Math.max(0, v));
    setVolume(v);
    engine.setVolume(v);
    if (v > 0 && stateRef.current.muted) {
      setMuted(false);
      engine.setMuted(false);
    }
  }, [engine]);

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    engine.setMuted(m);
    bump();
  };

  const applyBrightness = (b: number) => {
    b = Math.min(1, Math.max(0.05, b));
    setBrightness(b);
    if (!isWeb) Brightness.setBrightnessAsync(b).catch(() => {});
  };

  const cycleFit = () => { setFitIdx((i) => (i + 1) % FITS.length); bump(); };
  const cycleSpeed = () => { const n = (speedIdx + 1) % SPEEDS.length; setSpeedIdx(n); engine.setRate(SPEEDS[n]); bump(); };
  const togglePlay = () => { if (isPlaying) engine.pause(); else engine.play(); bump(); };

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
        setGesture({ kind: "seek", value: dur ? g.target / dur : 0, label: `${delta >= 0 ? "+" : "-"}${fmt(Math.abs(delta))} → ${fmt(g.target)}` });
      }
    },
    onPanResponderRelease: (e) => {
      const g = gRef.current;
      if (g.mode === "seek") engine.seekTo(g.target);
      if (g.mode !== "none") { g.mode = "none"; setTimeout(() => setGesture(null), 400); return; }
      const now = Date.now(), x = e.nativeEvent.pageX;
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
      {isWeb ? (
        <WebVideo ref={webRef} fit={fit} onStatus={(s, e) => { setStatus(s); setErrMsg(e); }} onPlaying={setIsPlaying} onTime={(c, d) => setTime({ cur: c, dur: d })} onTracks={(a) => setAudioTracks(a)} />
      ) : (
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit={fit} nativeControls={false} allowsPictureInPicture />
      )}
      {!isWeb && brightness < 1 && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${(1 - brightness) * 0.6})` }]} />}

      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />

      {audioOnly && (
        <Pressable style={styles.audioOnlyScreen} onPress={() => setAudioOnly(false)}>
          <Ionicons name="headset" size={60} color={colors.gold} />
          <Text style={styles.audioOnlyTitle}>Modo Somente Áudio Ativo</Text>
          <Text style={styles.audioOnlySub} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.audioOnlyHint}>Toque em qualquer lugar para reativar o vídeo</Text>
        </Pressable>
      )}

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

      {busy && !fatal && (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.stateText}>{STATE_LABEL[ui]}{attempt > 0 ? ` (${attempt}/${MAX_RETRIES})` : ""}</Text>
        </View>
      )}

      {locked && (
        <Pressable style={[styles.unlockBtn, { top: insets.top + 20 }]} onPress={() => { setLocked(false); bump(); }}>
          <Ionicons name="lock-open" size={20} color={colors.gold} />
          <Text style={styles.unlockBtnText}>DESBLOQUEAR TELA</Text>
        </Pressable>
      )}

      {controls && !locked && (
        <View style={styles.controlsOverlay} pointerEvents="box-none">
          <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
            <Pressable onPress={goBack} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.topTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.topSub}>{isLive ? "TV AO VIVO" : fmt(time.cur)} • {clock}{sleepSec > 0 ? ` • ⏱ ${Math.ceil(sleepSec / 60)}m` : ""}</Text>
            </View>
            <View style={styles.mxToolsRow}>
              <Pressable onPress={() => { setPanel("audioEffects"); bump(); }} style={styles.toolBtn}>
                <Ionicons name="pulse" size={18} color={audioPreset !== "original" ? colors.gold : colors.text} />
              </Pressable>
              <Pressable onPress={cycleSpeed} style={styles.toolBtn}>
                <Text style={styles.speedText}>{SPEEDS[speedIdx]}x</Text>
              </Pressable>
              <Pressable onPress={() => setAudioOnly(true)} style={styles.toolBtn}>
                <Ionicons name="headset-outline" size={18} color={colors.text} />
              </Pressable>
              <Pressable onPress={toggleMute} style={styles.toolBtn}>
                <Ionicons name={muted ? "volume-mute" : "volume-medium"} size={18} color={muted ? colors.gold : colors.text} />
              </Pressable>
              <Pressable onPress={() => { setPanel("sleepTimer"); bump(); }} style={styles.toolBtn}>
                <Ionicons name="timer-outline" size={18} color={sleepSec > 0 ? colors.gold : colors.text} />
              </Pressable>
              <Pressable onPress={cycleFit} style={styles.toolBtn}>
                <Ionicons name="scan-outline" size={18} color={colors.text} />
              </Pressable>
              <Pressable onPress={() => { setLocked(true); setControls(false); }} style={styles.toolBtn}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.gold} />
              </Pressable>
            </View>
          </View>

          <View style={styles.centerPlayBox}>
            {!isLive && (
              <Pressable onPress={() => { engine.seekBy(-10); bump(); }} style={styles.skipBtn}>
                <Ionicons name="play-back" size={24} color={colors.text} />
              </Pressable>
            )}
            <Pressable onPress={togglePlay} style={styles.bigPlayBtn}>
              <Ionicons name={isPlaying ? "pause" : "play"} size={36} color={colors.onGold} />
            </Pressable>
            {!isLive && (
              <Pressable onPress={() => { engine.seekBy(10); bump(); }} style={styles.skipBtn}>
                <Ionicons name="play-forward" size={24} color={colors.text} />
              </Pressable>
            )}
          </View>

          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
            {!isLive && (
              <View style={styles.progressRow}>
                <Text style={styles.timeText}>{fmt(time.cur)}</Text>
                <Pressable
                  style={styles.seekTrack}
                  onLayout={(e) => { seekWidth.current = e.nativeEvent.layout.width; }}
                  onPress={(e) => {
                    if (time.dur <= 0) return;
                    const r = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekWidth.current));
                    engine.seekTo(r * time.dur);
                    bump();
                  }}
                >
                  <View style={[styles.seekFill, { width: `${time.dur ? (time.cur / time.dur) * 100 : 0}%` }]} />
                </Pressable>
                <Text style={styles.timeText}>{fmt(time.dur)}</Text>
              </View>
            )}

            <View style={styles.bottomActions}>
              <View style={styles.row}>
                {isLive && queue.length > 1 && (
                  <Pressable onPress={() => loadIndex(queueIndex - 1)} style={styles.actionBtn}>
                    <Ionicons name="play-skip-back" size={18} color={colors.text} />
                    <Text style={styles.actionLabel}>Anterior</Text>
                  </Pressable>
                )}
                {isLive && queue.length > 1 && (
                  <Pressable onPress={() => loadIndex(queueIndex + 1)} style={styles.actionBtn}>
                    <Ionicons name="play-skip-forward" size={18} color={colors.text} />
                    <Text style={styles.actionLabel}>Seguinte</Text>
                  </Pressable>
                )}
                {isLive && (
                  <Pressable onPress={() => { setPanel("channels"); bump(); }} style={styles.actionBtn}>
                    <Ionicons name="list" size={18} color={colors.gold} />
                    <Text style={styles.actionLabel}>Canais</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => item && toggleFav(item.favKind || item.kind, item.favId || item.id, item.raw)} style={styles.actionBtn}>
                  <Ionicons name={fav ? "star" : "star-outline"} size={18} color={fav ? colors.gold : colors.text} />
                  <Text style={styles.actionLabel}>Favorito</Text>
                </Pressable>
              </View>

              <View style={styles.row}>
                <Pressable onPress={() => { setPanel("audio"); bump(); }} style={styles.actionBtn}>
                  <Ionicons name="volume-high-outline" size={18} color={colors.text} />
                  <Text style={styles.actionLabel}>Áudio</Text>
                </Pressable>
                <Pressable onPress={toggleFullscreen} style={styles.actionBtn}>
                  <Ionicons name={fullscreen ? "contract" : "expand"} size={18} color={colors.text} />
                  <Text style={styles.actionLabel}>{fullscreen ? "Sair" : "Girar"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}

      <Modal visible={panel === "audioEffects"} transparent animationType="fade" onRequestClose={() => setPanel(null)}>
        <Pressable style={styles.modalBg} onPress={() => setPanel(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Efeito de Áudio</Text>
            {AUDIO_PRESETS.map((p) => (
              <Pressable key={p.id} onPress={() => { setAudioPreset(p.id); setPanel(null); bump(); }} style={[styles.modalItem, audioPreset === p.id && styles.modalItemActive]}>
                <Ionicons name={p.icon as any} size={20} color={audioPreset === p.id ? colors.gold : colors.text} />
                <Text style={[styles.modalItemText, audioPreset === p.id && { color: colors.gold }]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={panel === "sleepTimer"} transparent animationType="fade" onRequestClose={() => setPanel(null)}>
        <Pressable style={styles.modalBg} onPress={() => setPanel(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Temporizador (Sleep Timer)</Text>
            {SLEEP_OPTS.map((m) => (
              <Pressable key={m} onPress={() => { setSleepMin(m); setPanel(null); bump(); }} style={[styles.modalItem, sleepMin === m && styles.modalItemActive]}>
                <Ionicons name="time-outline" size={20} color={sleepMin === m ? colors.gold : colors.text} />
                <Text style={[styles.modalItemText, sleepMin === m && { color: colors.gold }]}>{m === 0 ? "Desativado" : `${m} minutos`}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={panel === "channels"} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
        <Pressable style={styles.modalBg} onPress={() => setPanel(null)}>
          <View style={[styles.channelsSideSheet, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}>
            <Text style={styles.modalTitle}>Grelha de Canais</Text>
            <FlatList
              data={queue}
              keyExtractor={(it, idx) => `${it.id}-${idx}`}
              renderItem={({ item: qIt, index: qIdx }) => (
                <Pressable onPress={() => { loadIndex(qIdx); setPanel(null); }} style={[styles.channelRow, qIdx === queueIndex && styles.channelRowActive]}>
                  <Text style={[styles.channelNum, qIdx === queueIndex && { color: colors.gold }]}>{String(qIdx + 1).padStart(2, "0")}</Text>
                  <Text style={[styles.channelTitle, qIdx === queueIndex && { color: colors.gold, fontWeight: "800" }]} numberOfLines={1}>{qIt.title}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      <Modal visible={panel === "audio"} transparent animationType="fade" onRequestClose={() => setPanel(null)}>
        <Pressable style={styles.modalBg} onPress={() => setPanel(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Faixas de Áudio</Text>
            {audioTracks.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", paddingVertical: 10 }}>Áudio padrão da transmissão</Text>
            ) : (
              audioTracks.map((t) => (
                <Pressable key={t.id} onPress={() => { engine.setAudio(t.id); setPanel(null); }} style={styles.modalItem}>
                  <Text style={styles.modalItemText}>{t.label}</Text>
                </Pressable>
              ))
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 10 },
  centerRoot: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: 12 },
  infoTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  stateText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  controlsOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.38)" },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10 },
  topTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  topSub: { color: colors.gold, fontSize: 11, fontWeight: "700", marginTop: 1 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  mxToolsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  toolBtn: { padding: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", minWidth: 32, height: 32 },
  speedText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  centerPlayBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28 },
  skipBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  bigPlayBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  bottomBar: { paddingHorizontal: 16, gap: 8 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  seekTrack: { flex: 1, height: 18, justifyContent: "center" },
  seekFill: { height: 4, backgroundColor: colors.gold, borderRadius: 2 },
  timeText: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  bottomActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4 },
  actionLabel: { color: colors.text, fontSize: 12, fontWeight: "600" },
  unlockBtn: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.85)", borderWidth: 1, borderColor: colors.gold, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  unlockBtnText: { color: colors.gold, fontSize: 11, fontWeight: "800" },
  audioOnlyScreen: { ...StyleSheet.absoluteFillObject, backgroundColor: "#090A0E", alignItems: "center", justifyContent: "center", gap: 10, padding: 24, zIndex: 10 },
  audioOnlyTitle: { color: colors.gold, fontSize: 18, fontWeight: "800" },
  audioOnlySub: { color: colors.text, fontSize: 14, fontWeight: "600" },
  audioOnlyHint: { color: colors.textMuted, fontSize: 12 },
  gestureBox: { position: "absolute", top: "42%", alignSelf: "center", backgroundColor: "rgba(0,0,0,0.8)", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, alignItems: "center", gap: 6, minWidth: 120 },
  gestureText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  gestureTrack: { width: 80, height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2 },
  gestureFill: { height: "100%", backgroundColor: colors.gold },
  flash: { position: "absolute", top: "44%", backgroundColor: "rgba(0,0,0,0.75)", padding: 12, borderRadius: 10, alignItems: "center", gap: 4 },
  flashText: { color: colors.text, fontSize: 11, fontWeight: "700" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalSheet: { width: "100%", maxWidth: 320, backgroundColor: "#151722", borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 8 },
  modalTitle: { color: colors.gold, fontSize: 14, fontWeight: "800", marginBottom: 6 },
  modalItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.04)" },
  modalItemActive: { backgroundColor: "rgba(229,169,59,0.18)", borderWidth: 1, borderColor: colors.gold },
  modalItemText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  channelsSideSheet: { position: "absolute", right: 0, top: 0, bottom: 0, width: 280, backgroundColor: "#151722", padding: 16, borderLeftWidth: 1, borderLeftColor: colors.border },
  channelRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  channelRowActive: { backgroundColor: "rgba(229,169,59,0.12)", borderRadius: 8, paddingHorizontal: 8 },
  channelNum: { color: colors.textMuted, fontSize: 12, fontWeight: "700", width: 24 },
  channelTitle: { color: colors.text, fontSize: 13, fontWeight: "600", flex: 1 },
  outlineBtn: { borderWidth: 1, borderColor: colors.gold, paddingVertical: 8, paddingHorizontal: 18, borderRadius: 8 },
  outlineBtnText: { color: colors.gold, fontSize: 12, fontWeight: "700" },
});
