import AsyncStorage from "@react-native-async-storage/async-storage";

export interface FootballMatch {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "live" | "scheduled" | "finished";
  timeLabel: string;
  channels?: string;
}

const CACHE_KEY = "@goldcast_football_matches_cache";

export async function getTodayFootballMatches(): Promise<FootballMatch[]> {
  try {
    // Endpoint aberto e público de eventos esportivos da ESPN (Futebol mundial / Brasil / Conmebol)
    const response = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard",
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) throw new Error("Erro na rede esportiva");
    const json = await response.json();

    const matches: FootballMatch[] = (json.events || []).map((event: any) => {
      const comp = event.competitions?.[0];
      const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
      const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
      const state = event.status?.type?.state; // 'pre', 'in', 'post'

      let status: "live" | "scheduled" | "finished" = "scheduled";
      let timeLabel = event.status?.type?.shortDetail || "Hoje";

      if (state === "in") {
        status = "live";
        timeLabel = `${event.status?.displayClock || "Ao Vivo"}`;
      } else if (state === "post") {
        status = "finished";
        timeLabel = "Fim";
      }

      return {
        id: event.id,
        league: event.season?.slug ? event.season.slug.toUpperCase() : "Brasileirão Série A",
        homeTeam: home?.team?.displayName || "Mandante",
        awayTeam: away?.team?.displayName || "Visitante",
        homeScore: state !== "pre" ? Number(home?.score ?? 0) : null,
        awayScore: state !== "pre" ? Number(away?.score ?? 0) : null,
        status,
        timeLabel,
        channels: comp?.broadcasts?.[0]?.names?.join(" • ") || "Premiere • SporTV",
      };
    });

    if (matches.length > 0) {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(matches));
      return matches;
    }
  } catch (err) {
    // Fallback silencioso do cache
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  }

  // Fallback estático caso a rede falhe completamente na primeira abertura
  return [
    {
      id: "f1",
      league: "Campeonato Brasileiro - Série A",
      homeTeam: "Fluminense",
      awayTeam: "Internacional",
      homeScore: null,
      awayScore: null,
      status: "scheduled",
      timeLabel: "19:30",
      channels: "RECORD • Premiere",
    },
    {
      id: "f2",
      league: "Campeonato Brasileiro - Série A",
      homeTeam: "Santos",
      awayTeam: "Palmeiras",
      homeScore: null,
      awayScore: null,
      status: "scheduled",
      timeLabel: "19:30",
      channels: "SporTV • Premiere",
    },
  ];
}
