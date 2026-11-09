/**
 * Xtream Codes / XUI client - Otimizado com Tratamento Defensivo e Normalização UTF-8 Compatível
 */
import { Platform } from "react-native";

export const DEFAULT_SERVERS = {
  primary: "http://dpvizzion.shop:8080",
  backup: "http://kvlivegame12.store:80",
};

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const TIMEOUT_MS = 60000;
const UA = "IPTVSmartersPro";

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

export function serverLabel(server: string): string {
  return SERVER_LABELS[server] || "Servidor personalizado";
}

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

/** Normalização rigorosa de codificação UTF-8 compatível com React Native e Node.js */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== "string") return "";
  try {
    return decodeURIComponent(decodeURI(text));
  } catch {
    try {
      return decodeURIComponent(text);
    } catch {
      return text.trim();
    }
  }
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
  timestamp_now?: number;
  xui?: boolean;
  version?: string;
}

export interface XtreamSession {
  server: string;
  username: string;
  password: string;
  userInfo: UserInfo;
  serverInfo: ServerInfo;
  playbackBases: string[];
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

  const rawParams = [
    `username=${encodeURIComponent(username)}`,
    `password=${encodeURIComponent(password)}`,
  ];
  if (action) rawParams.push(`action=${encodeURIComponent(action)}`);
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => {
      if (v != null) rawParams.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    });
  }
  const queryString = rawParams.join("&");

  res = await fetchWithTimeout(`${server}/player_api.php?${queryString}`, {
    headers: {
      "User-Agent": UA,
      Accept: "*/*",
    },
  });

  if (res.status === 403) throw new XtreamError("blocked", `Servidor recusou a conexão (HTTP 403): ${hostOf(server)}`);
  if (res.status === 404) throw new XtreamError("blocked", `API não encontrada (HTTP 404): ${hostOf(server)}`);
  if (res.status >= 500) throw new XtreamError("network", MSG.network);
  if (res.status >= 400) throw new XtreamError("auth", MSG.auth);

  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    throw new XtreamError("incompatible", MSG.incompatible);
  }
}

function candidatesFor(server: string): string[] {
  const list = [server];
  const p = normalizeServer(DEFAULT_SERVERS.primary);
  const b = normalizeServer(DEFAULT_SERVERS.backup);
  if (server === p && !list.includes(b)) list.push(b);
  else if (server === b && !list.includes(p)) list.push(p);
  else {
    if (!list.includes(p)) list.push(p);
    if (!list.includes(b)) list.push(b);
  }
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
    onStage?.("connecting", i > 0 ? `Tentando failover: ${hostOf(s)}` : hostOf(s));
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
      const k = e?.kind as XtreamError["kind"] | undefined;
      if (k === "auth" || k === "expired" || k === "incompatible") throw e;
    }
  }
  throw lastErr || new XtreamError("network", MSG.network);
}

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
  const safeExt = (ext && typeof ext === "string" && ext.trim()) ? ext.trim().replace(/^\./, "") : "mp4";
  return s.playbackBases.map((b) => `${b}/movie/${encodeURIComponent(s.username)}/${encodeURIComponent(s.password)}/${streamId}.${safeExt}`);
}

export function episodeUrls(s: XtreamSession, episodeId: number | string, ext?: string): string[] {
  const safeExt = (ext && typeof ext === "string" && ext.trim()) ? ext.trim().replace(/^\./, "") : "mp4";
  return s.playbackBases.map((b) => `${b}/series/${encodeURIComponent(s.username)}/${encodeURIComponent(s.password)}/${episodeId}.${safeExt}`);
}

export function redactUrl(url: string): string {
  return url.replace(/\/(live|movie|series)\/[^/]+\/[^/]+\//, "/$1/***/***/").replace(/(username|password)=[^&]*/gi, "$1=***");
}

const asList = (d: any) => (Array.isArray(d) ? d : []);

export const xtream = {
  liveCategories: async (s: XtreamSession): Promise<Category[]> =>
    asList(await callApi(s.server, s.username, s.password, "get_live_categories")).map((c: any) => ({
      ...c,
      category_name: sanitizeText(c.category_name),
    })),

  liveStreams: async (
    session: XtreamSession,
    category?: string,
    search?: string,
    limit?: number,
    offset = 0
  ): Promise<LiveStream[]> => {
    const extra: Record<string, any> = {};
    if (category) extra.category_id = category;
    const data = await callApi(session.server, session.username, session.password, "get_live_streams", extra);
    if (!Array.isArray(data)) return [];
    let items = (data as LiveStream[]).map((x) => ({
      ...x,
      stream_id: Number(x.stream_id),
      name: sanitizeText(x.name),
    }));
    if (search) {
      const sQuery = search.toLowerCase();
      items = items.filter((x) => String(x.name || "").toLowerCase().includes(sQuery));
    }
    return limit && limit > 0 ? items.slice(offset, offset + limit) : (offset > 0 ? items.slice(offset) : items);
  },

  vodCategories: async (s: XtreamSession): Promise<Category[]> =>
    asList(await callApi(s.server, s.username, s.password, "get_vod_categories")).map((c: any) => ({
      ...c,
      category_name: sanitizeText(c.category_name),
    })),

  vodStreams: async (
    session: XtreamSession,
    category?: string,
    search?: string,
    limit?: number,
    offset = 0
  ): Promise<VodStream[]> => {
    const extra: Record<string, any> = {};
    if (category) extra.category_id = category;
    const data = await callApi(session.server, session.username, session.password, "get_vod_streams", extra);
    if (!Array.isArray(data)) return [];
    let items = (data as VodStream[]).map((x) => ({
      ...x,
      stream_id: Number(x.stream_id),
      name: sanitizeText(x.name),
      container_extension: x.container_extension || "mp4",
    }));
    if (search) {
      const sQuery = search.toLowerCase();
      items = items.filter((x) => String(x.name || "").toLowerCase().includes(sQuery));
    }
    return limit && limit > 0 ? items.slice(offset, offset + limit) : (offset > 0 ? items.slice(offset) : items);
  },

  vodInfo: async (s: XtreamSession, vodId: number | string): Promise<any> => {
    try {
      const res = await callApi(s.server, s.username, s.password, "get_vod_info", { vod_id: vodId });
      if (!res || typeof res !== "object") return {};
      return {
        ...res,
        info: {
          ...(res.info || {}),
          plot: sanitizeText(res.info?.plot || ""),
          cast: sanitizeText(res.info?.cast || ""),
          genre: sanitizeText(res.info?.genre || ""),
          director: sanitizeText(res.info?.director || ""),
          rating: res.info?.rating || "",
          movie_image: res.info?.movie_image || "",
        },
        movie_data: {
          ...(res.movie_data || {}),
          name: sanitizeText(res.movie_data?.name || ""),
        },
      };
    } catch {
      return {};
    }
  },

  seriesCategories: async (s: XtreamSession): Promise<Category[]> => {
    try {
      const res = await callApi(s.server, s.username, s.password, "get_series_categories");
      return asList(res).map((c: any) => ({
        ...c,
        category_name: sanitizeText(c.category_name),
      }));
    } catch {
      return [];
    }
  },

  series: async (
    session: XtreamSession,
    category?: string,
    search?: string,
    limit?: number,
    offset = 0
  ): Promise<SeriesItem[]> => {
    try {
      const extra: Record<string, any> = {};
      if (category) extra.category_id = category;
      const data = await callApi(session.server, session.username, session.password, "get_series", extra);
      if (!Array.isArray(data)) return [];
      let items = (data as SeriesItem[]).map((x) => ({
        ...x,
        name: sanitizeText(x.name),
        plot: sanitizeText(x.plot || ""),
        genre: sanitizeText(x.genre || ""),
      }));
      if (search) {
        const sQuery = search.toLowerCase();
        items = items.filter((x) => String(x.name || "").toLowerCase().includes(sQuery));
      }
      return limit && limit > 0 ? items.slice(offset, offset + limit) : (offset > 0 ? items.slice(offset) : items);
    } catch {
      return [];
    }
  },

  seriesInfo: async (s: XtreamSession, seriesId: number | string): Promise<any> => {
    try {
      const res = await callApi(s.server, s.username, s.password, "get_series_info", { series_id: seriesId });
      if (!res || typeof res !== "object") return {};
      return res;
    } catch {
      return {};
    }
  },

  shortEpg: async (s: XtreamSession, streamId: number | string, limit = 4): Promise<EpgEntry[]> => {
    try {
      const d = await callApi(s.server, s.username, s.password, "get_short_epg", { stream_id: streamId, limit });
      return asList(d?.epg_listings).map((e: any) => ({
        ...e,
        title: decodeB64(sanitizeText(e.title)),
        description: decodeB64(sanitizeText(e.description)),
        start_timestamp: Number(e.start_timestamp),
        stop_timestamp: Number(e.stop_timestamp),
      }));
    } catch {
      return [];
    }
  },
};

export default xtream;

function decodeB64(v: any): string {
  if (!v) return "";
  try {
    const raw = typeof atob === "function" ? atob(String(v)) : String(v);
    try { return decodeURIComponent(decodeURI(raw)); } catch { return raw; }
  } catch {
    return String(v);
  }
}
