"""
GoldCast Streaming - Backend API
Handles IPTV list management (Xtream Codes, M3U URL, M3U file) with MongoDB persistence.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List as ListT, Optional, Literal, Any, Dict
import uuid
import httpx
from datetime import datetime, timezone
from urllib.parse import urlparse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="GoldCast Streaming API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("goldcast")


# ============================================================
# MODELS
# ============================================================
ListType = Literal["xtream", "m3u_url", "m3u_file"]
ListStatus = Literal["connected", "updating", "offline", "error"]


class ListMeta(BaseModel):
    channels_count: Optional[int] = None
    movies_count: Optional[int] = None
    series_count: Optional[int] = None
    expiration_date: Optional[str] = None
    max_connections: Optional[str] = None
    active_connections: Optional[str] = None


class IPTVList(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    name: str
    type: ListType
    server: Optional[str] = None
    username: Optional[str] = None
    m3u_url: Optional[str] = None
    status: ListStatus = "offline"
    meta: ListMeta = Field(default_factory=ListMeta)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_updated: Optional[str] = None


class XtreamCreate(BaseModel):
    device_id: str
    name: str
    server: str
    username: str
    password: str


class M3UUrlCreate(BaseModel):
    device_id: str
    name: str
    url: str


class M3UFileCreate(BaseModel):
    device_id: str
    name: str
    content: str  # raw M3U file content


class UpdateListReq(BaseModel):
    name: Optional[str] = None


# ============================================================
# HELPERS
# ============================================================
USER_FRIENDLY_ERRORS = {
    "dns": "Servidor não encontrado. Verifique o endereço.",
    "timeout": "Tempo esgotado ao conectar. Servidor demorou a responder.",
    "conn": "Falha na conexão. Verifique sua internet ou o servidor.",
    "auth": "Usuário ou senha inválidos.",
    "expired": "Sua conta está expirada.",
    "invalid_resp": "Servidor respondeu com formato inválido.",
    "incompatible": "Servidor incompatível com Xtream Codes.",
    "empty": "A lista está vazia.",
    "invalid_url": "URL inválida.",
    "invalid_m3u": "Arquivo M3U inválido ou vazio.",
    "blocked": "O servidor não respondeu à API Xtream (endereço incorreto ou acesso bloqueado para esta região).",
}


def normalize_server_url(server: str) -> str:
    """Normalize server URL - accept dominio.com, dominio.com:port, http/https://... Do not force https."""
    s = server.strip()
    if not s:
        raise HTTPException(400, USER_FRIENDLY_ERRORS["invalid_url"])
    # If no scheme, default to http (do not assume https)
    if not re.match(r"^https?://", s, re.IGNORECASE):
        s = "http://" + s
    parsed = urlparse(s)
    if not parsed.hostname:
        raise HTTPException(400, USER_FRIENDLY_ERRORS["invalid_url"])
    # Preserve user-provided port; rebuild cleanly (strip trailing slash / path)
    netloc = parsed.hostname
    if parsed.port:
        netloc = f"{parsed.hostname}:{parsed.port}"
    return f"{parsed.scheme}://{netloc}"


def sanitize_list(doc: dict) -> dict:
    """Remove Mongo _id & sensitive fields before returning to client."""
    if not doc:
        return doc
    out = {k: v for k, v in doc.items() if k not in ("_id", "password", "m3u_content")}
    return out


async def xtream_call(server: str, username: str, password: str, action: Optional[str] = None,
                      extra: Optional[Dict[str, Any]] = None, timeout: float = 15.0) -> Any:
    """Call Xtream Codes player_api.php endpoint."""
    params: Dict[str, Any] = {"username": username, "password": password}
    if action:
        params["action"] = action
    if extra:
        params.update(extra)
    url = f"{server}/player_api.php"
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as http:
            r = await http.get(url, params=params)
    except httpx.ConnectTimeout:
        raise HTTPException(504, USER_FRIENDLY_ERRORS["timeout"])
    except httpx.ReadTimeout:
        raise HTTPException(504, USER_FRIENDLY_ERRORS["timeout"])
    except httpx.ConnectError as e:
        msg = str(e).lower()
        if "name or service" in msg or "resolution" in msg or "getaddrinfo" in msg:
            raise HTTPException(502, USER_FRIENDLY_ERRORS["dns"])
        raise HTTPException(502, USER_FRIENDLY_ERRORS["conn"])
    except httpx.HTTPError:
        raise HTTPException(502, USER_FRIENDLY_ERRORS["conn"])

    if r.status_code >= 500:
        raise HTTPException(502, USER_FRIENDLY_ERRORS["conn"])
    if r.status_code in (403, 404):
        # XUI/Xtream panels answer 403/404 when the client IP/region is blocked or the API path is wrong
        raise HTTPException(502, USER_FRIENDLY_ERRORS["blocked"])
    if r.status_code >= 400:
        raise HTTPException(401, USER_FRIENDLY_ERRORS["auth"])

    try:
        return r.json()
    except Exception:
        raise HTTPException(502, USER_FRIENDLY_ERRORS["incompatible"])


def parse_m3u(text: str) -> Dict[str, Any]:
    """Parse M3U/M3U8 text into channels list. Returns dict{channels, groups}."""
    if not text or "#EXTM3U" not in text.split("\n", 1)[0].upper() and "#EXTINF" not in text:
        # Some lists omit #EXTM3U header; only reject if there are no EXTINF entries
        if "#EXTINF" not in text:
            raise HTTPException(400, USER_FRIENDLY_ERRORS["invalid_m3u"])

    channels: ListT[Dict[str, Any]] = []
    seen_urls: set = set()
    lines = text.splitlines()
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i].strip()
        if line.startswith("#EXTINF"):
            # Parse attributes
            attrs: Dict[str, str] = {}
            for m in re.finditer(r'([a-zA-Z0-9\-]+)="([^"]*)"', line):
                attrs[m.group(1).lower()] = m.group(2)
            # Name after comma
            name_match = re.search(r",(.+)$", line)
            display_name = name_match.group(1).strip() if name_match else attrs.get("tvg-name", "Sem nome")
            # Find next non-comment line as URL
            j = i + 1
            stream_url = None
            while j < n:
                cand = lines[j].strip()
                if cand and not cand.startswith("#"):
                    stream_url = cand
                    break
                j += 1
            if stream_url and stream_url not in seen_urls:
                seen_urls.add(stream_url)
                channels.append({
                    "id": str(uuid.uuid4()),
                    "name": display_name,
                    "logo": attrs.get("tvg-logo"),
                    "group": attrs.get("group-title") or "Sem categoria",
                    "streamUrl": stream_url,
                    "tvgId": attrs.get("tvg-id"),
                    "language": attrs.get("tvg-language"),
                    "country": attrs.get("tvg-country"),
                })
            i = j + 1 if stream_url else i + 1
        else:
            i += 1

    if not channels:
        raise HTTPException(400, USER_FRIENDLY_ERRORS["empty"])

    groups = sorted({c["group"] for c in channels if c.get("group")})
    return {"channels": channels, "groups": groups}


async def fetch_url_text(url: str, timeout: float = 30.0) -> str:
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as http:
            r = await http.get(url)
    except httpx.ConnectTimeout:
        raise HTTPException(504, USER_FRIENDLY_ERRORS["timeout"])
    except httpx.ReadTimeout:
        raise HTTPException(504, USER_FRIENDLY_ERRORS["timeout"])
    except httpx.ConnectError:
        raise HTTPException(502, USER_FRIENDLY_ERRORS["dns"])
    except httpx.HTTPError:
        raise HTTPException(502, USER_FRIENDLY_ERRORS["conn"])
    if r.status_code >= 400:
        raise HTTPException(502, USER_FRIENDLY_ERRORS["conn"])
    return r.text


# ============================================================
# ROUTES
# ============================================================
@api.get("/")
async def root():
    return {"app": "GoldCast Streaming", "status": "ok"}


# ---- Create Xtream Codes list ----
@api.post("/lists/xtream")
async def create_xtream_list(body: XtreamCreate):
    server = normalize_server_url(body.server)
    if not body.username or not body.password:
        raise HTTPException(400, USER_FRIENDLY_ERRORS["auth"])

    data = await xtream_call(server, body.username, body.password)
    user_info = data.get("user_info") if isinstance(data, dict) else None
    if not user_info:
        raise HTTPException(502, USER_FRIENDLY_ERRORS["incompatible"])

    auth = user_info.get("auth")
    status = str(user_info.get("status", "")).lower()
    if auth == 0 or auth is False:
        raise HTTPException(401, USER_FRIENDLY_ERRORS["auth"])
    if status in ("expired", "banned", "disabled"):
        raise HTTPException(401, USER_FRIENDLY_ERRORS["expired"])

    exp = user_info.get("exp_date")
    exp_iso = None
    if exp:
        try:
            exp_iso = datetime.fromtimestamp(int(exp), tz=timezone.utc).isoformat()
        except Exception:
            exp_iso = None

    now_iso = datetime.now(timezone.utc).isoformat()
    list_id = str(uuid.uuid4())
    doc = {
        "id": list_id,
        "device_id": body.device_id,
        "name": body.name.strip() or "Minha Lista",
        "type": "xtream",
        "server": server,
        "username": body.username,
        "password": body.password,  # stored server-side for API calls; never returned to client
        "status": "connected",
        "meta": {
            "expiration_date": exp_iso,
            "max_connections": str(user_info.get("max_connections") or "") or None,
            "active_connections": str(user_info.get("active_cons") or "") or None,
        },
        "created_at": now_iso,
        "last_updated": now_iso,
    }
    await db.lists.insert_one(doc)

    # Fire-and-forget: fetch counts
    asyncio.create_task(_refresh_xtream_counts(list_id))
    return sanitize_list(doc)


async def _refresh_xtream_counts(list_id: str):
    doc = await db.lists.find_one({"id": list_id})
    if not doc or doc.get("type") != "xtream":
        return
    try:
        server = doc["server"]; u = doc["username"]; p = doc["password"]
        live = await xtream_call(server, u, p, "get_live_streams")
        vod = await xtream_call(server, u, p, "get_vod_streams")
        series = await xtream_call(server, u, p, "get_series")
        meta = doc.get("meta", {})
        meta["channels_count"] = len(live) if isinstance(live, list) else None
        meta["movies_count"] = len(vod) if isinstance(vod, list) else None
        meta["series_count"] = len(series) if isinstance(series, list) else None
        await db.lists.update_one({"id": list_id}, {"$set": {
            "meta": meta,
            "status": "connected",
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }})
    except Exception as e:
        logger.warning(f"refresh counts failed: {e}")


# ---- Create M3U URL list ----
@api.post("/lists/m3u-url")
async def create_m3u_url_list(body: M3UUrlCreate):
    url = body.url.strip()
    if not re.match(r"^https?://", url, re.IGNORECASE):
        raise HTTPException(400, USER_FRIENDLY_ERRORS["invalid_url"])
    text = await fetch_url_text(url)
    parsed = parse_m3u(text)
    now = datetime.now(timezone.utc).isoformat()
    list_id = str(uuid.uuid4())
    doc = {
        "id": list_id,
        "device_id": body.device_id,
        "name": body.name.strip() or "Minha Lista M3U",
        "type": "m3u_url",
        "m3u_url": url,
        "status": "connected",
        "meta": {"channels_count": len(parsed["channels"])},
        "created_at": now,
        "last_updated": now,
    }
    await db.lists.insert_one(doc)
    # Store channels separately
    await _store_channels(list_id, parsed["channels"])
    return sanitize_list(doc)


# ---- Create M3U file list ----
@api.post("/lists/m3u-file")
async def create_m3u_file_list(body: M3UFileCreate):
    parsed = parse_m3u(body.content)
    now = datetime.now(timezone.utc).isoformat()
    list_id = str(uuid.uuid4())
    doc = {
        "id": list_id,
        "device_id": body.device_id,
        "name": body.name.strip() or "Minha Lista",
        "type": "m3u_file",
        "status": "connected",
        "meta": {"channels_count": len(parsed["channels"])},
        "created_at": now,
        "last_updated": now,
    }
    await db.lists.insert_one(doc)
    await _store_channels(list_id, parsed["channels"])
    return sanitize_list(doc)


async def _store_channels(list_id: str, channels: ListT[Dict[str, Any]]):
    # Clear existing then insert; chunked
    await db.channels.delete_many({"list_id": list_id})
    if not channels:
        return
    docs = [{**c, "list_id": list_id} for c in channels]
    # Insert in chunks to avoid huge single ops
    CHUNK = 2000
    for i in range(0, len(docs), CHUNK):
        await db.channels.insert_many(docs[i:i + CHUNK])


# ---- List all lists for a device ----
@api.get("/lists")
async def list_lists(device_id: str = Query(...)):
    cursor = db.lists.find({"device_id": device_id}, {"_id": 0, "password": 0}).sort("created_at", -1)
    docs = await cursor.to_list(500)
    return docs


@api.get("/lists/{list_id}")
async def get_list(list_id: str):
    doc = await db.lists.find_one({"id": list_id}, {"_id": 0, "password": 0})
    if not doc:
        raise HTTPException(404, "Lista não encontrada")
    return doc


@api.delete("/lists/{list_id}")
async def delete_list(list_id: str):
    res = await db.lists.delete_one({"id": list_id})
    await db.channels.delete_many({"list_id": list_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Lista não encontrada")
    return {"ok": True}


@api.patch("/lists/{list_id}")
async def update_list(list_id: str, body: UpdateListReq):
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(400, "Sem alterações")
    await db.lists.update_one({"id": list_id}, {"$set": updates})
    doc = await db.lists.find_one({"id": list_id}, {"_id": 0, "password": 0})
    if not doc:
        raise HTTPException(404, "Lista não encontrada")
    return doc


@api.post("/lists/{list_id}/refresh")
async def refresh_list(list_id: str):
    doc = await db.lists.find_one({"id": list_id})
    if not doc:
        raise HTTPException(404, "Lista não encontrada")
    await db.lists.update_one({"id": list_id}, {"$set": {"status": "updating"}})
    try:
        if doc["type"] == "xtream":
            await _refresh_xtream_counts(list_id)
        elif doc["type"] == "m3u_url":
            text = await fetch_url_text(doc["m3u_url"])
            parsed = parse_m3u(text)
            await _store_channels(list_id, parsed["channels"])
            await db.lists.update_one({"id": list_id}, {"$set": {
                "meta.channels_count": len(parsed["channels"]),
                "status": "connected",
                "last_updated": datetime.now(timezone.utc).isoformat(),
            }})
    except HTTPException:
        await db.lists.update_one({"id": list_id}, {"$set": {"status": "error"}})
        raise
    updated = await db.lists.find_one({"id": list_id}, {"_id": 0, "password": 0})
    return updated


# ---- Content endpoints ----
async def _get_list_or_404(list_id: str) -> dict:
    doc = await db.lists.find_one({"id": list_id})
    if not doc:
        raise HTTPException(404, "Lista não encontrada")
    return doc


@api.get("/lists/{list_id}/live-categories")
async def live_categories(list_id: str):
    doc = await _get_list_or_404(list_id)
    if doc["type"] == "xtream":
        cats = await xtream_call(doc["server"], doc["username"], doc["password"], "get_live_categories")
        return cats if isinstance(cats, list) else []
    # M3U
    groups = await db.channels.distinct("group", {"list_id": list_id})
    return [{"category_id": g, "category_name": g} for g in sorted(groups) if g]


@api.get("/lists/{list_id}/live-streams")
async def live_streams(list_id: str, category: Optional[str] = None, search: Optional[str] = None,
                       limit: int = 200, offset: int = 0):
    doc = await _get_list_or_404(list_id)
    if doc["type"] == "xtream":
        extra: Dict[str, Any] = {}
        if category:
            extra["category_id"] = category
        streams = await xtream_call(doc["server"], doc["username"], doc["password"], "get_live_streams", extra)
        if not isinstance(streams, list):
            return []
        if search:
            s = search.lower()
            streams = [x for x in streams if s in str(x.get("name", "")).lower()]
        # Attach stream_url for playback
        base = doc["server"]; u = doc["username"]; p = doc["password"]
        for x in streams[offset:offset + limit]:
            sid = x.get("stream_id")
            ext = x.get("stream_type", "ts")
            x["playback_url"] = f"{base}/live/{u}/{p}/{sid}.ts" if sid else None
        return streams[offset:offset + limit]
    # M3U
    query: Dict[str, Any] = {"list_id": list_id}
    if category:
        query["group"] = category
    if search:
        query["name"] = {"$regex": re.escape(search), "$options": "i"}
    docs = await db.channels.find(query, {"_id": 0, "list_id": 0}).skip(offset).limit(limit).to_list(limit)
    for d in docs:
        d["playback_url"] = d.get("streamUrl")
    return docs


@api.get("/lists/{list_id}/vod-categories")
async def vod_categories(list_id: str):
    doc = await _get_list_or_404(list_id)
    if doc["type"] != "xtream":
        return []
    cats = await xtream_call(doc["server"], doc["username"], doc["password"], "get_vod_categories")
    return cats if isinstance(cats, list) else []


@api.get("/lists/{list_id}/vod-streams")
async def vod_streams(list_id: str, category: Optional[str] = None, search: Optional[str] = None,
                     limit: int = 200, offset: int = 0):
    doc = await _get_list_or_404(list_id)
    if doc["type"] != "xtream":
        return []
    extra: Dict[str, Any] = {}
    if category:
        extra["category_id"] = category
    streams = await xtream_call(doc["server"], doc["username"], doc["password"], "get_vod_streams", extra)
    if not isinstance(streams, list):
        return []
    if search:
        s = search.lower()
        streams = [x for x in streams if s in str(x.get("name", "")).lower()]
    base = doc["server"]; u = doc["username"]; p = doc["password"]
    for x in streams[offset:offset + limit]:
        sid = x.get("stream_id")
        ext = x.get("container_extension") or "mp4"
        x["playback_url"] = f"{base}/movie/{u}/{p}/{sid}.{ext}" if sid else None
    return streams[offset:offset + limit]


@api.get("/lists/{list_id}/series-categories")
async def series_categories(list_id: str):
    doc = await _get_list_or_404(list_id)
    if doc["type"] != "xtream":
        return []
    cats = await xtream_call(doc["server"], doc["username"], doc["password"], "get_series_categories")
    return cats if isinstance(cats, list) else []


@api.get("/lists/{list_id}/series-streams")
async def series_streams(list_id: str, category: Optional[str] = None, search: Optional[str] = None,
                        limit: int = 200, offset: int = 0):
    doc = await _get_list_or_404(list_id)
    if doc["type"] != "xtream":
        return []
    extra: Dict[str, Any] = {}
    if category:
        extra["category_id"] = category
    series = await xtream_call(doc["server"], doc["username"], doc["password"], "get_series", extra)
    if not isinstance(series, list):
        return []
    if search:
        s = search.lower()
        series = [x for x in series if s in str(x.get("name", "")).lower()]
    return series[offset:offset + limit]


# ============================================================
# XTREAM / XUI PROXY (used by the web preview only; native devices call the panel directly)
# ============================================================
class XtreamProxyReq(BaseModel):
    server: str
    username: str
    password: str
    action: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


@api.post("/xtream/proxy")
async def xtream_proxy(body: XtreamProxyReq):
    """Forward a player_api.php call. Credentials are never logged or persisted here."""
    server = normalize_server_url(body.server)
    logger.info("xtream proxy -> %s action=%s", urlparse(server).hostname, body.action or "auth")
    data = await xtream_call(server, body.username, body.password, body.action, body.extra, timeout=40.0)
    return JSONResponse(content=data)


# ============================================================
# PANEL INTEGRATION (kOfficePanel) — CONFIGURAÇÃO PENDENTE
# ============================================================
from panel_integration import panel_client  # noqa: E402


@api.get("/panel/status")
async def panel_status():
    return panel_client.describe()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
