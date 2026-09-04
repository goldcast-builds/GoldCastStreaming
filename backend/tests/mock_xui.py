"""
TEST FIXTURE ONLY — mock XUI/Xtream panel used to exercise the app flow while the real panel
blocks requests coming from outside Brazil. Never referenced by the app itself.
Run: python3 tests/mock_xui.py  (listens on 127.0.0.1:8099)
"""
import base64
import time
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse, PlainTextResponse
import uvicorn

app = FastAPI()
USER, PASS = "testuser", "testpass"
EXPIRED_USER = "expired"
HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
MP4 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
NOW = int(time.time())


def b64(s: str) -> str:
    return base64.b64encode(s.encode()).decode()


def user_info(status="Active", exp=NOW + 86400 * 120, trial=0):
    return {
        "username": USER, "password": PASS, "message": "", "auth": 1, "status": status,
        "exp_date": str(exp), "is_trial": str(trial), "active_cons": "0", "created_at": str(NOW - 86400 * 30),
        "max_connections": "1", "allowed_output_formats": ["m3u8", "ts"],
    }


SERVER_INFO = {"xui": True, "version": "1.5.5", "revision": 2, "url": "127.0.0.1", "port": "8099", "https_port": "8099",
               "server_protocol": "http", "rtmp_port": "8880", "timezone": "America/Sao_Paulo", "timestamp_now": NOW}

LIVE_CATS = [{"category_id": "1", "category_name": "Esportes", "parent_id": 0},
             {"category_id": "2", "category_name": "Notícias", "parent_id": 0},
             {"category_id": "3", "category_name": "Infantil", "parent_id": 0}]
LIVE = [{"num": i + 1, "name": f"Canal {i + 1} {'HD' if i % 2 else 'FHD'}", "stream_type": "live", "stream_id": 1000 + i,
         "stream_icon": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Television_icon.svg/120px-Television_icon.svg.png",
         "epg_channel_id": f"canal{i + 1}.br", "added": str(NOW), "category_id": str((i % 3) + 1), "category_ids": [(i % 3) + 1],
         "custom_sid": "", "tv_archive": 0, "direct_source": "", "tv_archive_duration": 0} for i in range(120)]
VOD_CATS = [{"category_id": "10", "category_name": "Ação", "parent_id": 0}, {"category_id": "11", "category_name": "Animação", "parent_id": 0}]
VOD = [{"num": i + 1, "name": f"Filme Exemplo {i + 1}", "stream_type": "movie", "stream_id": 5000 + i,
        "stream_icon": "https://peach.blender.org/wp-content/uploads/bbb-splash.png", "rating": "7.5", "rating_5based": 3.8,
        "added": str(NOW), "category_id": "10" if i % 2 else "11", "container_extension": "mp4", "year": "2008", "genre": "Animação"} for i in range(30)]
SERIES_CATS = [{"category_id": "20", "category_name": "Drama", "parent_id": 0}]
SERIES = [{"num": i + 1, "name": f"Série Exemplo {i + 1}", "series_id": 7000 + i, "cover": "https://peach.blender.org/wp-content/uploads/bbb-splash.png",
           "plot": "Uma série de exemplo para testes.", "cast": "Elenco", "director": "", "genre": "Drama", "releaseDate": "2020-01-01",
           "rating": "8", "category_id": "20", "episode_run_time": "10"} for i in range(6)]


@app.get("/player_api.php")
async def player_api(username: str = "", password: str = "", action: str = None, category_id: str = None,
                     vod_id: str = None, series_id: str = None, stream_id: str = None, limit: int = 4):
    if username == EXPIRED_USER and password == PASS:
        return {"user_info": {**user_info(status="Expired", exp=NOW - 100), "username": EXPIRED_USER}, "server_info": SERVER_INFO}
    if username != USER or password != PASS:
        return {"user_info": {"auth": 0}}
    if not action:
        return {"user_info": user_info(), "server_info": SERVER_INFO}
    if action == "get_live_categories":
        return LIVE_CATS
    if action == "get_live_streams":
        return [x for x in LIVE if not category_id or x["category_id"] == category_id]
    if action == "get_vod_categories":
        return VOD_CATS
    if action == "get_vod_streams":
        return [x for x in VOD if not category_id or x["category_id"] == category_id]
    if action == "get_vod_info":
        v = next((x for x in VOD if str(x["stream_id"]) == str(vod_id)), VOD[0])
        return {"info": {"movie_image": v["stream_icon"], "plot": "Big Buck Bunny é um curta de animação de código aberto.", "cast": "Coelho",
                         "director": "Sacha Goedegebure", "genre": "Animação", "releasedate": "2008-04-10", "duration": "00:10:34", "rating": "7.5"},
                "movie_data": {"stream_id": v["stream_id"], "name": v["name"], "container_extension": "mp4", "category_id": v["category_id"]}}
    if action == "get_series_categories":
        return SERIES_CATS
    if action == "get_series":
        return SERIES
    if action == "get_series_info":
        s = next((x for x in SERIES if str(x["series_id"]) == str(series_id)), SERIES[0])
        eps = {str(se): [{"id": f"{s['series_id']}{se}{e}", "episode_num": e, "title": f"Episódio {e}", "container_extension": "mp4", "season": se,
                          "info": {"plot": "Descrição do episódio.", "duration": "00:10:34", "movie_image": s["cover"], "releasedate": "2020-01-01"}} for e in range(1, 4)] for se in (1, 2)}
        return {"seasons": [{"season_number": 1, "name": "Temporada 1"}, {"season_number": 2, "name": "Temporada 2"}], "info": s, "episodes": eps}
    if action == "get_short_epg":
        start = NOW - 900
        return {"epg_listings": [
            {"id": "1", "epg_id": "1", "title": b64("Programa Atual"), "lang": "", "start": "", "end": "", "description": b64("Descrição do programa atual."),
             "channel_id": "canal1.br", "start_timestamp": str(start), "stop_timestamp": str(start + 3600)},
            {"id": "2", "epg_id": "1", "title": b64("Próximo Programa"), "lang": "", "start": "", "end": "", "description": b64("Descrição."),
             "channel_id": "canal1.br", "start_timestamp": str(start + 3600), "stop_timestamp": str(start + 7200)},
        ]}
    return []


@app.get("/live/{u}/{p}/{sid}.{ext}")
async def live(u: str, p: str, sid: str, ext: str):
    # Redirect to a public test stream; channel 1005 simulates an unavailable stream
    if sid == "1005":
        return PlainTextResponse("not found", status_code=404)
    return JSONResponse(status_code=302, content=None, headers={"Location": HLS})


@app.get("/movie/{u}/{p}/{sid}.{ext}")
@app.get("/series/{u}/{p}/{sid}.{ext}")
async def vod(u: str, p: str, sid: str, ext: str):
    return JSONResponse(status_code=302, content=None, headers={"Location": MP4})


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8099, log_level="warning")
