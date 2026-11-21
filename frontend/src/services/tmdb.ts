const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY || "";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";

export interface StrictCastMember {
  id: number;
  name: string;
  character: string;
  profileUrl: string | null;
}

export interface StrictMediaEnrichment {
  backdropUrl: string | null;
  gallery: string[];
  cast: StrictCastMember[];
}

function normalizeTitle(str: string): string {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

export async function fetchStrictMediaEnrichment(
  mediaType: "movie" | "tv",
  meta: any,
  fallbackTitle?: string,
  fallbackYear?: string | null
): Promise<StrictMediaEnrichment | null> {
  if (!TMDB_API_KEY) return null;

  try {
    let tmdbId: string | number | null = meta?.tmdb_id || meta?.tmdbId || null;
    const imdbId = meta?.imdb_id || meta?.imdbId || null;

    if (!tmdbId && imdbId) {
      const findRes = await fetch(
        `${TMDB_BASE}/find/${encodeURIComponent(String(imdbId))}?api_key=${TMDB_API_KEY}&external_source=imdb_id`
      );
      if (findRes.ok) {
        const findJson = await findRes.json();
        const hit =
          mediaType === "movie"
            ? findJson?.movie_results?.[0]
            : findJson?.tv_results?.[0];
        if (hit?.id) tmdbId = hit.id;
      }
    }

    if (!tmdbId) {
      const rawTitle = meta?.name || meta?.title || fallbackTitle || "";
      const rawYear = String(
        meta?.year ||
          meta?.release_date ||
          meta?.releasedate ||
          meta?.releaseDate ||
          fallbackYear ||
          ""
      ).slice(0, 4);

      if (!rawTitle || !/^\d{4}$/.test(rawYear)) {
        return null;
      }

      const searchUrl =
        mediaType === "movie"
          ? `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(rawTitle)}&year=${rawYear}&language=pt-BR`
          : `${TMDB_BASE}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(rawTitle)}&first_air_date_year=${rawYear}&language=pt-BR`;

      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) return null;
      const searchJson = await searchRes.json();
      const results = Array.isArray(searchJson?.results) ? searchJson.results : [];

      const expectedNorm = normalizeTitle(rawTitle);
      const exactMatch = results.find((item: any) => {
        const itemYear = String(item?.release_date || item?.first_air_date || "").slice(0, 4);
        if (itemYear !== rawYear) return false;
        const candTitle = normalizeTitle(item?.title || item?.name || "");
        const candOrig = normalizeTitle(item?.original_title || item?.original_name || "");
        return (
          candTitle === expectedNorm ||
          candOrig === expectedNorm ||
          (expectedNorm.length >= 4 && (candTitle.includes(expectedNorm) || expectedNorm.includes(candTitle)))
        );
      });

      if (!exactMatch?.id) return null;
      tmdbId = exactMatch.id;
    }

    const detailRes = await fetch(
      `${TMDB_BASE}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,images&language=pt-BR&include_image_language=pt,en,null`
    );
    if (!detailRes.ok) return null;
    const detailJson = await detailRes.json();

    const backdropUrl = detailJson?.backdrop_path
      ? `${TMDB_IMG}/w1280${detailJson.backdrop_path}`
      : null;

    const gallery = Array.isArray(detailJson?.images?.backdrops)
      ? detailJson.images.backdrops
          .slice(0, 6)
          .map((b: any) => (b?.file_path ? `${TMDB_IMG}/w780${b.file_path}` : null))
          .filter(Boolean) as string[]
      : [];

    const cast: StrictCastMember[] = Array.isArray(detailJson?.credits?.cast)
      ? detailJson.credits.cast.slice(0, 8).map((c: any) => ({
          id: Number(c?.id || Math.random()),
          name: String(c?.name || ""),
          character: String(c?.character || ""),
          profileUrl: c?.profile_path ? `${TMDB_IMG}/w185${c.profile_path}` : null,
        }))
      : [];

    return { backdropUrl, gallery, cast };
  } catch {
    return null;
  }
}
