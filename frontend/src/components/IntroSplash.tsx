import React, { useEffect, useState } from "react";
import { StyleSheet, View, Pressable, StatusBar } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

interface IntroSplashProps {
  onFinish: () => void;
}

export function IntroSplash({ onFinish }: IntroSplashProps) {
  const [hasFinished, setHasFinished] = useState(false);

  const finishPlayback = () => {
    if (!hasFinished) {
      setHasFinished(true);
      onFinish();
    }
  };

  const player = useVideoPlayer(require("../../assets/Intro.mp4"), (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  useEffect(() => {
    const subscription = player.addListener("playToEnd", () => {
      finishPlayback();
    });

    // Trava para permitir tocar os 9 segundos do vídeo sem cortar
    const fallbackTimer = setTimeout(() => {
      finishPlayback();
    }, 12000);

    return () => {
      subscription.remove();
      clearTimeout(fallbackTimer);
    };
  }, [player]);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {/* Permite tocar na tela para avançar a qualquer momento */}
      <Pressable style={styles.pressArea} onPress={finishPlayback}>
        <VideoView
          player={player}
          style={styles.video}
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
    zIndex: 999999,
    elevation: 999999, // Renderiza na frente de tudo no Android
    justifyContent: "center",
    alignItems: "center",
  },
  pressArea: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
});
