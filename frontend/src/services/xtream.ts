/**
 * Xtream Codes / XUI client.
 * On native devices requests go straight to the user's panel (no third-party in the middle).
 * On the web preview the browser blocks cross-origin/mixed-content requests, so we go through
 * the backend proxy (/api/xtream/proxy) which only forwards the call and never stores credentials.
 */
import { Platform } from "react-native";

export const DEFAULT_SERVERS = {
  primary: "http://dpvizzion.shop:8080",
  backup: "http://kvlivegame12.store:80",
};

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const TIMEOUT_MS = 25000;
const UA = "GoldCastStreaming/1.0";

export class XtreamError extends Error {
  kind: "network" | "auth" | "expired" | "incompatible" | "blocked";
  constructor(kind: XtreamError["kind"], message: string) {
    super(message);
    this.kind = kind;
  }
}

export const MSG = {
  invalidUrl: "Endereço do servidor inválido.",
  network: "Falha na conexão. Verifique sua internet ou o servidor.",
  timeout: "Tempo esgotado ao conectar. Servidor demorou a responder.",
  auth: "Usuário ou senha inválidos.",
  expired: "Seu acesso expirou ou está inativo.",
  incompatible: "Servidor incompatível com Xtream Codes/XUI.",
  blocked: "O servidor não respondeu à API. Verifique o servidor ou aguarde alguns minutos e tente novamente.",
};

export const SERVER_LABELS: Record<string, string> = {
  [DEFAULT_SERVERS.primary]: "SERVIDOR 1 (DNS 1)",
  [DEFAULT_SERVERS.backup]: "SERVIDOR 2 (DNS 2)",
};
/** Public label for a server — never exposes the URL for the built-in servers. */
export function serverLabel(server: string): string {
  return SERVER_LABELS[server] || "Servidor personalizado";
}

/** Accepts dominio, dominio:porta, http(s)://dominio[:porta][/path]. Keeps scheme + port exactly as typed. */
export function normalizeServer(input: string): string {
  let s = (input || "").trim();
  if (!s) throw new XtreamError("network", MSG.invalidUrl);
  if (!/^https?:\/\//i.test(s)) s = "http://" + s;
  const m = s.match(/^(https?):\/\/([^/?#\s]+)(\/[^?#\s]*)?/i);
  if (!m) throw new XtreamError("network", MSG.invalidUrl);
  const scheme = m[1].toLowerCase();
  const hostPort = m[2];
  let path = (m[3] || "").replace(/\/+$/, "");
  if (/\/(player_api|get)\.php$/i.test(path)) path = path.replace(/\/[^/]+$/, "");
  const hp = hostPort.match(/^([^:]+)(?::(\d{1,5}))?$/);
  if (!hp) throw new XtreamError("network", MSG.invalidUrl);
  const host = hp[1].toLowerCase();
  const port = hp[2];
  if (!/^[a-z0-9.-]+$/.test(host)) throw new XtreamError("network", MSG.invalidUrl);
  return (port ? `${scheme}://${host}:${port}` : `${scheme}://${host}`) + path;
}

export function hostOf(server: string): string {
  return server.replace(/^https?:\/\//, "");
}

export interface UserInfo {
  auth?: number;
  status?: string;
  exp_date?: string | number | null;
  is_trial?: string | number;
  active_cons?: string | number;
  max_connections?: string | number;
  created_at?: string | number;
  allowed_output_formats?: string[];
  username?: string;
}
export interface ServerInfo {
  url?: string;
  port?: string | number;
  https_port?: string | number;
  server_protocol?: string;
  timezone?: string;
  xui?: boolean;
  version?: string;
}
export interface XtreamSession {
  server: string;       // server used for API calls (normalized, as typed / fallback)
  username: string;
  password: string;
  userInfo: UserInfo;
  serverInfo: ServerInfo;
  playbackBases: string[]; // ordered candidates (https preferred when advertised)
  liveFormat: "m3u8" | "ts";
  connectedAt: number;
}

export interface Category { category_id: string; category_name: string; parent_id?: number }
export interface LiveStream {
  num?: number; name: string; stream_type?: string; stream_id: number; stream_icon?: string;
  epg_channel_id?: string | null; category_id?: string; category_ids?: number[]; tv_archive?: number;
}
export interface VodStream {
  num?: number; name: string; stream_id: number; stream_icon?: string; rating?: string | number;
  category_id?: string; container_extension?: string; added?: string; year?: string; genre?: string;
}
export interface SeriesItem {
  num?: number; name: string; series_id: number; cover?: string; plot?: string; cast?: string;
  genre?: string; releaseDate?: string; rating?: string | number; category_id?: string; episode_run_time?: string;
}
export interface Episode {
  id: string; episode_num: number | string; title: string; container_extension: string; season?: number;
  info?: { plot?: string; duration?: string; movie_image?: string; releasedate?: string; rating?: string | number };
}
export interface EpgEntry {
  id?: string; title: string; description?: string; start: string; end: string;
  start_timestamp: number; stop_timestamp: number;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new XtreamError("network", MSG.timeout);
    throw new XtreamError("network", MSG.network);
  } finally {
    clearTimeout(t);
  }
}

// XUI panels temporarily ban IPs that fire many requests at once -> serialize API calls with a small gap.
let chain: Promise<any> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(() => new Promise((r) => setTimeout(r, 250)), () => new Promise((r) => setTimeout(r, 250)));
  return run;
}

async function callApi(server: string, username: string, password: string, action?: string, extra?: Record<string, any>): Promise<any> {
  return serialized(() => callApiNow(server, username, password, action, extra));
}

async function callApiNow(server: string, username: string, password: string, action?: string, extra?: Record<string, any>): Promise<any> {
  let res: Response;
  if (Platform.OS === "web") {
    res = await fetchWithTimeout(`${BACKEND}/api/xtream/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ server, username, password, action, extra }),
    });
    const txt = await res.text();
    let data: any = null;
    try { data = txt ? JSON.parse(txt) : null; } catch { data = null; }
    if (!res.ok) {
      const detail = data?.detail || MSG.network;
      const kind: XtreamError["kind"] = res.status === 401 ? "auth" : /bloquead|incorreto/i.test(detail) ? "blocked" : "network";
      throw new XtreamError(kind, detail);
    }
    return data;
  }
  const qs = new URLSearchParams({ username, password });
  if (action) qs.set("action", action);
  if (extra) Object.entries(extra).forEach(([k, v]) => v != null && qs.set(k, String(v)));
  res = await fetchWithTimeout(`${server}/player_api.php?${qs.toString()}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (res.status === 403 || res.status === 404) throw new XtreamError("blocked", MSG.blocked);
  if (res.status >= 500) throw new XtreamError("network", MSG.network);
  if (res.status >= 400) throw new XtreamError("auth", MSG.auth);
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { throw new XtreamError("incompatible", MSG.incompatible); }
}

function candidatesFor(server: string): string[] {
  const list = [server];
  const p = normalizeServer(DEFAULT_SERVERS.primary);
  const b = normalizeServer(DEFAULT_SERVERS.backup);
  if (server === p) list.push(b);
  else if (server === b) list.push(p);
  return list;
}

export type Stage = "checking" | "connecting" | "validating" | "loading" | "done";

export async function authenticate(
  serverInput: string,
  username: string,
  password: string,
  onStage?: (s: Stage, detail?: string) => void,
): Promise<XtreamSession> {
  onStage?.("checking");
  const server = normalizeServer(serverInput);
  const candidates = candidatesFor(server);
  let lastErr: any = null;
  for (let i = 0; i < candidates.length; i++) {
    const s = candidates[i];
    onStage?.("connecting", i > 0 ? `Servidor reserva: ${hostOf(s)}` : hostOf(s));
    try {
      const data = await callApi(s, username, password);
      onStage?.("validating");
      const userInfo: UserInfo | undefined = data?.user_info;
      const serverInfo: ServerInfo = data?.server_info || {};
      if (!userInfo) throw new XtreamError("incompatible", MSG.incompatible);
      if (Number(userInfo.auth) !== 1) throw new XtreamError("auth", MSG.auth);
      const status = String(userInfo.status || "").toLowerCase();
      const exp = userInfo.exp_date ? Number(userInfo.exp_date) : null;
      const expired = exp != null && !Number.isNaN(exp) && exp > 0 && exp * 1000 < Date.now();
      if ((status && status !== "active") || expired) throw new XtreamError("expired", MSG.expired);
      const formats = (userInfo.allowed_output_formats || []).map((f) => String(f).toLowerCase());
      const liveFormat: "m3u8" | "ts" = formats.includes("m3u8") ? "m3u8" : "ts";
      return {
        server: s,
        username,
        password,
        userInfo,
        serverInfo,
        playbackBases: buildPlaybackBases(s, serverInfo),
        liveFormat,
        connectedAt: Date.now(),
      };
    } catch (e: any) {
      lastErr = e;
      // Only fall back to the backup server on connectivity problems, never on auth/expired
      const k = e?.kind as XtreamError["kind"] | undefined;
      if (k === "auth" || k === "expired" || k === "incompatible") throw e;
    }
  }
  throw lastErr || new XtreamError("network", MSG.network);
}

/** Uses server_info returned by the panel. Prefers HTTPS when the panel advertises https_port. */
export function buildPlaybackBases(authServer: string, info: ServerInfo): string[] {
  const bases: string[] = [];
  const host = (info.url || "").trim().toLowerCase();
  if (host && /^[a-z0-9.-]+$/.test(host)) {
    const httpsPort = info.https_port ? String(info.https_port) : "";
    const httpPort = info.port ? String(info.port) : "";
    if (httpsPort) bases.push(httpsPort === "443" ? `https://${host}` : `https://${host}:${httpsPort}`);
    if (httpPort) bases.push(httpPort === "80" ? `http://${host}` : `http://${host}:${httpPort}`);
    if (!httpsPort && !httpPort) bases.push(`${(info.server_protocol || "http").toLowerCase()}://${host}`);
  }
  if (!bases.includes(authServer)) bases.push(authServer);
  return bases;
}

export function liveUrls(s: XtreamSession, streamId: number | string, format?: "m3u8" | "ts"): string[] {
  const fmt = format || s.liveFormat;
  return s.playbackBases.map((b) => `${b}/live/${encodeURIComponent(s.username)}/${encodeURIComponent(s.password)}/${streamId}.${fmt}`);
}
export function movieUrls(s: XtreamSession, streamId: number | string, ext?: string): string[] {
  return s.playbackBases.map((b) => `${b}/movie/${encodeURIComponent(s.username)}/${encodeURIComponent(s.password)}/${streamId}.${ext || "mp4"}`);
}
export function episodeUrls(s: XtreamSession, episodeId: number | string, ext?: string): string[] {
  return s.playbackBases.map((b) => `${b}/series/${encodeURIComponent(s.username)}/${encodeURIComponent(s.password)}/${episodeId}.${ext || "mp4"}`);
}

/** Strip credentials from a URL before logging/displaying. */
export function redactUrl(url: string): string {
  return url.replace(/\/(live|movie|series)\/[^/]+\/[^/]+\//, "/$1/***/***/").replace(/(username|password)=[^&]*/gi, "$1=***");
}

const asList = (d: any) => (Array.isArray(d) ? d : []);

export const xtream = {
  liveCategories: async (s: XtreamSession): Promise<Category[]> => asList(await callApi(s.server, s.username, s.password, "get_live_categories")),
  liveStreams: async (s: XtreamSession, categoryId?: string): Promise<LiveStream[]> =>
    asList(await callApi(s.server, s.username, s.password, "get_live_streams", categoryId ? { category_id: categoryId } : undefined)),
  vodCategories: async (s: XtreamSession): Promise<Category[]> => asList(await callApi(s.server, s.username, s.password, "get_vod_categories")),
  vodStreams: async (s: XtreamSession, categoryId?: string): Promise<VodStream[]> =>
    asList(await callApi(s.server, s.username, s.password, "get_vod_streams", categoryId ? { category_id: categoryId } : undefined)),
  vodInfo: async (s: XtreamSession, vodId: number | string): Promise<any> => callApi(s.server, s.username, s.password, "get_vod_info", { vod_id: vodId }),
  seriesCategories: async (s: XtreamSession): Promise<Category[]> => asList(await callApi(s.server, s.username, s.password, "get_series_categories")),
  series: async (s: XtreamSession, categoryId?: string): Promise<SeriesItem[]> =>
    asList(await callApi(s.server, s.username, s.password, "get_series", categoryId ? { category_id: categoryId } : undefined)),
  seriesInfo: async (s: XtreamSession, seriesId: number | string): Promise<any> => callApi(s.server, s.username, s.password, "get_series_info", { series_id: seriesId }),
  shortEpg: async (s: XtreamSession, streamId: number | string, limit = 4): Promise<EpgEntry[]> => {
    try {
      const d = await callApi(s.server, s.username, s.password, "get_short_epg", { stream_id: streamId, limit });
      return asList(d?.epg_listings).map((e: any) => ({
        ...e,
        title: decodeB64(e.title),
        description: decodeB64(e.description),
        start_timestamp: Number(e.start_timestamp),
        stop_timestamp: Number(e.stop_timestamp),
      }));
    } catch {
      return [];
    }
  },
};

function decodeB64(v: any): string {
  if (!v) return "";
  try {
    const raw = typeof atob === "function" ? atob(String(v)) : String(v);
    try { return decodeURIComponent(escape(raw)); } catch { return raw; }
  } catch {
    return String(v);
  }
}

// ---------- formatting helpers ----------
export function fmtUnixSP(ts?: string | number | null, withTime = true): string | null {
  if (ts == null || ts === "" || ts === "null") return null;
  const n = Number(ts);
  if (!n || Number.isNaN(n)) return null;
  const d = new Date(n * 1000);
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit", month: "2-digit", year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(d);
  } catch {
    return d.toLocaleString("pt-BR");
  }
}
export function fmtTimeSP(ts?: number): string {
  if (!ts) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(ts * 1000));
  } catch {
    const d = new Date(ts * 1000);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
}
