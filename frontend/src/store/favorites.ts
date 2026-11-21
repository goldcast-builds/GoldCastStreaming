import AsyncStorage from "@react-native-async-storage/async-storage";

export type FavoriteType = "live" | "movie" | "series";

export interface FavoriteItem {
  id: string;
  type: FavoriteType;
  title: string;
  logo?: string;
  cover?: string;
  raw?: any;
  addedAt: number;
}

const FAVORITES_STORAGE_KEY = "@goldcast_favorites_v1";

let favoritesCache: FavoriteItem[] = [];
let isLoaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}

export const FavoritesStore = {
  async init(): Promise<FavoriteItem[]> {
    if (isLoaded) return [...favoritesCache];
    try {
      const raw = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          favoritesCache = parsed;
        }
      }
    } catch {
      favoritesCache = [];
    }
    isLoaded = true;
    notify();
    return [...favoritesCache];
  },

  getAll(): FavoriteItem[] {
    return [...favoritesCache];
  },

  getByType(type: FavoriteType): FavoriteItem[] {
    return favoritesCache.filter((f) => f.type === type);
  },

  isFavorite(id: string, type: FavoriteType): boolean {
    return favoritesCache.some((f) => String(f.id) === String(id) && f.type === type);
  },

  async toggleFavorite(item: {
    id: string;
    type: FavoriteType;
    title: string;
    logo?: string;
    cover?: string;
    raw?: any;
  }): Promise<boolean> {
    await this.init();
    const exists = this.isFavorite(item.id, item.type);

    if (exists) {
      favoritesCache = favoritesCache.filter(
        (f) => !(String(f.id) === String(item.id) && f.type === item.type)
      );
    } else {
      favoritesCache = [
        {
          id: String(item.id),
          type: item.type,
          title: item.title,
          logo: item.logo,
          cover: item.cover,
          raw: item.raw,
          addedAt: Date.now(),
        },
        ...favoritesCache,
      ];
    }

    try {
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoritesCache));
    } catch {}

    notify();
    return !exists;
  },

  subscribe(callback: () => void): () => void {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
};
