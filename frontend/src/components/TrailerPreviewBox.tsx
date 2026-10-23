import React, { useState, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, Text, Pressable } from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius } from "../utils/theme";

interface TrailerPreviewProps {
  title: string;
}

export function TrailerPreviewBox({ title }: TrailerPreviewProps) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportIndex, setReportIndex] = useState(0);

  useEffect(() => {
    if (!title) return;
    let isMounted = true;

    const fetchTrailer = async () => {
      setLoading(true);
      try {
        // Altera a query de busca se o usuário reportar que o vídeo está errado
        const searchQuery = reportIndex > 0 
          ? `${title} trailer legendado pt-br oficial ${reportIndex}` 
          : `${title} trailer oficial legendado`;

        const query = encodeURIComponent(searchQuery);
        const response = await fetch(`https://www.youtube.com/results?search_query=${query}`);
        const htmlText = await response.text();

        // Extrai múltiplos IDs de vídeos possíveis dos resultados do YouTube
        const matches = [...htmlText.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)];
        
        if (matches && matches[reportIndex] && matches[reportIndex][1] && isMounted) {
          setVideoId(matches[reportIndex][1]);
        } else if (matches && matches[0] && isMounted) {
          setVideoId(matches[0][1]);
        } else if (isMounted) {
          setVideoId("dQw4w9WgXcQ");
        }
      } catch {
        if (isMounted) setVideoId("dQw4w9WgXcQ");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTrailer();
    return () => {
      isMounted = false;
    };
  }, [title, reportIndex]);

  const handleReportIncorrect = () => {
    // Incrementa o índice para buscar uma alternativa diferente na lista do YouTube
    setReportIndex((prev) => prev + 1);
  };

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
        ) : videoId ? (
          <YoutubePlayer
            height={160}
            width={300}
            play={false}
            videoId={videoId}
            webViewStyle={{ opacity: 0.99 }}
          />
        ) : null}
      </View>

      {/* Botão de Reportar Vídeo Incorreto */}
      <Pressable
        focusable={true}
        onPress={handleReportIncorrect}
        style={({ focused }) => [styles.reportBtn, focused && styles.reportBtnFocused]}
      >
        <Ionicons name="alert-circle-outline" size={12} color="#EF4444" />
        <Text style={styles.reportText}>Não é este o trailer? Reportar / Trocar</Text>
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
  reportText: {
    color: "#FCA5A5",
    fontSize: 9.5,
    fontWeight: "800",
  },
});
