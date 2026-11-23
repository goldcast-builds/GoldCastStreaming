import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSession } from "../src/store/session";

export default function IntroScreen() {
  const router = useRouter();
  const restore = useSession((s) => s.restore);
  const preloadCatalog = useSession((s) => s.preloadCatalog);

  const player = useVideoPlayer(require("../assets/Intro.mp4"), (playerInstance) => {
    playerInstance.loop = false;
    playerInstance.play();
  });

  useEffect(() => {
    let isMounted = true;

    // Dispara a restauração e o pré-carregamento do catálogo imediatamente durante o vídeo
    restore()
      .then(() => {
        if (isMounted) {
          preloadCatalog().catch(() => {});
        }
      })
      .catch(() => {});

    const timer = setTimeout(async () => {
      if (!isMounted) return;
      try {
        const currentSession = useSession.getState().session;
        const savedCode = await AsyncStorage.getItem("@goldcast_saved_code");

        if (currentSession || (savedCode && savedCode.length > 3)) {
          router.replace("/(tabs)");
        } else {
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      }
    }, 13500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [router, restore, preloadCatalog]);

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        nativeControls={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  video: { width: "100%", height: "100%" },
});
