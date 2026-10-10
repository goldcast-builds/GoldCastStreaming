const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withTV(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // 1. Assegura a lista de recursos
    if (!manifest["uses-feature"]) {
      manifest["uses-feature"] = [];
    }

    // 2. Desativa a obrigatoriedade de recursos exclusivos de celular
    const features = [
      { "android:name": "android.hardware.touchscreen", "android:required": "false" },
      { "android:name": "android.software.leanback", "android:required": "false" },
      { "android:name": "android.hardware.telephony", "android:required": "false" },
      { "android:name": "android.hardware.camera", "android:required": "false" },
      { "android:name": "android.hardware.camera.autofocus", "android:required": "false" },
      { "android:name": "android.hardware.microphone", "android:required": "false" },
      { "android:name": "android.hardware.bluetooth", "android:required": "false" },
      { "android:name": "android.hardware.wifi", "android:required": "false" },
    ];

    features.forEach((feat) => {
      const existing = manifest["uses-feature"].find(
        (f) => f.$ && f.$["android:name"] === feat["android:name"]
      );
      if (!existing) {
        manifest["uses-feature"].push({ $: feat });
      } else if (existing.$) {
        existing.$["android:required"] = "false";
      }
    });

    // 3. Registra a categoria de TV (LEANBACK_LAUNCHER) e o banner
    const app = manifest.application?.[0];
    if (app) {
      app.$["android:banner"] = "@drawable/splash_image";

      const mainActivity = app.activity?.find(
        (a) => a.$ && a.$["android:name"] === ".MainActivity"
      );

      if (mainActivity) {
        if (!mainActivity["intent-filter"]) {
          mainActivity["intent-filter"] = [];
        }

        const hasLeanback = mainActivity["intent-filter"].some((filter) =>
          filter.category?.some(
            (c) => c.$?.["android:name"] === "android.intent.category.LEANBACK_LAUNCHER"
          )
        );

        if (!hasLeanback) {
          mainActivity["intent-filter"].push({
            action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
            category: [{ $: { "android:name": "android.intent.category.LEANBACK_LAUNCHER" } }],
          });
        }
      }
    }

    return config;
  });
};
