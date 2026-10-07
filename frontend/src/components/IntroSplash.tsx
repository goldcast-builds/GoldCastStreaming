import React, { useRef } from "react";
import { StyleSheet, View, Pressable, StatusBar } from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";

interface IntroSplashProps {
  onFinish: () => void;
}

export function IntroSplash({ onFinish }: IntroSplashProps) {
  const videoRef = useRef<Video>(null);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    // Quando a reprodução terminar, fecha a abertura
    if (status.isLoaded && status.didJustFinish) {
      onFinish();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {/* Permite ao utilizador tocar no ecrã para saltar a abertura */}
      <Pressable style={styles.pressArea} onPress={onFinish}>
        <Video
          ref={videoRef}
          source={require("../../assets/Intro.mp4")}
          style={StyleSheet.absoluteFillObject}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping={false}
          isMuted={false}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onError={() => {
            // Em caso de qualquer falha no vídeo, avança logo para o ecrã inicial
            onFinish();
          }}
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
