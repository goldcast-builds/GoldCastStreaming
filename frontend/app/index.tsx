import { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Logo } from "../src/components/Logo";
import { colors } from "../src/utils/theme";
import { useSession } from "../src/store/session";
import { listLists } from "../src/utils/api";

export default function SplashRoute() {
  const router = useRouter();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const shine = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.timing(shine, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ).start();

    let cancelled = false;
    const decide = async () => {
      const [, lists] = await Promise.all([
        useSession.getState().restore(),
        listLists().catch(() => [] as any[]),
        new Promise((r) => setTimeout(r, 2000)),
      ]);
      if (cancelled) return;
      const { session, deviceMode } = useSession.getState();
      if (!deviceMode) { router.replace("/device"); return; }
      router.replace(session || lists.length > 0 ? "/(tabs)" : "/login");
    };
    decide();
    return () => { cancelled = true; };
  }, []);

  const shineTranslate = shine.interpolate({ inputRange: [-1, 1], outputRange: [-260, 260] });

  return (
    <View style={styles.root} testID="splash-screen">
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <View style={styles.logoWrap}>
          <Logo size={260} />
          <Animated.View
            style={[styles.shine, { pointerEvents: "none", transform: [{ translateX: shineTranslate }, { rotate: "18deg" }] }]}
          >
            <LinearGradient
              colors={["transparent", "rgba(212,175,55,0.35)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 24,
  },
  shine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 90,
  },
});
