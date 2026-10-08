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
  if (Platform.OS ===
