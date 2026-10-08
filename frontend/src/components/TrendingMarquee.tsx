import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius, spacing } from "../utils/theme";

export interface MarqueeItem {
  id: string;
  name: string;
  poster?: string;
  type?: "movie" | "series";
}

interface TrendingMarqueeProps {
  items: MarqueeItem[];
  onPressItem: (item: MarqueeItem) => void;
}

const ITEM_WIDTH = 115;
const ITEM_HEIGHT = 172; // Proporção clássica 2:3
const ITEM_GAP = 12;

export function TrendingMarquee({ items, onPressItem }: TrendingMarqueeProps) {
  const animatedX = useRef(new Animated.Value(0)).current;

  // Se houver poucos itens, repetimos para manter o fluxo contínuo
  const displayItems = items.length > 0 
    ? [...items, ...items, ...items] 
    : [];

  const singleSetWidth = items.length * (ITEM_WIDTH + ITEM_GAP);

  useEffect(() => {
    if (items.length === 0) return;

    animatedX.setValue(0);
    // Animação infinita da direita para a esquerda a 60 FPS
    const animation = Animated.loop(
      Animated.timing(animatedX, {
        toValue: -singleSetWidth,
        duration: Math.max(16000, items.length * 2800), // Velocidade suave e constante
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => animation.stop();
  }, [items, singleSetWidth]);

  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Ionicons name="flame" size={16} color={colors.gold} />
          <Text style={styles.sectionTitle}>NOVIDADES & DESTAQUES</Text>
        </View>
        <Text style={styles.badge}>EM ALTA</Text>
      </View>

      <View style={styles.trackWrapper}>
        <Animated.View
          style={[
            styles.animatedTrack,
            { transform: [{ translateX: animatedX }] },
          ]}
        >
          {displayItems.map((item, idx) => (
            <Pressable
              key={`${item.id}-${idx}`}
              onPress={() => onPressItem(item)}
              style={({ pressed }) => [
                styles.card,
                pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
              ]}
            >
              {item.poster ? (
                <Image
                  source={{ uri: item.poster }}
                  style={styles.poster}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={styles.placeholder}>
                  <Ionicons name="film-outline" size={28} color={colors.textDim} />
                </View>
              )}

              {/* Sombra gradiente inferior */}
              <LinearGradient
                colors={["transparent", "rgba(9, 10, 14, 0.9)"]}
                style={styles.scrim}
              />

              <View style={styles.meta}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
            </Pressable>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  badge: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  trackWrapper: {
    height: ITEM_HEIGHT + 6,
    overflow: "hidden",
  },
  animatedTrack: {
    flexDirection: "row",
    gap: ITEM_GAP,
  },
  card: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    backgroundColor: "#12141C",
    alignItems: "center",
    justifyContent: "center",
  },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "50%",
  },
  meta: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 10.5,
    fontWeight: "700",
  },
});
