import { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { Logo } from "../src/components/Logo";
import { colors } from "../src/utils/theme";
import { useSession } from "../src/store/session";
import { listLists } from "../src/utils/api";

export default function CinemaSplashRoute() {
  const router = useRouter();

  // Valores de animação
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const flare = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Sequência de animação cinematográfica estilo Netflix
    Animated.sequence([
      // 1. A logo surge suavemente da escuridão
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // 2. Pulso de expansão rápida em direção à tela
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.25,
          duration: 800,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(flare, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Carregamento dos dados em segundo plano
    let cancelled = false;
    const decide = async () => {
      const [, lists] = await Promise.all([
        useSession.getState().restore(),
        listLists().catch(() => [] as any[]),
        new Promise((r) => setTimeout(r, 2200)),
      ]);
      if (cancelled) return;

      const { session, deviceMode } = useSession.getState();
      if (!deviceMode) {
        router.replace("/device");
        return;
      }
      router.replace(session || lists.length > 0 ? "/(tabs)" : "/login");
    };

    decide();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.root}>
      {/* Efeito de brilho de fundo expandindo */}
      <Animated.View
        style={[
          styles.glowCircle,
          {
            opacity: flare,
            transform: [
              {
                scale: flare.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 3.5],
                }),
              },
            ],
          },
        ]}
      />

      {/* Logo com zoom e revelação cinematográfica */}
      <Animated.View
        style={{
          opacity,
          transform: [{ scale }],
        }}
      >
        <Logo size={240} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  glowCircle: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(229, 169, 59, 0.25)",
  },
});
