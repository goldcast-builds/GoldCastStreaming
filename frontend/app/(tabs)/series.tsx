import { useCallback, useMemo } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { AccessGate } from "../../src/components/AccessGate";
import { CatalogGrid, GridItem } from "../../src/components/CatalogGrid";
import { useSession } from "../../src/store/session";
import { NoVod } from "../../src/components/NoVod";

export default function SeriesTab() {
  return (
    <AccessGate>
      <SeriesContent />
    </AccessGate>
  );
}

function SeriesContent() {
  const router = useRouter();
  const source = useSession((s) => s.source);
  const catalog = useSession((s) => s.catalog);
  const loading = useSession((s) => s.loading.series);
  const error = useSession((s) => s.errors.series);
  const loadSeries = useSession((s) => s.loadSeries);
  const favIds = useSession((s) => s.ud.favorites.series);
  const recents = useSession((s) => s.ud.recents.series);
  const toggleFav = useSession((s) => s.toggleFav);

  useFocusEffect(useCallback(() => { if (source?.kind === "xtream") loadSeries(); }, [source?.kind, loadSeries]));

  const items: GridItem[] = useMemo(() => catalog.series.map((s) => ({
    id: String(s.series_id), name: s.name, poster: s.cover, categoryId: s.category_id,
    year: s.releaseDate ? String(s.releaseDate).slice(0, 4) : undefined, genre: s.genre || undefined, rating: s.rating != null ? String(s.rating) : undefined,
  })), [catalog.series]);

  if (source?.kind !== "xtream") return <NoVod title="Séries" />;

  return (
    <CatalogGrid
      title="Séries"
      testIDPrefix="series"
      searchPlaceholder="Buscar séries..."
      items={items}
      cats={catalog.seriesCats}
      loading={loading && !catalog.seriesLoaded}
      error={!catalog.seriesLoaded ? error : null}
      onRetry={() => loadSeries(true)}
      favIds={favIds}
      recentIds={recents.map((r) => String(r.series_id))}
      onOpen={(i) => router.push({ pathname: "/series/[id]", params: { id: i.id } })}
      onFav={(i) => toggleFav("series", i.id)}
      emptyText="Este conteúdo não está disponível nesta lista."
    />
  );
}
