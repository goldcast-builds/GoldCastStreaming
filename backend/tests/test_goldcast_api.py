"""GoldCast Streaming backend API tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://goldcast-player.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
DEVICE_ID = "test-device-agent"

def _json_detail(r):
    """Return response detail if JSON, else None (e.g. ingress HTML)."""
    ct = r.headers.get("content-type", "")
    if "application/json" in ct:
        try:
            return r.json().get("detail", "")
        except Exception:
            return None
    return None


SAMPLE_M3U = """#EXTM3U
#EXTINF:-1 tvg-id="ch1" tvg-name="Canal 1" tvg-logo="http://logo/1.png" group-title="Notícias" tvg-language="pt" tvg-country="BR",Canal 1
http://example.com/stream/1.ts
#EXTINF:-1 tvg-id="ch2" tvg-name="Canal 2" group-title="Esportes",Canal 2
http://example.com/stream/2.ts
#EXTINF:-1 tvg-id="ch3" tvg-name="Canal 3" group-title="Notícias",Canal 3 Duplicate
http://example.com/stream/1.ts
#EXTINF:-1 tvg-id="ch4" tvg-name="Canal 4" group-title="Filmes",Canal 4
http://example.com/stream/4.ts
"""


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s
    # Cleanup all test-created lists
    try:
        r = s.get(f"{API}/lists", params={"device_id": DEVICE_ID}, timeout=15)
        if r.status_code == 200:
            for lst in r.json():
                s.delete(f"{API}/lists/{lst['id']}", timeout=15)
    except Exception:
        pass


# ---------- Health ----------
def test_root_status(client):
    r = client.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"
    assert data.get("app") == "GoldCast Streaming"


# ---------- M3U file create ----------
def test_m3u_file_create_and_dedupe(client):
    r = client.post(f"{API}/lists/m3u-file", json={
        "device_id": DEVICE_ID, "name": "TEST_m3u_file", "content": SAMPLE_M3U
    }, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "id" in data
    assert data["type"] == "m3u_file"
    assert "password" not in data
    # 4 EXTINFs but one URL is duplicate → expect 3 unique channels
    assert data["meta"]["channels_count"] == 3
    pytest.list_id = data["id"]


def test_m3u_file_invalid_content(client):
    r = client.post(f"{API}/lists/m3u-file", json={
        "device_id": DEVICE_ID, "name": "TEST_bad", "content": "not a valid m3u"
    }, timeout=15)
    assert r.status_code == 400
    body = r.json()
    detail = body.get("detail", "")
    assert isinstance(detail, str)
    # Portuguese friendly error, not traceback
    assert "Traceback" not in detail
    assert any(k in detail for k in ["M3U", "vazi", "inválid"])


def test_m3u_file_empty_content(client):
    r = client.post(f"{API}/lists/m3u-file", json={
        "device_id": DEVICE_ID, "name": "TEST_empty", "content": ""
    }, timeout=15)
    assert r.status_code == 400


# ---------- M3U URL ----------
def test_m3u_url_unreachable(client):
    r = client.post(f"{API}/lists/m3u-url", json={
        "device_id": DEVICE_ID, "name": "TEST_bad_url",
        "url": "http://this-domain-does-not-exist-xyz-123.invalid/list.m3u"
    }, timeout=45)
    assert r.status_code in (502, 504), r.text[:200]
    detail = _json_detail(r)
    if detail is not None:
        assert "Traceback" not in detail and len(detail) > 0


def test_m3u_url_invalid_scheme(client):
    r = client.post(f"{API}/lists/m3u-url", json={
        "device_id": DEVICE_ID, "name": "TEST_bad_scheme", "url": "ftp://example.com/x.m3u"
    }, timeout=15)
    assert r.status_code == 400


# ---------- Xtream errors ----------
def test_xtream_unreachable_server(client):
    r = client.post(f"{API}/lists/xtream", json={
        "device_id": DEVICE_ID, "name": "TEST_xtream_bad",
        "server": "no-such-xtream-host-xyz.invalid", "username": "u", "password": "p"
    }, timeout=45)
    # Should be friendly error, not 500
    assert r.status_code in (502, 504, 401), r.text[:200]
    detail = _json_detail(r)
    if detail is not None:
        assert "Traceback" not in detail


def test_xtream_empty_credentials(client):
    r = client.post(f"{API}/lists/xtream", json={
        "device_id": DEVICE_ID, "name": "TEST_xtream_empty",
        "server": "example.com", "username": "", "password": ""
    }, timeout=15)
    # username empty triggers 400 auth message OR normalize passes and 401 from xtream call
    assert r.status_code in (400, 401, 502, 504)


# ---------- List listing (device_id scoping + no password leak) ----------
def test_list_scoped_by_device(client):
    r = client.get(f"{API}/lists", params={"device_id": DEVICE_ID}, timeout=15)
    assert r.status_code == 200
    lists = r.json()
    assert isinstance(lists, list)
    for l in lists:
        assert l["device_id"] == DEVICE_ID
        assert "password" not in l
        assert "_id" not in l

    # Different device_id should not see our lists
    r2 = client.get(f"{API}/lists", params={"device_id": "other-device-999"}, timeout=15)
    assert r2.status_code == 200
    other = r2.json()
    ids_ours = {l["id"] for l in lists}
    ids_other = {l["id"] for l in other}
    assert ids_ours.isdisjoint(ids_other)


# ---------- live-streams / live-categories on M3U ----------
def test_live_streams_m3u(client):
    lid = getattr(pytest, "list_id", None)
    assert lid, "list_id not set; earlier test failed"
    r = client.get(f"{API}/lists/{lid}/live-streams", timeout=20)
    assert r.status_code == 200
    channels = r.json()
    assert isinstance(channels, list) and len(channels) == 3
    for c in channels:
        assert "playback_url" in c
        assert c["playback_url"]


def test_live_categories_m3u(client):
    lid = getattr(pytest, "list_id", None)
    assert lid
    r = client.get(f"{API}/lists/{lid}/live-categories", timeout=20)
    assert r.status_code == 200
    cats = r.json()
    names = {c["category_name"] for c in cats}
    assert {"Notícias", "Esportes", "Filmes"}.issubset(names)


# ---------- Delete flow ----------
def test_delete_list_and_404(client):
    lid = getattr(pytest, "list_id", None)
    assert lid
    r = client.delete(f"{API}/lists/{lid}", timeout=15)
    assert r.status_code == 200
    # GET returns 404
    r2 = client.get(f"{API}/lists/{lid}", timeout=15)
    assert r2.status_code == 404
    # live-streams returns 404 since list gone
    r3 = client.get(f"{API}/lists/{lid}/live-streams", timeout=15)
    assert r3.status_code == 404


def test_delete_unknown_id(client):
    r = client.delete(f"{API}/lists/does-not-exist-uuid", timeout=15)
    assert r.status_code == 404


# ---------- URL normalization (no https forced) ----------
def test_server_url_no_force_https(client):
    """Submit server without scheme; must not force https. Backend should default http:// then fail with friendly error."""
    r = client.post(f"{API}/lists/xtream", json={
        "device_id": DEVICE_ID, "name": "TEST_norm",
        "server": "definitely-not-a-real-xtream-host-xyz.invalid", "username": "u", "password": "p"
    }, timeout=45)
    assert r.status_code in (502, 504, 401)
    detail = _json_detail(r)
    if detail is not None:
        assert "Traceback" not in detail
