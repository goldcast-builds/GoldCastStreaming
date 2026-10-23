import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius, spacing } from "../utils/theme";

interface MetadataPanelProps {
  title: string;
}

interface RatingsData {
  imdb: string;
  rotten: string;
  metacritic: string;
  director: string;
  cast: string;
}

export function MovieMetadataPanel({ title }: MetadataPanelProps) {
  const [data, setData] = useState<RatingsData>({
    imdb: "N/A",
    rotten: "N/A",
    metacritic: "N/A",
    director: "Não informado",
    cast: "Não informado",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!title) return;
    let isMounted = true;

    const fetchMetadata = async () => {
      setLoading(true);
      try {
        // Consulta à API pública de cinema para obter notas e créditos oficiais
        const cleanTitle = title.replace(/[:\-]/g, "").trim();
        const res = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(cleanTitle)}&apikey=trilogy`);
        const json = await res.json();

        if (json.Response === "True" && isMounted) {
          const rtRating = json.Ratings?.find((r: any) => r.Source === "Rotten Tomatoes")?.Value || "N/A";
          const metaRating = json.Ratings?.find((r: any) => r.Source === "Metacritic")?.Value || "N/A";

          setData({
            imdb: json.imdbRating ? `${json.imdbRating}/10` : "N/A",
            rotten: rtRating,
            metacritic: metaRating,
            director: json.Director || "Não informado",
            cast: json.Actors || "Não informado",
          });
        }
      } catch {
        // Fallback silencioso caso a API falhe temporariamente
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMetadata();
    return () => {
      isMounted = false;
    };
  }, [title]);

  return (
    <View style={styles.container}>
      {/* ESPAÇO SUPERIOR (Horizontal): Bloco de Notas dos 3 Portais */}
      <View style={styles.ratingsCard}>
        <Text style={styles.panelHeader}>AVALIAÇÕES DA CRÍTICA</Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.gold} style={{ paddingVertical: 6 }} />
        ) : (
          <View style={styles.badgesRow}>
            {/* IMDb */}
            <View style={styles.badgeItem}>
              <Ionicons name="star" size={14} color="#F5C518" />
              <View>
                <Text style={styles.badgeSource}>IMDb</Text>
                <Text style={styles.badgeValue}>{data.imdb}</Text>
              </View>
            </View>

            {/* Rotten Tomatoes */}
            <View style={styles.badgeItem}>
              <Ionicons name="rose" size={14} color="#FA320A" />
              <View>
                <Text style={styles.badgeSource}>Rotten Tom.</Text>
                <Text style={styles.badgeValue}>{data.rotten}</Text>
              </View>
            </View>

            {/* Metacritic */}
            <View style={styles.badgeItem}>
              <Ionicons name="shield-checkmark" size={14} color="#66CC33" />
              <View>
                <Text style={styles.badgeSource}>Metacritic</Text>
                <Text style={styles.badgeValue}>{data.metacritic}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* ESPAÇO INFERIOR (Vertical/Largo): Ficha Técnica de Direção e Elenco */}
      <View style={styles.detailsCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Diretor:</Text>
          <Text style={styles.infoVal} numberOfLines={1}>{data.director}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Elenco:</Text>
          <Text style={styles.infoVal} numberOfLines={2}>{data.cast}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 170, // Posicionado logo após o pôster do filme
    top: 20,
    width: 440, // Ocupa exatamente a largura dos retângulos marcados
    gap: 8,
    zIndex: 5,
  },
  ratingsCard: {
    backgroundColor: "rgba(24, 24, 24, 0.85)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.3)",
    padding: 10,
    gap: 6,
  },
  panelHeader: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  badgesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  badgeItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  badgeSource: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: "700",
  },
  badgeValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  detailsCard: {
    backgroundColor: "rgba(24, 24, 24, 0.85)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 10,
    gap: 6,
  },
  infoRow: {
    flexDirection: "row",
    gap: 8,
  },
  infoKey: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "700",
    width: 60,
  },
  infoVal: {
    color: colors.textMuted,
    fontSize: 11,
    flex: 1,
  },
});
