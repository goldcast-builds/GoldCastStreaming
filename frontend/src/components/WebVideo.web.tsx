/* Web-only video engine: <video> + hls.js so the preview can really play HLS/M3U8 and MP4. */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
// @ts-ignore — react-native-web ships no types
import { unstable_createElement } from "react-native-web";
import Hls from "hls.js";
import type { WebVideoHandle, WebVideoProps } from "./WebVideo";

export const WebVideo = forwardRef<WebVideoHandle, WebVideoProps>(function WebVideo({ fit, onStatus, onPlaying, onTime, onTracks }, ref) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const destroy = () => { try { hlsRef.current?.destroy(); } catch {} hlsRef.current = null; };

  useImperativeHandle(ref, () => ({
    load(uri: string) {
      const v = videoRef.current; if (!v) return;
      destroy();
      onStatus("loading");
      const isHls = /\.m3u8(\?|$)/i.test(uri);
      if (isHls && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 30 });
        hlsRef.current = hls;
        hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) onStatus("error", data.details || "HLS error"); });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          onTracks(
            hls.audioTracks.map((t, i) => ({ id: String(i), label: t.name || t.lang || `Faixa ${i + 1}`, language: t.lang || "" })),
            hls.subtitleTracks.map((t, i) => ({ id: String(i), label: t.name || t.lang || `Legenda ${i + 1}`, language: t.lang || "" })),
          );
          v.play().catch(() => {});
        });
        hls.loadSource(uri);
        hls.attachMedia(v);
      } else {
        v.src = uri;
        v.load();
        v.play().catch(() => {});
      }
    },
    play() { videoRef.current?.play().catch(() => {}); },
    pause() { videoRef.current?.pause(); },
    seekTo(sec: number) { if (videoRef.current) videoRef.current.currentTime = sec; },
    seekBy(sec: number) { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + sec); },
    setVolume(v: number) { if (videoRef.current) videoRef.current.volume = v; },
    setMuted(m: boolean) { if (videoRef.current) videoRef.current.muted = m; },
    setRate(r: number) { if (videoRef.current) videoRef.current.playbackRate = r; },
    setAudioTrack(id: string | null) { if (hlsRef.current && id != null) hlsRef.current.audioTrack = Number(id); },
    setSubtitleTrack(id: string | null) { if (hlsRef.current) hlsRef.current.subtitleTrack = id == null ? -1 : Number(id); },
  }));

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onWaiting = () => onStatus("loading");
    const onCanPlay = () => onStatus("readyToPlay");
    const onPlay = () => { onStatus("readyToPlay"); onPlaying(true); };
    const onPause = () => onPlaying(false);
    const onErr = () => onStatus("error", v.error?.message || "MEDIA_ELEMENT_ERROR");
    const onT = () => onTime(v.currentTime || 0, isFinite(v.duration) ? v.duration : 0);
    v.addEventListener("waiting", onWaiting); v.addEventListener("loadstart", onWaiting);
    v.addEventListener("canplay", onCanPlay); v.addEventListener("playing", onPlay);
    v.addEventListener("pause", onPause); v.addEventListener("error", onErr); v.addEventListener("timeupdate", onT);
    return () => {
      v.removeEventListener("waiting", onWaiting); v.removeEventListener("loadstart", onWaiting);
      v.removeEventListener("canplay", onCanPlay); v.removeEventListener("playing", onPlay);
      v.removeEventListener("pause", onPause); v.removeEventListener("error", onErr); v.removeEventListener("timeupdate", onT);
      destroy();
    };
  }, []);

  return unstable_createElement("video", {
    ref: videoRef,
    playsInline: true,
    autoPlay: true,
    controls: false,
    style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: fit === "cover" ? "cover" : fit === "fill" ? "fill" : "contain", backgroundColor: "#000" },
  });
});
