import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSession } from "../src/store/session";

export default function IntroScreen() {
  const router = useRouter();
  const restore = useSession((s) => s.restore);

  const player = useVideoPlayer(require("../assets/Intro.mp4"), (playerInstance) => {
    playerInstance.loop = false;
    playerInstance.play();
  });

  useEffect(() => {
    let isMounted = true;

    // Já inicia a restauração da sessão em paralelo à introdução
    restore().catch(() => {});

    const timer = setTimeout(async () => {
      if (!isMounted) return;
      try {
        await restore().catch(() => {});
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
  }, [router, restore]);

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
