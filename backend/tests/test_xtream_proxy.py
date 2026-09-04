"""Tests for XUI/Xtream proxy + panel status + existing lists endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://goldcast-player.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MOCK = "127.0.0.1:8099"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s


# ---------------- Xtream proxy: happy path (auth) ----------------
def test_xtream_proxy_auth_ok(client):
    r = client.post(f"{API}/xtream/proxy", json={
        "server": MOCK, "username": "testuser", "password": "testpass"
    }, timeout=45)
    assert r.status_code == 200, r.text[:200]
    data = r.json()
    ui = data.get("user_info") or {}
    assert ui.get("auth") == 1
    assert ui.get("status") == "Active"
    assert data.get("server_info", {}).get("xui") is True


def test_xtream_proxy_get_live_streams_120(client):
    r = client.post(f"{API}/xtream/proxy", json={
        "server": MOCK, "username": "testuser", "password": "testpass",
        "action": "get_live_streams"
    }, timeout=45)
    assert r.status_code == 200, r.text[:200]
    arr = r.json()
    assert isinstance(arr, list)
    assert len(arr) == 120
    assert arr[0]["stream_id"] == 1000
    assert arr[0]["name"] == "Canal 1 FHD"


def test_xtream_proxy_wrong_creds_auth0(client):
    r = client.post(f"{API}/xtream/proxy", json={
        "server": MOCK, "username": "bad", "password": "x"
    }, timeout=45)
    assert r.status_code == 200, r.text[:200]
    data = r.json()
    ui = data.get("user_info") or {}
    assert ui.get("auth") == 0


def test_xtream_proxy_expired_returns_status(client):
    r = client.post(f"{API}/xtream/proxy", json={
        "server": MOCK, "username": "expired", "password": "testpass"
    }, timeout=45)
    assert r.status_code == 200
    ui = (r.json().get("user_info") or {})
    # Mock returns auth=1 + status Expired for the expired user
    assert ui.get("status", "").lower() == "expired"


# ---------------- Xtream proxy: real geo-blocked server -> 502 friendly ----------------
def test_xtream_proxy_real_server_reachable_or_friendly_502(client):
    """From this container the real panel may or may not be geo-blocked; both cases must be handled gracefully."""
    r = client.post(f"{API}/xtream/proxy", json={
        "server": "http://dpvizzion.shop:8080",
        "username": "163887491222", "password": "992787103586"
    }, timeout=60)
    assert r.status_code in (200, 502, 504), r.text[:200]
    ct = r.headers.get("content-type", "")
    assert "application/json" in ct
    body = r.json()
    if r.status_code == 200:
        assert "user_info" in body
    else:
        detail = body.get("detail", "")
        assert isinstance(detail, str) and "Traceback" not in detail and len(detail) > 0


# ---------------- Panel status ----------------
def test_panel_status_not_configured(client):
    r = client.get(f"{API}/panel/status", timeout=15)
    assert r.status_code == 200
    data = r.json()
    # Expect configured=false (kOfficePanel not configured)
    assert data.get("configured") is False


# ---------------- Existing /api/lists still works ----------------
def test_lists_get_still_works(client):
    r = client.get(f"{API}/lists", params={"device_id": "regression-device"}, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
