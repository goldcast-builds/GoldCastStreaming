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
