import React, { useState, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, Text, Pressable } from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius } from "../utils/theme";

interface TrailerPreviewProps {
  title: string;
  year?: string | number;
  mediaType?: "movie" | "series" | "tv";
}

interface CandidateVideo {
  videoId: string;
  title: string;
  score: number;
}

const NOISE_TAGS = [
  /\b(4k|uhd|fhd|hd|1080p|720p|480p|hdr|dv|dolby\s*vision|web-?dl|webrip|bluray|bdrip|camrip|x264|x265|hevc|aac|dual\s*audio)\b/gi,
  /\b(dublado|legendado|nacional|pt-?br|multi|completo|epis[oó]dio\s*\d+|ep\.?\s*\d+|temp\.?\s*\d+|s\d{1,2}e\d{1,2}|season\s*\d+)\b/gi,
  /\[[^\]]*\]|\([^)]*\)/g,
];

const HARD_BLOCKED = [
  "rickroll",
  "never gonna give you up",
  "karaoke",
  "gameplay",
  "walkthrough",
  "10 hours",
];

const SOFT_BLOCKED = [
  "lyrics",
  "letra",
  "compilation",
  "top 10",
  "reaction",
  "react",
  "review",
  "crítica",
  "critica",
  "explained",
  "recap",
  "resumo",
  "full movie",
  "filme completo",
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMediaTitle(rawTitle: string): string {
  let cleaned = rawTitle;
  for (const pattern of NOISE_TAGS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  return cleaned
    .replace(/\s*[-–—:|/]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSearchCandidates(htmlText: string): Array<{ videoId: string; videoTitle: string }> {
  const results: Array<{ videoId: string; videoTitle: string }> = [];
  const seen = new Set<string>();

  // Tenta extrair videoId + título próximo no HTML/JSON do YouTube
  const rendererRegex =
    /"videoId":"([a-zA-Z0-9_-]{11})"[\s\S]{0,800}?"title":\{"runs":\[\{"text":"([^"]+)"\}/g;

  for (const match of htmlText.matchAll(rendererRegex)) {
    const videoId = match[1];
    const videoTitle = match[2]
      .replace(/\\u0026/g, "&")
      .replace(/\\"/g, '"')
      .replace(/\\\//g, "/");

    if (!seen.has(videoId)) {
      seen.add(videoId);
      results.push({ videoId, videoTitle });
    }
    if (results.length >= 25) break;
  }

  // Fallback de extração apenas de videoId caso o formato do JSON varie
  if (results.length === 0) {
    const idMatches = [...htmlText.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)];
    for (const m of idMatches) {
      const videoId = m[1];
      if (!seen.has(videoId)) {
        seen.add(videoId);
        results.push({ videoId, videoTitle: "" });
      }
      if (results.length >= 15) break;
    }
  }

  return results;
}

function scoreCandidate(
  videoTitle: string,
  cleanTitle: string,
  year?: string | number,
  mediaType?: "movie" | "series" | "tv"
): number {
  const normVideo = normalizeText(videoTitle);
  const normTitle = normalizeText(cleanTitle);
  if (!normTitle) return 0;

  // Se o HTML não trouxe título legível, dá nota neutra baixa em vez de descartar tudo
  if (!normVideo) return 15;

  for (const blocked of HARD_BLOCKED) {
    if (normVideo.includes(blocked)) return -999;
  }

  let score = 0;
  const words = normTitle.split(" ").filter((w) => w.length > 1);

  if (normVideo.includes(normTitle)) {
    score += 45;
  } else if (words.length > 0) {
    const matchedWords = words.filter((w) => normVideo.includes(w));
    const ratio = matchedWords.length / words.length;
    if (ratio < 0.5) {
      return -50;
    }
    score += Math.round(ratio * 30);
  }

  if (/\b(trailer|teaser|promo|preview|oficial|official)\b/.test(normVideo)) {
    score += 20;
  }
  if (/\b(legendado|dublado|pt br|brasil|oficial)\b/.test(normVideo)) {
    score += 8;
  }

  const isSeries = mediaType === "series" || mediaType === "tv";
  if (isSeries && /\b(serie|series|temporada|season)\b/.test(normVideo)) {
    score += 8;
  }

  const cleanYear = year ? String(year).match(/\b(19|20)\d{2}\b/)?.[0] : undefined;
  if (cleanYear) {
    if (normVideo.includes(cleanYear)) {
      score += 12;
    } else {
      const yearsInVideo = [...normVideo.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => m[0]);
      if (yearsInVideo.length > 0 && !yearsInVideo.includes(cleanYear)) {
        score -= 15;
      }
    }
  }

  for (const soft of SOFT_BLOCKED) {
    if (normVideo.includes(soft)) {
      score -= 35;
    }
  }

  return score;
}

export function TrailerPreviewBox({ title, year, mediaType }: TrailerPreviewProps) {
  const [candidates, setCandidates] = useState<CandidateVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCurrentIndex(0);
  }, [title, year, mediaType]);

  useEffect(() => {
    if (!title) return;
    let isMounted = true;

    const fetchTrailer = async () => {
      setLoading(true);
      try {
        const cleanTitle = cleanMediaTitle(title) || title.trim();
        const yearSuffix = year ? ` ${year}` : "";

        const queries = [
          `${cleanTitle}${yearSuffix} trailer oficial`,
          `${cleanTitle}${yearSuffix} trailer`,
          `${cleanTitle} trailer`,
        ];

        const strictMap = new Map<string, CandidateVideo>();
        const fallbackMap = new Map<string, CandidateVideo>();

        for (const q of queries) {
          const encoded = encodeURIComponent(q);
          const response = await fetch(`https://www.youtube.com/results?search_query=${encoded}`, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            },
          });
          if (!response.ok) continue;

          const htmlText = await response.text();
          const extracted = extractSearchCandidates(htmlText);

          for (const item of extracted) {
            const score = scoreCandidate(item.videoTitle, cleanTitle, year, mediaType);
            if (score <= -900) continue;

            if (score >= 10) {
              const prev = strictMap.get(item.videoId);
              if (!prev || score > prev.score) {
                strictMap.set(item.videoId, { videoId: item.videoId, title: item.videoTitle, score });
              }
            } else if (score > -50) {
              const prev = fallbackMap.get(item.videoId);
              if (!prev || score > prev.score) {
                fallbackMap.set(item.videoId, { videoId: item.videoId, title: item.videoTitle, score });
              }
            }
          }

          if (strictMap.size >= 4) break;
        }

        const rankedStrict = [...strictMap.values()].sort((a, b) => b.score - a.score);
        const rankedFallback = [...fallbackMap.values()].sort((a, b) => b.score - a.score);
        const finalList = rankedStrict.length > 0 ? rankedStrict : rankedFallback;

        if (isMounted) {
          setCandidates(finalList);
          setCurrentIndex(0);
        }
      } catch {
        if (isMounted) {
          setCandidates([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTrailer();
    return () => {
      isMounted = false;
    };
  }, [title, year, mediaType]);

  const handleReportIncorrect = () => {
    if (candidates.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % candidates.length);
  };

  const activeVideoId = candidates[currentIndex]?.videoId ?? null;

  return (
    <View style={styles.wrapper}>
      {/* Rótulo de Destaque */}
      <View style={styles.badgeRow}>
        <Ionicons name="film" size={13} color={colors.gold} />
        <Text style={styles.badgeText}>TRAILER OFICIAL</Text>
      </View>

      {/* Caixa do Vídeo */}
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.gold} />
          </View>
        ) : activeVideoId ? (
          <YoutubePlayer
            height={160}
            width={300}
            play={false}
            videoId={activeVideoId}
            webViewStyle={{ opacity: 0.99 }}
          />
        ) : (
          <View style={styles.loadingBox}>
            <Ionicons name="videocam-off-outline" size={22} color="#9CA3AF" />
            <Text style={styles.emptyText}>Trailer não encontrado</Text>
          </View>
        )}
      </View>

      {/* Botão de Reportar Vídeo Incorreto */}
      <Pressable
        focusable={true}
        onPress={handleReportIncorrect}
        disabled={candidates.length <= 1}
        style={({ focused }) => [
          styles.reportBtn,
          focused && styles.reportBtnFocused,
          candidates.length <= 1 && styles.reportBtnDisabled,
        ]}
      >
        <Ionicons name="alert-circle-outline" size={12} color="#EF4444" />
        <Text style={styles.reportText}>
          {candidates.length > 1
            ? `Não é este o trailer? Trocar (${currentIndex + 1}/${candidates.length})`
            : "Não é este o trailer? Reportar / Trocar"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    right: 24,
    top: 20,
    width: 300,
    alignItems: "flex-end",
    gap: 6,
    zIndex: 10,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(212,175,55,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)",
  },
  badgeText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  container: {
    width: 300,
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
  },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  reportBtnFocused: {
    backgroundColor: "#EF4444",
    borderColor: "#FFF",
  },
  reportBtnDisabled: {
    opacity: 0.55,
  },
  reportText: {
    color: "#FCA5A5",
    fontSize: 9.5,
    fontWeight: "800",
  },
});
