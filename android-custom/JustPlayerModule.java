package com.goldcast.player;

import android.content.Intent;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class JustPlayerModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public JustPlayerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "JustPlayer";
    }

    @ReactMethod
    public void play(String url, String title) {
        Intent intent = new Intent(reactContext, JustPlayerActivity.class);
        intent.putExtra("url", url);
        intent.putExtra("title", title);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        reactContext.startActivity(intent);
    }
}
