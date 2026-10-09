const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withTV(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest["uses-feature"]) {
      manifest["uses-feature"] = [];
    }
    manifest["uses-feature"].push(
      {
        $: {
          "android:name": "android.hardware.touchscreen",
          "android:required": "false",
        },
      },
      {
        $: {
          "android:name": "android.software.leanback",
          "android:required": "false",
        },
      }
    );
    return config;
  });
};
