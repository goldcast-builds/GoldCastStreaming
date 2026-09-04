# GoldCast Streaming — PRD

## Overview
Premium mobile IPTV player app (React Native / Expo) with dark cinematic UI and gold accents. Supports Xtream Codes, M3U URL, and M3U file lists with a bottom-tab navigation (Início, TV ao vivo, Filmes, Séries, Configurações) and expo-video playback.

## Features Delivered (MVP)
- Splash screen with official GoldCast Streaming logo + subtle gold shine animation, auto-transitions to Home.
- Home screen: logo header, welcome copy, primary gold CTA (+ ADICIONAR LISTA), "Minhas listas" section with cards showing status, channels/movies/series counts and expiration date (only when server returns them).
- Add List modal with 3 methods:
  - Xtream Codes (name, server, user, password) — real API validation via `/player_api.php`, status stages (Conectando/Validando/Autenticando/Carregando/Conectado).
  - M3U URL — downloads and parses list asynchronously.
  - Arquivo M3U — picks .m3u/.m3u8 via expo-document-picker and parses locally.
- Robust M3U parser (EXTM3U/EXTINF, tvg-id/tvg-name/tvg-logo/group-title/tvg-language/tvg-country), deduplicates URLs.
- Server URL normalization (accepts dominio.com, dominio.com:port, http/https://). Never assumes HTTPS.
- Bottom tab navigation (5 tabs) with gold-highlighted selected tab.
- Live TV: sticky horizontal category chips + 2-col channel grid, search box, list switcher.
- Filmes: 3-col poster grid with 2:3 aspect + scrim, categories chip row (Xtream only).
- Séries: same as Filmes (Xtream only).
- Settings: manage lists (activate/refresh/delete), app info, logo.
- Video Player: expo-video full-screen with native controls and top overlay for back/title.
- Android TV / TV Box support via `borderStrong` focus rings on cards, chips, buttons.

## Backend (FastAPI + MongoDB)
- `POST /api/lists/xtream|m3u-url|m3u-file` — create list (validates + fetches)
- `GET /api/lists?device_id=` — list all
- `GET/DELETE/PATCH /api/lists/{id}` — CRUD
- `POST /api/lists/{id}/refresh` — refresh counts / channels
- `GET /api/lists/{id}/live-categories|live-streams|vod-categories|vod-streams|series-categories|series-streams`
- Xtream Codes API integration (`get_live_categories`, `get_live_streams`, `get_vod_categories`, `get_vod_streams`, `get_series_categories`, `get_series`) with playback URL construction (live/movie/series).
- Passwords stored server-side, never returned to client.
- User-friendly error messages for DNS, timeout, auth, expired, empty, invalid URL/M3U cases.

## Design System
- Palette: #000 bg, #D4AF37 gold, #FFF text, #A0A0A0 muted.
- Typography: Manrope; single font family with size-based hierarchy.
- Spacing 4/8/12/16/24/32/48; radius 6/12/20/pill.
- BlurView tab bar; LinearGradient gold primary button.

## Non-functional
- Device identification via AsyncStorage `goldcast_device_id`.
- No hardcoded env values; uses `EXPO_PUBLIC_BACKEND_URL`.
- Async, non-blocking list processing; FlatList virtualization for large lists.
- `iOS.NSAllowsArbitraryLoads=true` to accept HTTP servers commonly used for IPTV.

## Phase 1–3 (Prompts 3–7 + kOfficePanel/XUI integration) — delivered
- **XUI/Xtream login** (`app/login.tsx`): Servidor (default primary `dpvizzion.shop:8080`, chips for backup `kvlivegame12.store:80`), Usuário, Senha, "Lembrar acesso" (expo-secure-store). Stages: Verificando servidor → Conectando → Validando acesso → Carregando conteúdo → Conectado!. Fallback to backup server only on connectivity errors (never on auth/expired).
- **Xtream client** (`src/services/xtream.ts`): direct-to-panel on native; via `/api/xtream/proxy` on web (browser CORS). Validates `auth=1` + `status=Active` + `exp_date`; builds playback bases from `server_info` (HTTPS preferred when `https_port` advertised, then HTTP, then typed server); respects `allowed_output_formats` (m3u8 > ts). URL redaction helper.
- **Session store** (`src/store/session.ts`, zustand): session, source (`xtream` | M3U `list`), in-memory catalog (live/vod/series), per-account favorites/recents/progress persisted in AsyncStorage keyed by user@server (no cross-account mixing), play queue.
- **AccessGate**: content tabs blocked with "Seu acesso expirou ou está inativo." / "Usuário ou senha inválidos." when panel says so.
- **Home**: AccountCard (🟢 CONTA ATIVA, validade America/Sao_Paulo, conexões x/y, tipo teste/normal, servidor da API, "Não informado" when missing), quick access tiles, "Continuar assistindo" row, M3U lists kept.
- **TV ao vivo**: Todos/Favoritos/Recentes + panel categories, 300ms debounced search (name/epg_channel_id), 2-col virtualized grid, star favorite, source switcher (Xtream account ↔ M3U lists).
- **Player** (`app/player.tsx`, expo-video = Media3/ExoPlayer on Android): single player instance + `replaceAsync` on channel change; states Conectando/Carregando/Buffering/Reproduzindo; auto-retry max 3 (cycles https/http/backup URL candidates) then "Não foi possível reproduzir este conteúdo." + TENTAR NOVAMENTE; controls Play/Pause, Mute, Volume, Fullscreen (landscape lock), Seek bar ±10s (VOD), CH−/CH+, side channel list, Favoritar, Info, Áudio/Legenda pickers (only when tracks exist), AGORA/PRÓXIMO via `get_short_epg`, MediaSession (`showNowPlayingNotification`), AppState pause/resume, VOD progress save/resume.
- **Filmes/Séries**: shared `CatalogGrid` (Todos/Continuar/Favoritos/Recentes/categorias, search, posters with year/genre); `movie/[id]` details (get_vod_info) with ASSISTIR/CONTINUAR + FAVORITAR; `series/[id]` (get_series_info) seasons → episodes → play with episode queue.
- **Settings**: Conta (full AccountCard, ATUALIZAR CONTA, SAIR), Histórico/Favoritos counts + LIMPAR, M3U list management, Sobre.
- **Backend**: `POST /api/xtream/proxy` (web only, logs only hostname), `GET /api/panel/status`; `backend/panel_integration.py` = kOfficePanel layer marked **CONFIGURAÇÃO PENDENTE** (env PANEL_API_URL/PANEL_VALIDATE_ENDPOINT).
- Known constraint: real panel (govtop.shop infra) returns 404 to non-Brazil IPs → backend/web preview cannot reach it; native devices in Brazil call it directly. `backend/tests/mock_xui.py` is a test-only fixture.

## Backlog (Phases 4–6)
- Guia de TV (XMLTV) with cache; Controle parental (PIN); Idioma pt/en/es; Cache screen; Downloads (filmes/episódios, offline); Android TV layouts + D-pad audit; build prep (versionCode, TV banner, permissions).
