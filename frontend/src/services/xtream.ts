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
const UA = "IPTVSmartersPro";

export type Stage = "checking" | "connecting" | "validating" | "loading" | "done";

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
  server: string;
  username: string;
  password: string;
  userInfo: UserInfo;
  serverInfo: ServerInfo;
  playbackBases: string[];
  liveFormat: "m3u8" | "ts";
  connectedAt: number;
}

export interface Category {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

export interface LiveStream {
  num?: number;
  name: string;
  stream_type?: string;
  stream_id: number;
  stream_icon?: string;
  epg_channel_id?: string | null;
  category_id?: string;
  category_ids?: number[];
  tv_archive?: number;
}

export interface VodStream {
  num?: number;
  name: string;
  stream_id: number;
  stream_icon?: string;
  rating?: string | number;
  category_id?: string;
  container_extension?: string;
  added?: string;
  year?: string;
  genre?: string;
}

export interface SeriesItem {
  num?: number;
  name: string;
  series_id: number;
  cover?: string;
  plot?: string;
  cast?: string;
  genre?: string;
  releaseDate?: string;
  rating?: string | number;
  category_id?: string;
  episode_run_time?: string;
}

export interface Episode {
  id: string;
  episode_num: number | string;
  title: string;
  container_extension: string;
  season?: number;
  info?: {
    plot?: string;
    duration?: string;
    movie_image?: string;
    releasedate?: string;
    rating?: string | number;
  };
}

export interface EpgEntry {
  id?: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  start_timestamp: number;
  stop_timestamp: number;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new XtreamError("network", MSG.timeout);
    }
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

function httpStatusMessage(status: number | undefined, fallback: string): string {
  if (!status) return fallback;
  return `HTTP ${status}: ${fallback}`;
}

function toQueryParams(obj: Record<string, any>): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(obj).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === "object") {
      params.append(key, JSON.stringify(value));
      return;
    }
    params.append(key, String(value));
  });
  return params;
}

async function callApiNow(
  server: string,
  username: string,
  password: string,
  action?: string,
  extra?: Record<string, any>,
): Promise<any> {
  const normalizedServer = normalizeServer(server);

  const params = new URLSearchParams();
  params.set("username", username);
  params.set("password", password);

  if (action) {
    params.set("action", action);
  }

  if (extra) {
    Object.entries(extra).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      params.set(key, String(value));
    });
  }

  const url = `${normalizedServer}/player_api.php?${params.toString()}`;

  try {
    // Native app: direct route, same as IPTV clients
    if (Platform.OS !== "web") {
      const res = await fetchWithTimeout(url, {
        method: "GET",
        headers: {
          "User-Agent": UA,
          // CRITICAL: some Xtream/XUI panels reject requests with application/json
          Accept: "*/*",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        const detail = bodyText ? ` ${bodyText.trim().slice(0, 180)}` : "";
        throw new XtreamError(
          "blocked",
          `${httpStatusMessage(res.status, MSG.blocked)}${detail}`,
        );
      }

      const contentType = res.headers.get("content-type") || "";
      try {
        if (contentType.includes("application/json")) {
          return await res.json();
        }
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      } catch {
        throw new XtreamError("incompatible", "Servidor incompatível com Xtream Codes/XUI.");
      }
    }

    // Web fallback: call through local backend proxy
    if (!BACKEND) {
      throw new XtreamError("network", "Backend não configurado para preview web.");
    }

    const res = await fetchWithTimeout(`${BACKEND}/api/xtream/proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": UA,
        Accept: "*/*",
      },
      body: JSON.stringify({
        server: normalizedServer,
        username,
        password,
        action,
        extra,
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      const detail = bodyText ? ` ${bodyText.trim().slice(0, 180)}` : "";
      throw new XtreamError(
        "blocked",
        `${httpStatusMessage(res.status, MSG.blocked)}${detail}`,
      );
    }

    const data = await res.json().catch(() => null);
    if (data === null) {
      throw new XtreamError("incompatible", "Servidor incompatível com Xtream Codes/XUI.");
    }

    return data;
  } catch (error) {
    if (error instanceof XtreamError) {
      throw error;
    }

    if (error instanceof TypeError) {
      throw new XtreamError("network", MSG.network);
    }

    throw new XtreamError("network", MSG.network);
  }
}

async function callApi(
  server: string,
  username: string,
  password: string,
  action?: string,
  extra?: Record<string, any>,
): Promise<any> {
  return serialized(() => callApiNow(server, username, password, action, extra));
}

export async function authenticate(
  server: string,
  username: string,
  password: string,
  onStage?: (stage: Stage, detail?: string) => void,
): Promise<XtreamSession> {
  const normalizedServer = normalizeServer(server);
  onStage?.("checking", "Validando servidor...");
  onStage?.("connecting", "Conectando ao servidor Xtream...");
  try {
    const data = await callApi(normalizedServer, username, password);
    const userInfo = data?.user_info;
    if (!userInfo || typeof userInfo !== "object") {
      throw new XtreamError("incompatible", "Servidor incompatível com Xtream Codes/XUI.");
    }

    const auth = Number(userInfo.auth);
    const status = String(userInfo.status || "").toLowerCase();
    const exp = Number(userInfo.exp_date || 0);

    if (auth === 0 || auth === -1 || String(userInfo.auth) === "0") {
      throw new XtreamError("auth", MSG.auth);
    }

    if (status === "expired" || status === "banned" || status === "disabled" || status === "inactive") {
      throw new XtreamError("expired", MSG.expired);
    }

    if (exp > 0 && exp * 1000 < Date.now()) {
      throw new XtreamError("expired", MSG.expired);
    }

    onStage?.("validating", "Validando acesso do utilizador...");

    const serverInfo = await callApi(normalizedServer, username, password, "get_server_info").catch(() => ({}));
    const playbackBases: string[] = [];

    // Search candidate URLs; keep base server plus optional https port if provided
    playbackBases.push(normalizedServer);

    const hostInfo = serverInfo || {};
    const httpsPort = hostInfo.https_port;
    const httpPort = hostInfo.port;

    if (typeof httpsPort !== "undefined" && httpsPort !== null && String(httpsPort) !== "") {
      const proto = normalizedServer.startsWith("https://") ? "https" : "http";
      const host = normalizedServer.replace(/^https?:\/\//, "").split("/")[0];
      playbackBases.push(`${proto}://${host}:${httpsPort}`);
    }

    if (typeof httpPort !== "undefined" && httpPort !== null && String(httpPort) !== "") {
      const proto = normalizedServer.startsWith("https://") ? "https" : "http";
      const host = normalizedServer.replace(/^https?:\/\//, "").split("/")[0];
      playbackBases.push(`${proto}://${host}:${httpPort}`);
    }

    const session: XtreamSession = {
      server: normalizedServer,
      username,
      password,
      userInfo: userInfo as UserInfo,
      serverInfo: (serverInfo || {}) as ServerInfo,
      playbackBases: Array.from(new Set(playbackBases)),
      liveFormat: "m3u8",
      connectedAt: Date.now(),
    };

    onStage?.("done", "Conectado!");
    return session;
  } catch (error) {
    if (error instanceof XtreamError) {
      throw error;
    }
    throw new XtreamError("network", MSG.network);
  }
}

export const xtream = {
  async liveCategories(session: XtreamSession): Promise<Category[]> {
    const data = await callApi(session.server, session.username, session.password, "get_live_categories");
    return Array.isArray(data) ? data : [];
  },

  async liveStreams(
    session: XtreamSession,
    category?: string,
    search?: string,
    limit = 200,
    offset = 0,
  ): Promise<LiveStream[]> {
    const extra: Record<string, any> = {};
    if (category) extra.category_id = category;

    const data = await callApi(session.server, session.username, session.password, "get_live_streams", extra);
    if (!Array.isArray(data)) return [];

    let items = data as LiveStream[];
    if (search) {
      const s = search.toLowerCase();
      items = items.filter((x) => String(x.name || "").toLowerCase().includes(s));
    }

    const slice = items.slice(offset, offset + limit);
    return slice.map((x) => {
      const streamId = x.stream_id;
      const base = session.server;
      const url = streamId ? `${base}/live/${session.username}/${session.password}/${streamId}.ts` : null;
      return {
        ...x,
        playback_url: url,
      };
    });
  },

  async vodCategories(session: XtreamSession): Promise<Category[]> {
    const data = await callApi(session.server, session.username, session.password, "get_vod_categories");
    return Array.isArray(data) ? data : [];
  },

  async vodStreams(
    session: XtreamSession,
    category?: string,
    search?: string,
    limit = 200,
    offset = 0,
  ): Promise<VodStream[]> {
    const extra: Record<string, any> = {};
    if (category) extra.category_id = category;

    const data = await callApi(session.server, session.username, session.password, "get_vod_streams", extra);
    if (!Array.isArray(data)) return [];

    let items = data as VodStream[];
    if (search) {
      const s = search.toLowerCase();
      items = items.filter((x) => String(x.name || "").toLowerCase().includes(s));
    }

    const slice = items.slice(offset, offset + limit);
    return slice.map((x) => {
      const streamId = x.stream_id;
      const ext = x.container_extension || "mp4";
      const base = session.server;
      const url = streamId ? `${base}/movie/${session.username}/${session.password}/${streamId}.${ext}` : null;
      return {
        ...x,
        playback_url: url,
      };
    });
  },

  async seriesCategories(session: XtreamSession): Promise<Category[]> {
    const data = await callApi(session.server, session.username, session.password, "get_series_categories");
    return Array.isArray(data) ? data : [];
  },

  async series(
    session: XtreamSession,
    category?: string,
    search?: string,
    limit = 200,
    offset = 0,
  ): Promise<SeriesItem[]> {
    const extra: Record<string, any> = {};
    if (category) extra.category_id = category;

    const data = await callApi(session.server, session.username, session.password, "get_series", extra);
    if (!Array.isArray(data)) return [];

    let items = data as SeriesItem[];
    if (search) {
      const s = search.toLowerCase();
      items = items.filter((x) => String(x.name || "").toLowerCase().includes(s));
    }

    return items.slice(offset, offset + limit);
  },
};

export default xtream;