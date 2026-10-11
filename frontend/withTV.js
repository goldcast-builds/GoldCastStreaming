const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withTV(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest["uses-feature"]) {
      manifest["uses-feature"] = [];
    }

    // Define TUDO como falso para que tanto projetores AOSP quanto Smart TVs aceitem
    const features = [
      { "android:name": "android.hardware.touchscreen", "android:required": "false" },
      { "android:name": "android.software.leanback", "android:required": "false" },
      { "android:name": "android.hardware.faketouch", "android:required": "false" },
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

    const app = manifest.application?.[0];
    if (app) {
      app.$["android:banner"] = "@mipmap/ic_launcher";

      const mainActivity = app.activity?.find(
        (a) => a.$ && a.$["android:name"] === ".MainActivity"
      );

      if (mainActivity) {
        mainActivity.$["android:screenOrientation"] = "landscape";

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
