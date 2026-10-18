import { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { useSession } from "../src/store/session";
import { listLists } from "../src/utils/api";

export default function SplashRoute() {
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  const [authReady, setAuthReady] = useState(false);
  const nextRouteRef = useRef<string>("/login");
  const hasNavigated = useRef(false);

  const navigateToNext = () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    router.replace(nextRouteRef.current as any);
  };

  useEffect(() => {
    let cancelled = false;

    const prepare = async () => {
      try {
        const [, lists] = await Promise.all([
          useSession.getState().restore(),
          listLists().catch(() => [] as any[]),
        ]);

        if (cancelled) return;

        const { session, deviceMode } = useSession.getState();
        if (!deviceMode) {
          nextRouteRef.current = "/device";
        } else {
          // Se já possuir credenciais ou lista ativa, entra diretamente no reprodutor
          nextRouteRef.current = session || lists.length > 0 ? "/(tabs)" : "/login";
        }
        setAuthReady(true);
      } catch {
        if (cancelled) return;
        nextRouteRef.current = "/login";
        setAuthReady(true);
      }
    };

    prepare();

    // Temporizador de segurança: se o vídeo demorar mais de 6 segundos ou falhar, avança direto
    const fallbackTimer = setTimeout(() => {
      navigateToNext();
    }, 6000);

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, []);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    // Quando o vídeo chega ao fim, avança suavemente para o aplicativo
    if (status.isLoaded && status.didJustFinish) {
      navigateToNext();
    }
  };

  return (
    <Pressable
      style={styles.root}
      testID="splash-screen"
      focusable={true}
      onPress={navigateToNext}
    >
      <Video
        ref={videoRef}
        source={require("../assets/intro.mp4")}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay={true}
        isLooping={false}
        isMuted={false}
        useNativeControls={false}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        onError={navigateToNext}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
});
