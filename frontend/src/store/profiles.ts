import AsyncStorage from "@react-native-async-storage/async-storage";

export interface XtreamProfile {
  id: string;
  label: string;
  server: string;
  username: string;
  password: string;
  updatedAt: number;
}

const PROFILES_KEY = "@goldcast_xtream_profiles_v1";
const ACTIVE_PROFILE_KEY = "@goldcast_active_profile_id_v1";

let profilesCache: XtreamProfile[] = [];
let activeIdCache: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}

function normalizeServer(url: string): string {
  return String(url || "").trim().replace(/\/+$/, "");
}

export const ProfilesStore = {
  async init(): Promise<{ profiles: XtreamProfile[]; activeId: string | null }> {
    if (loaded) {
      return { profiles: [...profilesCache], activeId: activeIdCache };
    }
    try {
      const [rawList, rawActive] = await Promise.all([
        AsyncStorage.getItem(PROFILES_KEY),
        AsyncStorage.getItem(ACTIVE_PROFILE_KEY),
      ]);
      if (rawList) {
        const parsed = JSON.parse(rawList);
        if (Array.isArray(parsed)) profilesCache = parsed;
      }
      if (rawActive) {
        activeIdCache = rawActive;
      }
    } catch {
      profilesCache = [];
      activeIdCache = null;
    }
    loaded = true;
    notify();
    return { profiles: [...profilesCache], activeId: activeIdCache };
  },

  getProfiles(): XtreamProfile[] {
    return [...profilesCache];
  },

  getActiveId(): string | null {
    return activeIdCache;
  },

  async upsertProfile(input: {
    id?: string;
    label: string;
    server: string;
    username: string;
    password: string;
    setAsActive?: boolean;
  }): Promise<XtreamProfile> {
    await this.init();

    const cleanServer = normalizeServer(input.server);
    const cleanUser = String(input.username || "").trim();
    const cleanPass = String(input.password || "").trim();
    const cleanLabel =
      String(input.label || "").trim() ||
      cleanServer.replace(/^https?:\/\//i, "").split("/")[0] ||
      `Lista ${profilesCache.length + 1}`;

    const existingIdx = input.id
      ? profilesCache.findIndex((p) => p.id === input.id)
      : profilesCache.findIndex(
          (p) =>
            normalizeServer(p.server) === cleanServer &&
            p.username === cleanUser
        );

    const id =
      existingIdx >= 0
        ? profilesCache[existingIdx].id
        : input.id || `prof_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const profile: XtreamProfile = {
      id,
      label: cleanLabel,
      server: cleanServer,
      username: cleanUser,
      password: cleanPass,
      updatedAt: Date.now(),
    };

    if (existingIdx >= 0) {
      profilesCache[existingIdx] = profile;
    } else {
      profilesCache = [profile, ...profilesCache];
    }

    if (input.setAsActive !== false) {
      activeIdCache = id;
      await AsyncStorage.setItem(ACTIVE_PROFILE_KEY, id).catch(() => {});
    }

    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(profilesCache)).catch(() => {});
    notify();
    return profile;
  },

  async setActiveProfile(id: string): Promise<XtreamProfile | null> {
    await this.init();
    const found = profilesCache.find((p) => p.id === id) || null;
    if (!found) return null;
    activeIdCache = found.id;
    await AsyncStorage.setItem(ACTIVE_PROFILE_KEY, found.id).catch(() => {});
    notify();
    return found;
  },

  async removeProfile(id: string): Promise<void> {
    await this.init();
    profilesCache = profilesCache.filter((p) => p.id !== id);
    if (activeIdCache === id) {
      activeIdCache = profilesCache[0]?.id || null;
      if (activeIdCache) {
        await AsyncStorage.setItem(ACTIVE_PROFILE_KEY, activeIdCache).catch(() => {});
      } else {
        await AsyncStorage.removeItem(ACTIVE_PROFILE_KEY).catch(() => {});
      }
    }
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(profilesCache)).catch(() => {});
    notify();
  },

  subscribe(callback: () => void): () => void {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
};
