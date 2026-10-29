import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function IntroScreen() {
  const router = useRouter();

  useEffect(() => {
    // Temporizador ajustado para 13.5 segundos para cobrir a nova introdução de 13s sem cortes
    const timer = setTimeout(async () => {
      try {
        const savedCode = await AsyncStorage.getItem("@goldcast_saved_code");
        if (savedCode && savedCode.length > 3) {
          router.replace("/(tabs)"); // Se já tiver chave/sessão ativa, vai direto para a Home
        } else {
          router.replace("/login"); // Se não tiver, encaminha para a tela de login
        }
      } catch {
        router.replace("/login");
      }
    }, 13500);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <Video
        source={require("../assets/intro-video.mp4")} // Certifique-se de que o caminho do vídeo está correto
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  video: { width: "100%", height: "100%" },
});
