import React, { useState, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";

interface TrailerPreviewProps {
  title: string;
}

export function TrailerPreviewBox({ title }: TrailerPreviewProps) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!title) return;
    let isMounted = true;

    const fetchTrailer = async () => {
      setLoading(true);
      try {
        const query = encodeURIComponent(`${title} trailer oficial legendado`);
        const response = await fetch(`https://www.youtube.com/results?search_query=${query}`);
        const htmlText = await response.text();

        const match = htmlText.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (match && match[1] && isMounted) {
          setVideoId(match[1]);
        } else if (isMounted) {
          setVideoId("dQw4w9WgXcQ");
        }
      } catch {
        if (isMounted) setVideoId("dQw4w9WgXcQ");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTrailer();
    return () => {
      isMounted = false;
    };
  }, [title]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#D4AF37" />
      </View>
    );
  }

  if (!videoId) return null;

  return (
    <View style={styles.container}>
      <YoutubePlayer
        height={170}
        width={310}
        play={false}
        videoId={videoId}
        webViewStyle={{ opacity: 0.99 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 24,
    top: 24,
    width: 310,
    height: 170,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
});
