import React, { useEffect } from "react";
import { StyleSheet, View, Pressable, StatusBar } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

interface IntroSplashProps {
  onFinish: () => void;
}

export function IntroSplash({ onFinish }: IntroSplashProps) {
  // Inicializa o player com o vídeo da logo
  const player = useVideoPlayer(require("../../assets/Intro.mp4"), (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    // Quando o vídeo terminar, libera a tela inicial
    const subscription = player.addListener("playToEnd", () => {
      onFinish();
    });

    // Trava de segurança: garante a entrada no app após 5s caso o vídeo demore
    const fallbackTimer = setTimeout(() => {
      onFinish();
    }, 5000);

    return () => {
      subscription.remove();
      clearTimeout(fallbackTimer);
    };
  }, [player, onFinish]);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Pressable style={styles.pressArea} onPress={onFinish}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFillObject}
          contentFit="contain"
          nativeControls={false}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    zIndex: 99999,
    justifyContent: "center",
    alignItems: "center",
  },
  pressArea: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
});
