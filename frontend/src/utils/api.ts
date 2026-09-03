import { getDeviceId } from "./device";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

if (!BASE_URL) {
  console.warn("EXPO_PUBLIC_BACKEND_URL missing");
}

async function request<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}/api${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text }; }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `Erro ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : "Erro desconhecido");
  }
  return data as T;
}

export type ListType = "xtream" | "m3u_url" | "m3u_file";
export interface IPTVList {
  id: string;
  device_id: string;
  name: string;
  type: ListType;
  server?: string;
  username?: string;
  m3u_url?: string;
  status: "connected" | "updating" | "offline" | "error";
  meta: {
    channels_count?: number | null;
    movies_count?: number | null;
    series_count?: number | null;
    expiration_date?: string | null;
    max_connections?: string | null;
    active_connections?: string | null;
  };
  created_at: string;
  last_updated?: string | null;
}

export async function listLists(): Promise<IPTVList[]> {
  const deviceId = await getDeviceId();
  return request(`/lists?device_id=${encodeURIComponent(deviceId)}`);
}

export async function createXtream(input: { name: string; server: string; username: string; password: string; }): Promise<IPTVList> {
  const device_id = await getDeviceId();
  return request(`/lists/xtream`, { method: "POST", body: JSON.stringify({ device_id, ...input }) });
}

export async function createM3UUrl(input: { name: string; url: string; }): Promise<IPTVList> {
  const device_id = await getDeviceId();
  return request(`/lists/m3u-url`, { method: "POST", body: JSON.stringify({ device_id, ...input }) });
}

export async function createM3UFile(input: { name: string; content: string; }): Promise<IPTVList> {
  const device_id = await getDeviceId();
  return request(`/lists/m3u-file`, { method: "POST", body: JSON.stringify({ device_id, ...input }) });
}

export async function deleteList(id: string): Promise<{ ok: boolean }> {
  return request(`/lists/${id}`, { method: "DELETE" });
}

export async function refreshList(id: string): Promise<IPTVList> {
  return request(`/lists/${id}/refresh`, { method: "POST" });
}

export interface Category { category_id: string; category_name: string; }

export async function getLiveCategories(listId: string): Promise<Category[]> {
  return request(`/lists/${listId}/live-categories`);
}
export async function getLiveStreams(listId: string, params: { category?: string; search?: string; limit?: number; offset?: number; } = {}): Promise<any[]> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.search) qs.set("search", params.search);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  return request(`/lists/${listId}/live-streams?${qs.toString()}`);
}
export async function getVodCategories(listId: string): Promise<Category[]> {
  return request(`/lists/${listId}/vod-categories`);
}
export async function getVodStreams(listId: string, params: { category?: string; search?: string; limit?: number; offset?: number; } = {}): Promise<any[]> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.search) qs.set("search", params.search);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  return request(`/lists/${listId}/vod-streams?${qs.toString()}`);
}
export async function getSeriesCategories(listId: string): Promise<Category[]> {
  return request(`/lists/${listId}/series-categories`);
}
export async function getSeriesStreams(listId: string, params: { category?: string; search?: string; limit?: number; offset?: number; } = {}): Promise<any[]> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.search) qs.set("search", params.search);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  return request(`/lists/${listId}/series-streams?${qs.toString()}`);
}

const ACTIVE_KEY = "goldcast_active_list";
import AsyncStorage from "@react-native-async-storage/async-storage";
export async function setActiveListId(id: string | null): Promise<void> {
  if (!id) return AsyncStorage.removeItem(ACTIVE_KEY);
  return AsyncStorage.setItem(ACTIVE_KEY, id);
}
export async function getActiveListId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_KEY);
}
