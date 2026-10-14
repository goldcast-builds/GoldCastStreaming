package com.goldcast.player;

import android.content.DialogInterface;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.TrackGroup;
import androidx.media3.common.Tracks;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class JustPlayerActivity extends AppCompatActivity {
    private ExoPlayer player;
    private PlayerView playerView;
    private LinearLayout topBar;

    private String progressKey;
    private String streamType = "vod";
    private long startPosition = 0;

    private int currentResizeModeIndex = 0;
    private int selectedSpeedIndex = 2; // 1.0x (Normal)

    private final Handler progressHandler = new Handler(Looper.getMainLooper());
    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            reportProgress();
            progressHandler.postDelayed(this, 3000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        String url = getIntent().getStringExtra("url");
        String title = getIntent().getStringExtra("title");
        startPosition = getIntent().getLongExtra("startPosition", 0);
        progressKey = getIntent().getStringExtra("progressKey");
        streamType = getIntent().getStringExtra("streamType");

        if (title == null || title.trim().isEmpty()) {
            title = "GoldCast Streaming";
        }

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF000000);

        playerView = new PlayerView(this);
        playerView.setLayoutParams(new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));
        playerView.setKeepScreenOn(true);
        playerView.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        playerView.setControllerShowTimeoutMs(4000);

        root.addView(playerView);

        topBar = buildTopBar(title);
        root.addView(topBar);

        setContentView(root);
        hideSystemUI();

        playerView.setControllerVisibilityListener(new PlayerView.ControllerVisibilityListener() {
            @Override
            public void onVisibilityChanged(int visibility) {
                if (topBar != null) {
                    topBar.setVisibility(visibility);
                }
            }
        });

        if (url != null && !url.isEmpty()) {
            initPlayer(url);
        }
    }

    private LinearLayout buildTopBar(String title) {
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(16), dp(12), dp(16), dp(12));

        FrameLayout.LayoutParams barParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        barParams.gravity = Gravity.TOP;
        bar.setLayoutParams(barParams);

        GradientDrawable barBg = new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{0xDD000000, 0x55000000, 0x00000000}
        );
        bar.setBackground(barBg);

        // Botão Voltar
        TextView btnBack = createPillButton("‹ Voltar", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
        bar.addView(btnBack);

        // Botão Recomeçar (Aparece apenas quando o vídeo foi continuado)
        if (startPosition > 5000) {
            TextView btnRestart = createPillButton("Recomeçar", new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    if (player != null) {
                        player.seekTo(0);
                        Toast.makeText(JustPlayerActivity.this, "Reproduzindo do início", Toast.LENGTH_SHORT).show();
                    }
                }
            });
            bar.addView(btnRestart);
        }

        // Título da Transmissão
        TextView tvTitle = new TextView(this);
        tvTitle.setText(title);
        tvTitle.setTextColor(Color.WHITE);
        tvTitle.setTextSize(14);
        tvTitle.setTypeface(Typeface.DEFAULT_BOLD);
        tvTitle.setSingleLine(true);
        tvTitle.setEllipsize(TextUtils.TruncateAt.END);
        tvTitle.setPadding(dp(12), 0, dp(12), 0);

        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f
        );
        tvTitle.setLayoutParams(titleParams);
        bar.addView(tvTitle);

        // Botão Áudio
        TextView btnAudio = createPillButton("Áudio", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showAudioDialog();
            }
        });
        bar.addView(btnAudio);

        // Botão Legendas
        TextView btnSubs = createPillButton("Legendas", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showSubtitleDialog();
            }
        });
        bar.addView(btnSubs);

        // Botão Velocidade
        TextView btnSpeed = createPillButton("Velocidade", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showSpeedDialog();
            }
        });
        bar.addView(btnSpeed);

        // Botão Proporção (Tela)
        TextView btnAspect = createPillButton("Tela", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showAspectRatioDialog();
            }
        });
        bar.addView(btnAspect);

        return bar;
    }

    private TextView createPillButton(String text, View.OnClickListener listener) {
        final TextView btn = new TextView(this);
        btn.setText(text);
        btn.setTextColor(Color.parseColor("#E0E0E0"));
        btn.setTextSize(12);
        btn.setTypeface(Typeface.DEFAULT_BOLD);
        btn.setPadding(dp(10), dp(6), dp(10), dp(6));
        btn.setGravity(Gravity.CENTER);
        btn.setFocusable(true);

        final GradientDrawable normalBg = new GradientDrawable();
        normalBg.setColor(Color.parseColor("#8815171E"));
        normalBg.setCornerRadius(dp(14));
        normalBg.setStroke(dp(1), Color.parseColor("#33E5A93B"));
        btn.setBackground(normalBg);

        final GradientDrawable focusedBg = new GradientDrawable();
        focusedBg.setColor(Color.parseColor("#D4E5A93B"));
        focusedBg.setCornerRadius(dp(14));
        focusedBg.setStroke(dp(2), Color.WHITE);

        btn.setOnFocusChangeListener(new View.OnFocusChangeListener() {
            @Override
            public void onFocusChange(View v, boolean hasFocus) {
                if (hasFocus) {
                    btn.setBackground(focusedBg);
                    btn.setTextColor(Color.BLACK);
                } else {
                    btn.setBackground(normalBg);
                    btn.setTextColor(Color.parseColor("#E0E0E0"));
                }
            }
        });

        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        p.setMargins(dp(3), 0, dp(3), 0);
        btn.setLayoutParams(p);
        btn.setOnClickListener(listener);

        return btn;
    }

    private void reportProgress() {
        if (player == null) return;
        if (streamType != null && streamType.equalsIgnoreCase("live")) return;
        if (player.isCurrentMediaItemLive() || player.isCurrentMediaItemDynamic()) return;

        long pos = player.getCurrentPosition();
        long dur = player.getDuration();

        if (dur > 0 && pos > 0 && progressKey != null && !progressKey.isEmpty()) {
            JustPlayerModule.sendProgressEvent(progressKey, pos, dur, streamType);
        }
    }

    private String formatMs(long ms) {
        long totalSec = Math.max(0, ms / 1000);
        long hours = totalSec / 3600;
        long mins = (totalSec % 3600) / 60;
        long secs = totalSec % 60;
        if (hours > 0) {
            return String.format("%02d:%02d:%02d", hours, mins, secs);
        } else {
            return String.format("%02d:%02d", mins, secs);
        }
    }

    private void showAudioDialog() {
        if (player == null) return;
        Tracks tracks = player.getCurrentTracks();
        final List<String> names = new ArrayList<>();
        final List<TrackSelectionOverride> overrides = new ArrayList<>();

        names.add("Automático (Padrão)");
        overrides.add(null);

        int currentSelected = 0;

        for (Tracks.Group group : tracks.getGroups()) {
            if (group.getType() == C.TRACK_TYPE_AUDIO) {
                TrackGroup mediaTrackGroup = group.getMediaTrackGroup();
                for (int i = 0; i < group.length; i++) {
                    Format format = group.getTrackFormat(i);
                    String lang = format.language != null ? format.language.toUpperCase() : "ÁUDIO";
                    String label = format.label != null && !format.label.isEmpty() ? format.label : "Faixa " + names.size();
                    String ch = format.channelCount > 0 ? " (" + format.channelCount + "ch)" : "";

                    names.add(label + " [" + lang + "]" + ch);
                    overrides.add(new TrackSelectionOverride(mediaTrackGroup, Collections.singletonList(i)));

                    if (group.isTrackSelected(i)) {
                        currentSelected = names.size() - 1;
                    }
                }
            }
        }

        if (names.size() <= 1) {
            Toast.makeText(this, "Esta transmissão possui apenas 1 canal de áudio.", Toast.LENGTH_SHORT).show();
            return;
        }

        new AlertDialog.Builder(this)
                .setTitle("Selecionar Áudio")
                .setSingleChoiceItems(names.toArray(new String[0]), currentSelected, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        if (which == 0) {
                            player.setTrackSelectionParameters(
                                    player.getTrackSelectionParameters()
                                            .buildUpon()
                                            .clearOverridesOfType(C.TRACK_TYPE_AUDIO)
                                            .build()
                            );
                            Toast.makeText(JustPlayerActivity.this, "Áudio: Automático", Toast.LENGTH_SHORT).show();
                        } else {
                            TrackSelectionOverride override = overrides.get(which);
                            if (override != null) {
                                player.setTrackSelectionParameters(
                                        player.getTrackSelectionParameters()
                                                .buildUpon()
                                                .setOverrideForType(override)
                                                .build()
                                );
                                Toast.makeText(JustPlayerActivity.this, "Áudio alterado: " + names.get(which), Toast.LENGTH_SHORT).show();
                            }
                        }
                        dialog.dismiss();
                    }
                })
                .setNegativeButton("Fechar", null)
                .show();
    }

    private void showSubtitleDialog() {
        if (player == null) return;
        Tracks tracks = player.getCurrentTracks();
        final List<String> names = new ArrayList<>();
        final List<TrackSelectionOverride> overrides = new ArrayList<>();

        names.add("Desativada");
        overrides.add(null);

        int currentSelected = 0;
        boolean hasSelected = false;

        for (Tracks.Group group : tracks.getGroups()) {
            if (group.getType() == C.TRACK_TYPE_TEXT) {
                TrackGroup mediaTrackGroup = group.getMediaTrackGroup();
                for (int i = 0; i < group.length; i++) {
                    Format format = group.getTrackFormat(i);
                    String lang = format.language != null ? format.language.toUpperCase() : "LEGENDA";
                    String label = format.label != null && !format.label.isEmpty() ? format.label : "Legenda " + names.size();

                    names.add(label + " (" + lang + ")");
                    overrides.add(new TrackSelectionOverride(mediaTrackGroup, Collections.singletonList(i)));

                    if (group.isTrackSelected(i)) {
                        currentSelected = names.size() - 1;
                        hasSelected = true;
                    }
                }
            }
        }

        if (names.size() <= 1) {
            Toast.makeText(this, "Nenhuma legenda disponível para esta transmissão.", Toast.LENGTH_SHORT).show();
            return;
        }

        if (!hasSelected) currentSelected = 0;

        new AlertDialog.Builder(this)
                .setTitle("Selecionar Legenda")
                .setSingleChoiceItems(names.toArray(new String[0]), currentSelected, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        if (which == 0) {
                            player.setTrackSelectionParameters(
                                    player.getTrackSelectionParameters()
                                            .buildUpon()
                                            .clearOverridesOfType(C.TRACK_TYPE_TEXT)
                                            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                                            .build()
                            );
                            Toast.makeText(JustPlayerActivity.this, "Legendas desativadas", Toast.LENGTH_SHORT).show();
                        } else {
                            TrackSelectionOverride override = overrides.get(which);
                            if (override != null) {
                                player.setTrackSelectionParameters(
                                        player.getTrackSelectionParameters()
                                                .buildUpon()
                                                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                                                .setOverrideForType(override)
                                                .build()
                                );
                                Toast.makeText(JustPlayerActivity.this, "Legenda ativada: " + names.get(which), Toast.LENGTH_SHORT).show();
                            }
                        }
                        dialog.dismiss();
                    }
                })
                .setNegativeButton("Fechar", null)
                .show();
    }

    private void showSpeedDialog() {
        if (player == null) return;
        final String[] speeds = {"0.5x", "0.75x", "1.0x (Normal)", "1.25x", "1.5x", "2.0x"};
        final float[] values = {0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f};

        new AlertDialog.Builder(this)
                .setTitle("Velocidade de Reprodução")
                .setSingleChoiceItems(speeds, selectedSpeedIndex, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        selectedSpeedIndex = which;
                        player.setPlaybackSpeed(values[which]);
                        Toast.makeText(JustPlayerActivity.this, "Velocidade: " + speeds[which], Toast.LENGTH_SHORT).show();
                        dialog.dismiss();
                    }
                })
                .setNegativeButton("Fechar", null)
                .show();
    }

    private void showAspectRatioDialog() {
        if (playerView == null) return;
        final String[] modes = {
                "Ajustar à Tela (Original / Barras)",
                "Preencher Tela (Esticar)",
                "Zoom (Cortar Bordas Pretas)"
        };
        final int[] values = {
                AspectRatioFrameLayout.RESIZE_MODE_FIT,
                AspectRatioFrameLayout.RESIZE_MODE_FILL,
                AspectRatioFrameLayout.RESIZE_MODE_ZOOM
        };

        new AlertDialog.Builder(this)
                .setTitle("Proporção de Tela")
                .setSingleChoiceItems(modes, currentResizeModeIndex, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        currentResizeModeIndex = which;
                        playerView.setResizeMode(values[which]);
                        Toast.makeText(JustPlayerActivity.this, "Modo: " + modes[which], Toast.LENGTH_SHORT).show();
                        dialog.dismiss();
                    }
                })
                .setNegativeButton("Fechar", null)
                .show();
    }

    private void initPlayer(String url) {
        try {
            DefaultHttpDataSource.Factory httpDataSourceFactory = new DefaultHttpDataSource.Factory()
                    .setUserAgent("GoldCastStreaming/1.0 (Android; Media3)")
                    .setConnectTimeoutMs(15000)
                    .setReadTimeoutMs(15000)
                    .setAllowCrossProtocolRedirects(true);

            DefaultMediaSourceFactory mediaSourceFactory = new DefaultMediaSourceFactory(httpDataSourceFactory);

            player = new ExoPlayer.Builder(this)
                    .setMediaSourceFactory(mediaSourceFactory)
                    .setSeekBackIncrementMs(10000)
                    .setSeekForwardIncrementMs(10000)
                    .build();

            playerView.setPlayer(player);

            MediaItem mediaItem = MediaItem.fromUri(Uri.parse(url));

            if (startPosition > 5000) {
                player.setMediaItem(mediaItem, startPosition);
                Toast.makeText(this, "Continuando de " + formatMs(startPosition), Toast.LENGTH_SHORT).show();
            } else {
                player.setMediaItem(mediaItem);
            }

            player.prepare();
            player.setPlayWhenReady(true);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private void hideSystemUI() {
        try {
            final View decorView = getWindow().getDecorView();
            if (decorView == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = decorView.getWindowInsetsController();
                if (controller != null) {
                    controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                    controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                }
            } else {
                decorView.setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                );
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUI();
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUI();
        if (player != null) player.setPlayWhenReady(true);
        progressHandler.post(progressRunnable);
    }

    @Override
    protected void onPause() {
        super.onPause();
        progressHandler.removeCallbacks(progressRunnable);
        reportProgress();
        if (player != null) player.setPlayWhenReady(false);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        progressHandler.removeCallbacks(progressRunnable);
        reportProgress();
        if (player != null) {
            player.release();
            player = null;
        }
    }
}
