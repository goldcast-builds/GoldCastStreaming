import { useCallback, useMemo } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { CatalogGrid, GridItem } from "../../src/components/CatalogGrid";
import { useSession } from "../../src/store/session";
import { NoVod } from "../../src/components/NoVod";

export default function MoviesTab() {
  const router = useRouter();
  const source = useSession((s) => s.source);
  const catalog = useSession((s) => s.catalog);
  const loading = useSession((s) => s.loading.vod);
  const error = useSession((s) => s.errors.vod);
  const loadVod = useSession((s) => s.loadVod);
  const favIds = useSession((s) => s.ud.favorites.vod);
  const recents = useSession((s) => s.ud.recents.vod);
  const progress = useSession((s) => s.ud.progress);
  const toggleFav = useSession((s) => s.toggleFav);

  useFocusEffect(useCallback(() => { if (source?.kind === "xtream") loadVod(); }, [source?.kind, loadVod]));

  const progressById = useMemo(() => {
    const m: Record<string, number> = {};
    Object.values(progress).forEach((p) => { if (p.item.kind === "vod" && p.duration > 0) m[p.item.id] = p.position / p.duration; });
    return m;
  }, [progress]);
  const continueIds = useMemo(() => Object.values(progress).filter((p) => p.item.kind === "vod" && p.duration > 0 && p.position / p.duration < 0.97).sort((a, b) => b.updatedAt - a.updatedAt).map((p) => p.item.id), [progress]);

  const items: GridItem[] = useMemo(() => catalog.vod.map((v) => ({
    id: String(v.stream_id), name: v.name, poster: v.stream_icon, categoryId: v.category_id,
    year: v.year || undefined, genre: v.genre || undefined, rating: v.rating != null ? String(v.rating) : undefined, progress: progressById[String(v.stream_id)],
  })), [catalog.vod, progressById]);

  if (source?.kind !== "xtream") return <NoVod title="Filmes" />;

  return (
    <CatalogGrid
      title="Filmes"
      testIDPrefix="movies"
      searchPlaceholder="Buscar filmes..."
      items={items}
      cats={catalog.vodCats}
      loading={loading && !catalog.vodLoaded}
      error={!catalog.vodLoaded ? error : null}
      onRetry={() => loadVod(true)}
      favIds={favIds}
      recentIds={recents.map((r) => String(r.stream_id))}
      continueIds={continueIds}
      onOpen={(i) => router.push({ pathname: "/movie/[id]", params: { id: i.id } })}
      onFav={(i) => toggleFav("vod", i.id)}
      emptyText="Este conteúdo não está disponível nesta lista."
    />
  );
}
