import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Pressable,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { WebView } from "react-native-webview";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius } from "../utils/theme";

interface TrailerPreviewProps {
  title: string;
  year?: string | number;
  mediaType?: "movie" | "series" | "tv";
  youtubeKey?: string | null;
  fallbackImage?: string | null;
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

// Hífen aplicado apenas na reprodução direta do vídeo
function buildAdFreeWatchUrl(videoId: string): string {
  return `https://www.yout-ube.com/watch?v=${encodeURIComponent(videoId)}`;
}

// Busca/navegação sem hífen para não quebrar o site do YouTube
function buildNormalSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function extractSearchCandidates(htmlText: string): Array<{ videoId: string; videoTitle: string }> {
  const results: Array<{ videoId: string; videoTitle: string }> = [];
  const seen = new Set<string>();

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

export function TrailerPreviewBox({
  title,
  year,
  mediaType,
  youtubeKey,
  fallbackImage,
}: TrailerPreviewProps) {
  const [candidates, setCandidates] = useState<CandidateVideo[]>(
    youtubeKey ? [{ videoId: youtubeKey, title: `${title} Trailer`, score: 100 }] : []
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [playerVisible, setPlayerVisible] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
    setThumbFailed(false);
    setPlayerVisible(false);
    setCandidates(
      youtubeKey ? [{ videoId: youtubeKey, title: `${title} Trailer`, score: 100 }] : []
    );
  }, [title, year, mediaType, youtubeKey]);

  useEffect(() => {
    setThumbFailed(false);
  }, [currentIndex]);

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

        if (youtubeKey) {
          strictMap.set(youtubeKey, {
            videoId: youtubeKey,
            title: `${title} Trailer Oficial`,
            score: 100,
          });
        }

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

        if (isMounted && finalList.length > 0) {
          setCandidates(finalList);
          setCurrentIndex(0);
        }
      } catch {
        // Mantém fallback seguro sem quebrar
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
  }, [title, year, mediaType, youtubeKey]);

  const activeCandidate = candidates[currentIndex] ?? null;
  const activeVideoId = activeCandidate?.videoId ?? null;

  const previewImageUri =
    activeVideoId && !thumbFailed
      ? `https://img.youtube.com/vi/${activeVideoId}/hqdefault.jpg`
      : fallbackImage || "";

  const cleanQuery = `${cleanMediaTitle(title) || title.trim()} trailer oficial`;
  const targetUrl = activeVideoId
    ? buildAdFreeWatchUrl(activeVideoId)
    : buildNormalSearchUrl(cleanQuery);

  const handleOpenTrailer = useCallback(() => {
    setPlayerVisible(true);
  }, []);

  const handleReportIncorrect = useCallback(() => {
    if (candidates.length <= 1) {
      setPlayerVisible(true);
      return;
    }
    setCurrentIndex((prev) => (prev + 1) % candidates.length);
  }, [candidates.length]);

  return (
    <View style={styles.wrapper}>
      <View pointerEvents="none" style={styles.badgeRow}>
        <Ionicons name="film" size={13} color={colors.gold} />
        <Text style={styles.badgeText}>TRAILER OFICIAL</Text>
      </View>

      <Pressable
        focusable={true}
        accessible={true}
        onPress={handleOpenTrailer}
        hitSlop={12}
        style={({ focused }) => [
          styles.container,
          focused && styles.containerFocused,
        ]}
      >
        {loading ? (
          <View pointerEvents="none" style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.gold} />
            <Text style={styles.loadingHint}>A preparar trailer...</Text>
          </View>
        ) : (
          <>
            {previewImageUri ? (
              <Image
                source={{ uri: previewImageUri }}
                style={styles.thumbImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                pointerEvents="none"
                onError={() => setThumbFailed(true)}
              />
            ) : (
              <View pointerEvents="none" style={styles.fallbackBg}>
                <Ionicons name="videocam-outline" size={26} color={colors.gold} />
                <Text style={styles.fallbackTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.fallbackSub} numberOfLines={1}>
                  {year ? `${year} • ` : ""}Toque para abrir
                </Text>
              </View>
            )}

            <View pointerEvents="none" style={styles.thumbOverlay} />

            <View pointerEvents="none" style={styles.playCircle}>
              <Ionicons name="play" size={22} color="#000" />
            </View>

            <View pointerEvents="none" style={styles.adFreePill}>
              <Text style={styles.adFreePillText}>
                {activeVideoId ? "SEM ANÚNCIOS • REPRODUZIR" : "ABRIR NO YOUTUBE • SEM ANÚNCIOS"}
              </Text>
            </View>
          </>
        )}
      </Pressable>

      <Pressable
        focusable={true}
        accessible={true}
        onPress={handleReportIncorrect}
        hitSlop={10}
        style={({ focused }) => [
          styles.reportBtn,
          focused && styles.reportBtnFocused,
        ]}
      >
        <Ionicons name="alert-circle-outline" size={12} color="#EF4444" />
        <Text style={styles.reportText}>
          {candidates.length > 1
            ? `Não é este o trailer? Trocar (${currentIndex + 1}/${candidates.length})`
            : "Não é este o trailer? Abrir / Trocar"}
        </Text>
      </Pressable>

      <Modal
        visible={playerVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setPlayerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {activeCandidate?.title || title}
              </Text>
              <Pressable
                focusable={true}
                accessible={true}
                hasTVPreferredFocus={true}
                onPress={() => setPlayerVisible(false)}
                style={({ focused }) => [styles.closeBtn, focused && styles.closeBtnFocused]}
              >
                <Ionicons name="close" size={18} color="#FFF" />
                <Text style={styles.closeBtnText}>Fechar</Text>
              </Pressable>
            </View>

            {playerVisible && (
              <WebView
                source={{ uri: targetUrl }}
                style={styles.webview}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                scalesPageToFit={true}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    right: 20,
    top: 12,
    width: 280,
    alignItems: "flex-end",
    gap: 6,
    zIndex: 60,
    elevation: 24,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(212,175,55,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
  },
  badgeText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  container: {
    width: 280,
    height: 145,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#162A36",
    borderWidth: 2,
    borderColor: "rgba(233, 196, 106, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  containerFocused: {
    borderColor: "#FFD700",
    borderWidth: 3.5,
    transform: [{ scale: 1.04 }],
  },
  thumbImage: {
    ...StyleSheet.absoluteFillObject,
  },
  fallbackBg: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#162A36",
    paddingHorizontal: 14,
    paddingBottom: 22,
    gap: 4,
  },
  fallbackTitle: {
    color: "#FFF",
    fontSize: 12.5,
    fontWeight: "800",
    textAlign: "center",
  },
  fallbackSub: {
    color: "#9CA3AF",
    fontSize: 10.5,
    fontWeight: "700",
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  playCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  adFreePill: {
    position: "absolute",
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.45)",
  },
  adFreePillText: {
    color: colors.gold,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  loadingHint: {
    color: "#D1D5DB",
    fontSize: 10.5,
    fontWeight: "700",
  },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(239, 68, 68, 0.14)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  reportBtnFocused: {
    backgroundColor: "#EF4444",
    borderColor: "#FFF",
  },
  reportText: {
    color: "#FCA5A5",
    fontSize: 9.5,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  modalBox: {
    width: "100%",
    maxWidth: 860,
    height: "82%",
    backgroundColor: "#11161F",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: colors.gold,
  },
  modalHeader: {
    height: 48,
    backgroundColor: "#0B0E14",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalTitle: {
    color: colors.gold,
    fontSize: 12.5,
    fontWeight: "900",
    flex: 1,
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1F2937",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  closeBtnFocused: {
    borderColor: "#FFD700",
    backgroundColor: "#374151",
  },
  closeBtnText: {
    color: "#FFF",
    fontSize: 11.5,
    fontWeight: "800",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
});
