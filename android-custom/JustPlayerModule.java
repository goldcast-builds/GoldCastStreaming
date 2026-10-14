package com.goldcast.player;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class JustPlayerModule extends ReactContextBaseJavaModule {
    private static ReactApplicationContext reactContextInstance;

    public JustPlayerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContextInstance = reactContext;
    }

    @Override
    public String getName() {
        return "JustPlayer";
    }

    @ReactMethod
    public void play(String url, String title, double startPositionMs, String progressKey, String streamType) {
        Intent intent = new Intent(reactContextInstance, JustPlayerActivity.class);
        intent.putExtra("url", url);
        intent.putExtra("title", title);
        intent.putExtra("startPosition", (long) startPositionMs);
        intent.putExtra("progressKey", progressKey);
        intent.putExtra("streamType", streamType);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        reactContextInstance.startActivity(intent);
    }

    public static void sendProgressEvent(String progressKey, long positionMs, long durationMs, String streamType) {
        if (reactContextInstance == null || progressKey == null || progressKey.isEmpty()) return;
        try {
            // Guarda localmente no SharedPreferences por segurança
            SharedPreferences prefs = reactContextInstance.getSharedPreferences("goldcast_player_prefs", Context.MODE_PRIVATE);
            prefs.edit()
                .putLong("pos_" + progressKey, positionMs)
                .putLong("dur_" + progressKey, durationMs)
                .apply();

            // Envia o progresso em segundos para o Zustand / useSession do React Native
            WritableMap params = Arguments.createMap();
            params.putString("progressKey", progressKey);
            params.putDouble("position", positionMs / 1000.0);
            params.putDouble("duration", durationMs / 1000.0);
            params.putString("streamType", streamType != null ? streamType : "vod");

            reactContextInstance
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("onPlayerProgress", params);
        } catch (Exception ignored) {}
    }
}
