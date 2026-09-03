import { Image } from "expo-image";
import { View, StyleSheet } from "react-native";

const LOGO = require("../../assets/images/goldcast-logo.png");

export function Logo({ size = 180 }: { size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]} testID="goldcast-logo">
      <Image source={LOGO} style={styles.img} contentFit="contain" transition={300} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  img: { width: "100%", height: "100%" },
});
