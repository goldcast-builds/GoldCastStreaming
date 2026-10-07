/* Native stub — on Android/iOS playback uses expo-video (Media3/ExoPlayer, AVPlayer). */
import { forwardRef } from "react";

export type EngineStatus = "loading" | "readyToPlay" | "error";
export interface TrackInfo { id: string; label: string; language: string }
export interface WebVideoHandle {
  load(uri: string): void;
  play(): void;
  pause(): void;
  seekTo(sec: number): void;
  seekBy(sec: number): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  setRate(r: number): void;
  setAudioTrack(id: string | null): void;
  setSubtitleTrack(id: string | null): void;
}
export interface WebVideoProps {
  fit: "contain" | "cover" | "fill";
  onStatus: (s: EngineStatus, error?: string) => void;
  onPlaying: (p: boolean) => void;
  onTime: (cur: number, dur: number) => void;
  onTracks: (audio: TrackInfo[], subs: TrackInfo[]) => void;
}

export const WebVideo = forwardRef<WebVideoHandle, WebVideoProps>(function WebVideo() {
  return null;
});
