import AsyncStorage from "@react-native-async-storage/async-storage";

export type WatchKind = "movie" | "series";

export interface WatchProgressItem {
  id: string;
  kind: WatchKind;
  title: string;
  subtitle?: string;
  cover?: string;
  positionSec: number;
  durationSec: number;
  percent: number;
  updatedAt: number;
  raw?: any;
}

const PROGRESS_STORAGE_KEY = "@goldcast_watch_progress_v1";
const MAX_ITEMS = 40;

let progressCache: WatchProgressItem[] = [];
let isLoaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

export const WatchProgressStore = {
  async init(): Promise<WatchProgressItem[]> {
    if (isLoaded) return progressCache;
    try {
      const raw = await AsyncStorage.getItem(PROGRESS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          progressCache = parsed;
        }
      }
    } catch {
      progressCache = [];
    }
    isLoaded = true;
    notify();
    return progressCache;
  },

  getAll(): WatchProgressItem[] {
    return progressCache;
  },

  getProgress(id: string, kind: WatchKind): WatchProgressItem | undefined {
    return progressCache.find(
      (item) => String(item.id) === String(id) && item.kind === kind
    );
  },

  async saveProgress(entry: {
    id: string;
    kind: WatchKind;
    title: string;
    subtitle?: string;
    cover?: string;
    positionSec: number;
    durationSec: number;
    raw?: any;
  }): Promise<void> {
    await this.init();

    const pos = Math.max(0, Math.floor(entry.positionSec || 0));
    const dur = Math.max(0, Math.floor(entry.durationSec || 0));

    // Ignora posições muito iniciais (< 10s)
    if (pos < 10) return;

    const percent = dur > 0 ? Math.min(100, Math.round((pos / dur) * 100)) : 0;

    // Se já terminou (>= 95%), remove da lista de "Continuar a Assistir"
    if (dur > 0 && percent >= 95) {
      await this.removeProgress(entry.id, entry.kind);
      return;
    }

    const filtered = progressCache.filter(
      (item) => !(String(item.id) === String(entry.id) && item.kind === entry.kind)
    );

    const updatedItem: WatchProgressItem = {
      id: String(entry.id),
      kind: entry.kind,
      title: entry.title,
      subtitle: entry.subtitle,
      cover: entry.cover,
      positionSec: pos,
      durationSec: dur,
      percent,
      updatedAt: Date.now(),
      raw: entry.raw,
    };

    progressCache = [updatedItem, ...filtered].slice(0, MAX_ITEMS);

    try {
      await AsyncStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progressCache));
    } catch {}

    notify();
  },

  async removeProgress(id: string, kind: WatchKind): Promise<void> {
    await this.init();
    progressCache = progressCache.filter(
      (item) => !(String(item.id) === String(id) && item.kind === kind)
    );
    try {
      await AsyncStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progressCache));
    } catch {}
    notify();
  },

  async clearAll(): Promise<void> {
    progressCache = [];
    try {
      await AsyncStorage.removeItem(PROGRESS_STORAGE_KEY);
    } catch {}
    notify();
  },

  subscribe(callback: () => void): () => void {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
};
