import { useEffect, useRef } from "react";
import { StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSession } from "../src/store/session";
import { listLists } from "../src/utils/api";

export default function VideoSplashRoute() {
  const router = useRouter();
  const nextRouteRef = useRef<string>("/login");
  const hasNavigated = useRef(false);

  const navigateToNext = () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    router.replace(nextRouteRef.current as any);
  };

  // Carrega e inicializa o arquivo com a letra maiúscula exata
  const player = useVideoPlayer(require("../assets/Intro.mp4"), (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    let cancelled = false;

    // Carrega a sessão e as listas em segundo plano enquanto a intro é reproduzida
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
          nextRouteRef.current = session || lists.length > 0 ? "/(tabs)" : "/login";
        }
      } catch {
        if (cancelled) return;
        nextRouteRef.current = "/login";
      }
    };

    prepare();

    // Quando o vídeo terminar de rodar, avança diretamente
    const statusSubscription = player.addListener("playToEnd", () => {
      navigateToNext();
    });

    // Temporizador de segurança: se o vídeo travar ou demorar mais de 6 segundos, avança
    const fallbackTimer = setTimeout(() => {
      navigateToNext();
    }, 6000);

    return () => {
      cancelled = true;
      statusSubscription?.remove();
      clearTimeout(fallbackTimer);
    };
  }, [player]);

  return (
    <Pressable
      style={styles.root}
      testID="splash-screen"
      focusable={true}
      onPress={navigateToNext}
    >
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
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
