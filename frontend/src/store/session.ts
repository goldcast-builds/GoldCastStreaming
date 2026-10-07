import { create } from "zustand";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  authenticate, Category, LiveStream, SeriesItem, Stage, VodStream, XtreamSession, xtream,
} from "../services/xtream";

const SESSION_KEY = "goldcast_session_v1";
const SOURCE_KEY = "goldcast_source_v1";
const DEVICE_KEY = "goldcast_device_mode";
const PREFS_KEY = "goldcast_prefs_v1";
export interface Prefs { autoReconnect: boolean; autoplay: boolean; liveFormat: "auto" | "m3u8" | "ts"; }
const defaultPrefs = (): Prefs => ({ autoReconnect: true, autoplay: true, liveFormat: "auto" });
export type DeviceMode = "tv" | "mobile";

// ---------- secure persistence (SecureStore on device, AsyncStorage on web) ----------
async function secureSet(key: string, value: string | null) {
  if (Platform.OS === "web") return value == null ? AsyncStorage.removeItem(key) : AsyncStorage.setItem(key, value);
  if (value == null) return SecureStore.deleteItemAsync(key);
  return SecureStore.setItemAsync(key, value);
}
async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

// ---------- types ----------
export type Kind = "live" | "vod" | "series";
export type Source = { kind: "xtream" } | { kind: "list"; listId: string };

export interface PlayItem {
  kind: Kind;
  id: string;                 // stream_id / episode id / channel id
  title: string;
  subtitle?: string;          // category / series name
  logo?: string;
  urls: string[];             // ordered candidate URLs
  epgChannelId?: string | null;
  streamId?: number | string; // for get_short_epg
  progressKey?: string;       // for VOD/series resume
  favKind?: Kind;
  favId?: string;
  raw?: any;
}

export interface Progress { position: number; duration: number; updatedAt: number; title: string; logo?: string; item: PlayItem }

interface UserData {
  favorites: Record<Kind, string[]>;
  recents: Record<Kind, any[]>;       // most recent first, max 30
  progress: Record<string, Progress>; // key -> progress
}
const emptyUD = (): UserData => ({
  favorites: { live: [], vod: [], series: [] },
  recents: { live: [], vod: [], series: [] },
  progress: {},
});

interface Catalog {
  liveCats: Category[]; live: LiveStream[]; liveLoaded: boolean;
  vodCats: Category[]; vod: VodStream[]; vodLoaded: boolean;
  seriesCats: Category[]; series: SeriesItem[]; seriesLoaded: boolean;
}
const emptyCatalog = (): Catalog => ({
  liveCats: [], live: [], liveLoaded: false,
  vodCats: [], vod: [], vodLoaded: false,
  seriesCats: [], series: [], seriesLoaded: false,
});

interface State {
  restored: boolean;
  deviceMode: DeviceMode | null;
  setDeviceMode: (m: DeviceMode) => Promise<void>;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => Promise<void>;
  clearCatalog: () => void;
  session: XtreamSession | null;
  source: Source | null;
  catalog: Catalog;
  loading: Record<Kind, boolean>;
  errors: Record<Kind, string | null>;
  ud: UserData;
  queue: PlayItem[];
  queueIndex: number;

  restore: () => Promise<void>;
  login: (server: string, username: string, password: string, remember: boolean, onStage?: (s: Stage, d?: string) => void) => Promise<XtreamSession>;
  logout: () => Promise<void>;
  setSource: (s: Source | null) => Promise<void>;
  loadLive: (force?: boolean) => Promise<void>;
  loadVod: (force?: boolean) => Promise<void>;
  loadSeries: (force?: boolean) => Promise<void>;
  refreshAccount: () => Promise<void>;

  isFav: (kind: Kind, id: string | number) => boolean;
  toggleFav: (kind: Kind, id: string | number) => void;
  addRecent: (kind: Kind, item: any) => void;
  clearHistory: (kind?: Kind) => void;
  saveProgress: (key: string, p: Omit<Progress, "updatedAt">) => void;
  removeProgress: (key: string) => void;

  setQueue: (items: PlayItem[], index: number) => void;
  setQueueIndex: (i: number) => void;
}

function accountKey(s: XtreamSession | null): string | null {
  return s ? `goldcast_ud_${s.userInfo?.username || s.username}@${s.server.replace(/^https?:\/\//, "")}` : null;
}
async function loadUD(s: XtreamSession | null): Promise<UserData> {
  const k = accountKey(s);
  if (!k) return emptyUD();
  try {
    const raw = await AsyncStorage.getItem(k);
    return raw ? { ...emptyUD(), ...JSON.parse(raw) } : emptyUD();
  } catch { return emptyUD(); }
}
let saveTimer: any = null;
function persistUD(s: XtreamSession | null, ud: UserData) {
  const k = accountKey(s);
  if (!k) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => AsyncStorage.setItem(k, JSON.stringify(ud)).catch(() => {}), 300);
}

let restoring: Promise<void> | null = null;

export const useSession = create<State>((set, get) => ({
  restored: false,
  deviceMode: null,
  setDeviceMode: async (m) => { set({ deviceMode: m }); await AsyncStorage.setItem(DEVICE_KEY, m); },
  prefs: defaultPrefs(),
  setPrefs: async (p) => { const prefs = { ...get().prefs, ...p }; set({ prefs }); await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); },
  clearCatalog: () => set({ catalog: emptyCatalog() }),
  session: null,
  source: null,
  catalog: emptyCatalog(),
  loading: { live: false, vod: false, series: false },
  errors: { live: null, vod: null, series: null },
  ud: emptyUD(),
  queue: [],
  queueIndex: 0,

  restore: async () => {
    if (get().restored || restoring) return restoring || undefined;
    restoring = (async () => {
    try {
      const [raw, src, dm, pr] = await Promise.all([secureGet(SESSION_KEY), AsyncStorage.getItem(SOURCE_KEY), AsyncStorage.getItem(DEVICE_KEY), AsyncStorage.getItem(PREFS_KEY)]);
      if (dm === "tv" || dm === "mobile") set({ deviceMode: dm });
      if (pr) { try { set({ prefs: { ...defaultPrefs(), ...JSON.parse(pr) } }); } catch {} }
      let session: XtreamSession | null = null;
      if (raw) {
        const saved = JSON.parse(raw);
        // Re-validate with the panel in the background; keep last known session so the UI opens instantly
        session = saved as XtreamSession;
        authenticate(saved.server, saved.username, saved.password)
          .then(async (fresh) => {
            set({ session: fresh });
            await secureSet(SESSION_KEY, JSON.stringify(fresh));
          })
          .catch(async (e) => {
            if (e?.kind === "auth" || e?.kind === "expired") {
              // Access revoked / expired: block content and require a new login
              set({ session: { ...saved, userInfo: { ...saved.userInfo, status: e.kind === "expired" ? "Expired" : "Invalid", auth: e.kind === "auth" ? 0 : 1 } } });
            }
          });
      }
      const ud = await loadUD(session);
      let source: Source | null = src ? JSON.parse(src) : null;
      if (!source && session) source = { kind: "xtream" };
      set({ session, ud, source, restored: true });
    } catch {
      set({ restored: true });
    }
    })();
    return restoring;
  },

  login: async (server, username, password, remember, onStage) => {
    const session = await authenticate(server, username, password, onStage);
    onStage?.("loading");
    const ud = await loadUD(session);
    set({ session, ud, source: { kind: "xtream" }, catalog: emptyCatalog(), errors: { live: null, vod: null, series: null } });
    await AsyncStorage.setItem(SOURCE_KEY, JSON.stringify({ kind: "xtream" }));
    if (remember) await secureSet(SESSION_KEY, JSON.stringify(session));
    else await secureSet(SESSION_KEY, null);
    onStage?.("done");
    return session;
  },

  logout: async () => {
    await secureSet(SESSION_KEY, null);
    await AsyncStorage.removeItem(SOURCE_KEY);
    set({ session: null, source: null, catalog: emptyCatalog(), ud: emptyUD(), queue: [], queueIndex: 0 });
  },

  setSource: async (s) => {
    set({ source: s });
    if (s) await AsyncStorage.setItem(SOURCE_KEY, JSON.stringify(s));
    else await AsyncStorage.removeItem(SOURCE_KEY);
  },

  refreshAccount: async () => {
    const s = get().session;
    if (!s) return;
    const fresh = await authenticate(s.server, s.username, s.password);
    set({ session: fresh });
    const raw = await secureGet(SESSION_KEY);
    if (raw) await secureSet(SESSION_KEY, JSON.stringify(fresh));
  },

  loadLive: async (force) => {
    const { session, catalog, loading } = get();
    if (!session || loading.live || (catalog.liveLoaded && !force)) return;
    set((st) => ({ loading: { ...st.loading, live: true }, errors: { ...st.errors, live: null } }));
    try {
      const [liveCats, live] = await Promise.all([xtream.liveCategories(session), xtream.liveStreams(session)]);
      set((st) => ({ catalog: { ...st.catalog, liveCats, live, liveLoaded: true } }));
    } catch (e: any) {
      set((st) => ({ errors: { ...st.errors, live: e?.message || "Falha ao carregar canais." } }));
    } finally {
      set((st) => ({ loading: { ...st.loading, live: false } }));
    }
  },
  loadVod: async (force) => {
    const { session, catalog, loading } = get();
    if (!session || loading.vod || (catalog.vodLoaded && !force)) return;
    set((st) => ({ loading: { ...st.loading, vod: true }, errors: { ...st.errors, vod: null } }));
    try {
      const [vodCats, vod] = await Promise.all([xtream.vodCategories(session), xtream.vodStreams(session)]);
      set((st) => ({ catalog: { ...st.catalog, vodCats, vod, vodLoaded: true } }));
    } catch (e: any) {
      set((st) => ({ errors: { ...st.errors, vod: e?.message || "Falha ao carregar filmes." } }));
    } finally {
      set((st) => ({ loading: { ...st.loading, vod: false } }));
    }
  },
  loadSeries: async (force) => {
    const { session, catalog, loading } = get();
    if (!session || loading.series || (catalog.seriesLoaded && !force)) return;
    set((st) => ({ loading: { ...st.loading, series: true }, errors: { ...st.errors, series: null } }));
    try {
      const [seriesCats, series] = await Promise.all([xtream.seriesCategories(session), xtream.series(session)]);
      set((st) => ({ catalog: { ...st.catalog, seriesCats, series, seriesLoaded: true } }));
    } catch (e: any) {
      set((st) => ({ errors: { ...st.errors, series: e?.message || "Falha ao carregar séries." } }));
    } finally {
      set((st) => ({ loading: { ...st.loading, series: false } }));
    }
  },

  isFav: (kind, id) => get().ud.favorites[kind].includes(String(id)),
  toggleFav: (kind, id) => {
    const { ud, session } = get();
    const sid = String(id);
    const list = ud.favorites[kind];
    const next = list.includes(sid) ? list.filter((x) => x !== sid) : [sid, ...list];
    const nud = { ...ud, favorites: { ...ud.favorites, [kind]: next } };
    set({ ud: nud });
    persistUD(session, nud);
  },
  addRecent: (kind, item) => {
    const { ud, session } = get();
    const idOf = (x: any) => String(x.stream_id ?? x.series_id ?? x.id);
    const list = [item, ...ud.recents[kind].filter((x) => idOf(x) !== idOf(item))].slice(0, 30);
    const nud = { ...ud, recents: { ...ud.recents, [kind]: list } };
    set({ ud: nud });
    persistUD(session, nud);
  },
  clearHistory: (kind) => {
    const { ud, session } = get();
    const nud: UserData = kind
      ? { ...ud, recents: { ...ud.recents, [kind]: [] }, progress: kind === "live" ? ud.progress : Object.fromEntries(Object.entries(ud.progress).filter(([, p]) => p.item.kind !== kind)) }
      : { ...ud, recents: { live: [], vod: [], series: [] }, progress: {} };
    set({ ud: nud });
    persistUD(session, nud);
  },
  saveProgress: (key, p) => {
    const { ud, session } = get();
    const entries = Object.entries({ ...ud.progress, [key]: { ...p, updatedAt: Date.now() } })
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, 50);
    const nud = { ...ud, progress: Object.fromEntries(entries) };
    set({ ud: nud });
    persistUD(session, nud);
  },
  removeProgress: (key) => {
    const { ud, session } = get();
    const { [key]: _, ...rest } = ud.progress;
    const nud = { ...ud, progress: rest };
    set({ ud: nud });
    persistUD(session, nud);
  },

  setQueue: (items, index) => set({ queue: items, queueIndex: index }),
  setQueueIndex: (i) => set({ queueIndex: i }),
}));

/** Account is usable only when the panel says auth=1 and status Active (and not past exp_date). */
export function accountState(s: XtreamSession | null): "active" | "expired" | "invalid" | "none" {
  if (!s) return "none";
  if (Number(s.userInfo?.auth) !== 1) return "invalid";
  const status = String(s.userInfo?.status || "").toLowerCase();
  const exp = Number(s.userInfo?.exp_date);
  if ((status && status !== "active") || (exp > 0 && exp * 1000 < Date.now())) return "expired";
  return "active";
}
