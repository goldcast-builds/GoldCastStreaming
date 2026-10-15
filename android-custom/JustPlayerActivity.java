package com.goldcast.player;

import android.app.PictureInPictureParams;
import android.content.Context;
import android.content.DialogInterface;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.Rational;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
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
    private TextView hudView;
    private TextView lockFloatingBtn;
    private TextView btnBack;

    private String progressKey;
    private String streamType = "vod";
    private long startPosition = 0;

    private int currentResizeModeIndex = 0;
    private int selectedSpeedIndex = 2; // 1.0x (Normal)
    private boolean isLocked = false;
    private boolean isLandscape = true;
    private boolean isMuted = false;

    // Gestos Táteis
    private AudioManager audioManager;
    private GestureDetector gestureDetector;
    private boolean isDraggingBrightness = false;
    private boolean isDraggingVolume = false;
    private boolean isDraggingSeek = false;
    private boolean hasDecidedDrag = false;
    private float touchStartX = 0;
    private float touchStartY = 0;
    private int initialVolume = 0;
    private float initialBrightness = 0.5f;
    private long initialSeekPosition = 0;
    private long targetSeekPosition = 0;

    private final Handler progressHandler = new Handler(Looper.getMainLooper());
    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            reportProgress();
            progressHandler.postDelayed(this, 3000);
        }
    };

    private final Handler hudHandler = new Handler(Looper.getMainLooper());
    private final Runnable hideHudRunnable = new Runnable() {
        @Override
        public void run() {
            if (hudView != null) {
                hudView.setVisibility(View.GONE);
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);

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

        // Barra Superior
        topBar = buildTopBar(title);
        root.addView(topBar);

        // Indicador Visual Central de Gestos/Controle (HUD)
        hudView = buildHudView();
        root.addView(hudView);

        // Cadeado Flutuante no Canto Inferior Esquerdo
        lockFloatingBtn = buildLockFloatingBtn();
        root.addView(lockFloatingBtn);

        setContentView(root);
        hideSystemUI();
        initGestureDetector();

        playerView.setControllerVisibilityListener(new PlayerView.ControllerVisibilityListener() {
            @Override
            public void onVisibilityChanged(int visibility) {
                if (!isLocked && topBar != null) {
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
        bar.setPadding(dp(14), dp(10), dp(14), dp(10));

        FrameLayout.LayoutParams barParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        barParams.gravity = Gravity.TOP;
        bar.setLayoutParams(barParams);

        GradientDrawable barBg = new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{0xDD000000, 0x66000000, 0x00000000}
        );
        bar.setBackground(barBg);

        // Botão Voltar
        btnBack = createPillButton("‹ Voltar", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
        bar.addView(btnBack);

        // Botão Recomeçar (se o vídeo foi continuado)
        if (startPosition > 5000) {
            TextView btnRestart = createPillButton("Recomeçar", new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    if (player != null) {
                        player.seekTo(0);
                        Toast.makeText(JustPlayerActivity.this, "A reproduzir do início", Toast.LENGTH_SHORT).show();
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
        tvTitle.setPadding(dp(10), 0, dp(10), 0);

        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f
        );
        tvTitle.setLayoutParams(titleParams);
        bar.addView(tvTitle);

        // Contentor Horizontal para os botões do topo
        HorizontalScrollView scrollButtons = new HorizontalScrollView(this);
        scrollButtons.setHorizontalScrollBarEnabled(false);
        scrollButtons.setOverScrollMode(View.OVER_SCROLL_NEVER);

        LinearLayout buttonsLayout = new LinearLayout(this);
        buttonsLayout.setOrientation(LinearLayout.HORIZONTAL);
        buttonsLayout.setGravity(Gravity.CENTER_VERTICAL);

        // 1. Bloquear Ecrã
        TextView btnLock = createPillButton("🔒 Bloquear", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                setLocked(true);
            }
        });
        buttonsLayout.addView(btnLock);

        // 2. Rotação de Ecrã
        TextView btnRotate = createPillButton("🔄 Rotação", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                toggleOrientation();
            }
        });
        buttonsLayout.addView(btnRotate);

        // 3. Mudo
        final TextView btnMute = createPillButton("🔊 Som", null);
        btnMute.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                toggleMute(btnMute);
            }
        });
        buttonsLayout.addView(btnMute);

        // 4. Modo PiP (Janela Flutuante)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            TextView btnPip = createPillButton("⧉ Janela", new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    enterPipMode();
                }
            });
            buttonsLayout.addView(btnPip);
        }

        // 5. Faixa de Áudio
        TextView btnAudio = createPillButton("Áudio", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showAudioDialog();
            }
        });
        buttonsLayout.addView(btnAudio);

        // 6. Legendas
        TextView btnSubs = createPillButton("Legendas", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showSubtitleDialog();
            }
        });
        buttonsLayout.addView(btnSubs);

        // 7. Velocidade
        TextView btnSpeed = createPillButton("Velocidade", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showSpeedDialog();
            }
        });
        buttonsLayout.addView(btnSpeed);

        // 8. Proporção de Tela
        TextView btnAspect = createPillButton("Tela", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showAspectRatioDialog();
            }
        });
        buttonsLayout.addView(btnAspect);

        scrollButtons.addView(buttonsLayout);
        bar.addView(scrollButtons);

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
        focusedBg.setColor(Color.parseColor("#E5A93B"));
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
        if (listener != null) {
            btn.setOnClickListener(listener);
        }

        return btn;
    }

    private TextView buildHudView() {
        TextView tv = new TextView(this);
        tv.setTextColor(Color.WHITE);
        tv.setTextSize(16);
        tv.setTypeface(Typeface.DEFAULT_BOLD);
        tv.setGravity(Gravity.CENTER);
        tv.setPadding(dp(20), dp(12), dp(20), dp(12));

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#EE111318"));
        bg.setCornerRadius(dp(12));
        bg.setStroke(dp(1), Color.parseColor("#E5A93B"));
        tv.setBackground(bg);

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        params.gravity = Gravity.CENTER;
        tv.setLayoutParams(params);
        tv.setVisibility(View.GONE);
        return tv;
    }

    private TextView buildLockFloatingBtn() {
        final TextView btn = new TextView(this);
        btn.setText("🔒");
        btn.setTextSize(22);
        btn.setGravity(Gravity.CENTER);
        btn.setFocusable(true);

        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Color.parseColor("#CC111318"));
        bg.setStroke(dp(2), Color.parseColor("#E5A93B"));
        btn.setBackground(bg);

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(dp(50), dp(50));
        params.gravity = Gravity.BOTTOM | Gravity.START;
        params.setMargins(dp(20), 0, 0, dp(20));
        btn.setLayoutParams(params);
        btn.setVisibility(View.GONE);

        btn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                setLocked(false);
            }
        });

        return btn;
    }

    private void showHud(String text) {
        if (hudView == null) return;
        hudView.setText(text);
        hudView.setVisibility(View.VISIBLE);
        hudHandler.removeCallbacks(hideHudRunnable);
        hudHandler.postDelayed(hideHudRunnable, 1200);
    }

    private void setLocked(boolean locked) {
        isLocked = locked;
        if (isLocked) {
            if (topBar != null) topBar.setVisibility(View.GONE);
            if (playerView != null) playerView.hideController();
            if (lockFloatingBtn != null) lockFloatingBtn.setVisibility(View.VISIBLE);
            showHud("🔒 Ecrã Bloqueado");
        } else {
            if (lockFloatingBtn != null) lockFloatingBtn.setVisibility(View.GONE);
            if (topBar != null) topBar.setVisibility(View.VISIBLE);
            if (playerView != null) playerView.showController();
            showHud("🔓 Ecrã Desbloqueado");
        }
    }

    private void toggleOrientation() {
        if (isLandscape) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
            isLandscape = false;
            showHud("📱 Modo Retrato");
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            isLandscape = true;
            showHud("🖥️ Modo Paisagem");
        }
    }

    private void toggleMute(TextView btnMute) {
        if (player == null) return;
        isMuted = !isMuted;
        if (isMuted) {
            player.setVolume(0f);
            btnMute.setText("🔇 Mudo");
            showHud("🔇 Áudio Mutado");
        } else {
            player.setVolume(1f);
            btnMute.setText("🔊 Som");
            showHud("🔊 Áudio Ativado");
        }
    }

    private void enterPipMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                Rational rational = new Rational(16, 9);
                PictureInPictureParams params = new PictureInPictureParams.Builder()
                        .setAspectRatio(rational)
                        .build();
                enterPictureInPictureMode(params);
            } catch (Exception e) {
                try {
                    enterPictureInPictureMode();
                } catch (Exception err) {
                    Toast.makeText(this, "Janela PiP indisponível neste dispositivo.", Toast.LENGTH_SHORT).show();
                }
            }
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        if (isInPictureInPictureMode) {
            if (topBar != null) topBar.setVisibility(View.GONE);
            if (lockFloatingBtn != null) lockFloatingBtn.setVisibility(View.GONE);
            if (playerView != null) playerView.hideController();
        } else {
            if (!isLocked && topBar != null) {
                topBar.setVisibility(View.VISIBLE);
            }
        }
    }

    // ==============================================================
    // CONTROLES DE SMART TV, TV BOX E PROJETORES (D-PAD & KEY EVENTS)
    // ==============================================================
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            int keyCode = event.getKeyCode();

            if (isLocked) {
                if (keyCode == KeyEvent.KEYCODE_BACK) {
                    setLocked(false);
                    return true;
                }
                showHud("🔒 Ecrã bloqueado. Pressione Voltar para desbloquear.");
                return true;
            }

            switch (keyCode) {
                case KeyEvent.KEYCODE_DPAD_CENTER:
                case KeyEvent.KEYCODE_ENTER:
                case KeyEvent.KEYCODE_NUMPAD_ENTER:
                    // Se estiver com foco num botão da barra superior, executa o clique normalmente
                    View currentFocus = getCurrentFocus();
                    if (currentFocus != null && currentFocus != playerView && topBar != null && topBar.getVisibility() == View.VISIBLE) {
                        return super.dispatchKeyEvent(event);
                    }
                    if (player != null) {
                        if (playerView != null && !playerView.isControllerFullyVisible()) {
                            playerView.showController();
                            if (topBar != null) topBar.setVisibility(View.VISIBLE);
                        } else {
                            if (player.isPlaying()) {
                                player.pause();
                                showHud("⏸ Pausa");
                            } else {
                                player.play();
                                showHud("▶ Reproduzir");
                            }
                        }
                        return true;
                    }
                    break;

                case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                    if (player != null) {
                        if (player.isPlaying()) {
                            player.pause();
                            showHud("⏸ Pausa");
                        } else {
                            player.play();
                            showHud("▶ Reproduzir");
                        }
                        return true;
                    }
                    break;

                case KeyEvent.KEYCODE_MEDIA_PLAY:
                    if (player != null) {
                        player.play();
                        showHud("▶ Reproduzir");
                        return true;
                    }
                    break;

                case KeyEvent.KEYCODE_MEDIA_PAUSE:
                    if (player != null) {
                        player.pause();
                        showHud("⏸ Pausa");
                        return true;
                    }
                    break;

                case KeyEvent.KEYCODE_DPAD_LEFT:
                case KeyEvent.KEYCODE_MEDIA_REWIND:
                    // Se o foco estiver nos botões do topo, deixa navegar entre eles
                    if (topBar != null && topBar.hasFocus()) {
                        return super.dispatchKeyEvent(event);
                    }
                    if (player != null && !player.isCurrentMediaItemLive() && !player.isCurrentMediaItemDynamic()) {
                        player.seekBack();
                        showHud("⏪ -10s (" + formatMs(player.getCurrentPosition()) + ")");
                        if (playerView != null) playerView.showController();
                        return true;
                    }
                    break;

                case KeyEvent.KEYCODE_DPAD_RIGHT:
                case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                    // Se o foco estiver nos botões do topo, deixa navegar entre eles
                    if (topBar != null && topBar.hasFocus()) {
                        return super.dispatchKeyEvent(event);
                    }
                    if (player != null && !player.isCurrentMediaItemLive() && !player.isCurrentMediaItemDynamic()) {
                        player.seekForward();
                        showHud("⏩ +10s (" + formatMs(player.getCurrentPosition()) + ")");
                        if (playerView != null) playerView.showController();
                        return true;
                    }
                    break;

                case KeyEvent.KEYCODE_DPAD_UP:
                    if (topBar != null) {
                        topBar.setVisibility(View.VISIBLE);
                        if (playerView != null) playerView.showController();
                        if (btnBack != null) btnBack.requestFocus();
                        return true;
                    }
                    break;

                case KeyEvent.KEYCODE_DPAD_DOWN:
                    if (playerView != null && !playerView.isControllerFullyVisible()) {
                        playerView.showController();
                        if (topBar != null) topBar.setVisibility(View.VISIBLE);
                        return true;
                    }
                    break;

                case KeyEvent.KEYCODE_BACK:
                    if (playerView != null && playerView.isControllerFullyVisible()) {
                        playerView.hideController();
                        if (topBar != null) topBar.setVisibility(View.GONE);
                        return true;
                    }
                    finish();
                    return true;

                case KeyEvent.KEYCODE_MENU:
                case KeyEvent.KEYCODE_INFO:
                    showAudioDialog();
                    return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private void initGestureDetector() {
        gestureDetector = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onDown(MotionEvent e) {
                return true;
            }

            @Override
            public boolean onSingleTapConfirmed(MotionEvent e) {
                if (hasDecidedDrag) return false;
                if (playerView != null) {
                    if (playerView.isControllerFullyVisible()) {
                        playerView.hideController();
                    } else {
                        playerView.showController();
                    }
                }
                return true;
            }

            @Override
            public boolean onDoubleTap(MotionEvent e) {
                if (hasDecidedDrag || player == null) return false;
                int screenWidth = getResources().getDisplayMetrics().widthPixels;
                float x = e.getX();

                if (x < screenWidth * 0.35f) {
                    player.seekBack();
                    showHud("⏪ -10s");
                    return true;
                } else if (x > screenWidth * 0.65f) {
                    player.seekForward();
                    showHud("⏩ +10s");
                    return true;
                } else {
                    if (player.isPlaying()) {
                        player.pause();
                        showHud("⏸ Pausa");
                    } else {
                        player.play();
                        showHud("▶ Reproduzir");
                    }
                    return true;
                }
            }
        });
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent ev) {
        if (isLocked) {
            if (lockFloatingBtn != null && lockFloatingBtn.getVisibility() == View.VISIBLE) {
                int[] loc = new int[2];
                lockFloatingBtn.getLocationOnScreen(loc);
                float rx = ev.getRawX();
                float ry = ev.getRawY();
                if (rx >= loc[0] && rx <= loc[0] + lockFloatingBtn.getWidth()
                        && ry >= loc[1] && ry <= loc[1] + lockFloatingBtn.getHeight()) {
                    return super.dispatchTouchEvent(ev);
                }
            }
            if (ev.getAction() == MotionEvent.ACTION_DOWN) {
                showHud("🔒 Ecrã bloqueado. Toque no cadeado para desbloquear.");
            }
            return true;
        }

        // Se o toque for na barra superior, processa os botões normais
        if (topBar != null && topBar.getVisibility() == View.VISIBLE) {
            int[] topLoc = new int[2];
            topBar.getLocationOnScreen(topLoc);
            if (ev.getRawY() <= topLoc[1] + topBar.getHeight()) {
                return super.dispatchTouchEvent(ev);
            }
        }

        // Se a barra de progresso inferior estiver visível e o toque for nela
        if (playerView != null && playerView.isControllerFullyVisible()) {
            int screenHeight = getResources().getDisplayMetrics().heightPixels;
            if (ev.getRawY() >= screenHeight - dp(90)) {
                return super.dispatchTouchEvent(ev);
            }
        }

        handleTouchGestures(ev);
        return true;
    }

    private void handleTouchGestures(MotionEvent ev) {
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;

        switch (ev.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                touchStartX = ev.getX();
                touchStartY = ev.getY();
                isDraggingVolume = false;
                isDraggingBrightness = false;
                isDraggingSeek = false;
                hasDecidedDrag = false;

                if (audioManager != null) {
                    initialVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
                }
                float b = getWindow().getAttributes().screenBrightness;
                if (b < 0) {
                    try {
                        b = android.provider.Settings.System.getInt(getContentResolver(), android.provider.Settings.System.SCREEN_BRIGHTNESS) / 255.0f;
                    } catch (Exception ignored) {
                        b = 0.5f;
                    }
                }
                initialBrightness = Math.max(0.01f, Math.min(1.0f, b));
                initialSeekPosition = player != null ? player.getCurrentPosition() : 0;
                targetSeekPosition = initialSeekPosition;
                break;

            case MotionEvent.ACTION_MOVE:
                float dx = ev.getX() - touchStartX;
                float dy = touchStartY - ev.getY();

                if (!hasDecidedDrag) {
                    if (Math.abs(dy) > dp(18) || Math.abs(dx) > dp(18)) {
                        hasDecidedDrag = true;
                        if (Math.abs(dy) > Math.abs(dx)) {
                            if (touchStartX < screenWidth * 0.5f) {
                                isDraggingBrightness = true;
                            } else {
                                isDraggingVolume = true;
                            }
                        } else {
                            if (player != null && !player.isCurrentMediaItemLive() && !player.isCurrentMediaItemDynamic()) {
                                isDraggingSeek = true;
                            }
                        }
                    }
                }

                if (isDraggingBrightness) {
                    float delta = dy / (float) screenHeight;
                    float newB = Math.max(0.01f, Math.min(1.0f, initialBrightness + delta));
                    WindowManager.LayoutParams lp = getWindow().getAttributes();
                    lp.screenBrightness = newB;
                    getWindow().setAttributes(lp);
                    int pct = Math.round(newB * 100);
                    showHud("☀️ Brilho: " + pct + "%");
                } else if (isDraggingVolume) {
                    if (audioManager != null) {
                        int maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                        float delta = (dy / (float) screenHeight) * maxVol * 1.2f;
                        int newVol = Math.max(0, Math.min(maxVol, initialVolume + Math.round(delta)));
                        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, newVol, 0);
                        int pct = Math.round((newVol / (float) maxVol) * 100);
                        showHud("🔊 Volume: " + pct + "%");
                    }
                } else if (isDraggingSeek) {
                    if (player != null) {
                        long dur = player.getDuration();
                        if (dur > 0) {
                            long deltaMs = (long) ((dx / (float) screenWidth) * 120000);
                            targetSeekPosition = Math.max(0, Math.min(dur, initialSeekPosition + deltaMs));
                            long diffSec = (targetSeekPosition - initialSeekPosition) / 1000;
                            String sign = diffSec >= 0 ? "+" : "";
                            showHud("⏩ " + formatMs(targetSeekPosition) + " (" + sign + diffSec + "s)");
                        }
                    }
                }
                break;

            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                if (isDraggingSeek) {
                    if (player != null && targetSeekPosition >= 0) {
                        player.seekTo(targetSeekPosition);
                    }
                    isDraggingSeek = false;
                }
                isDraggingBrightness = false;
                isDraggingVolume = false;
                break;
        }

        gestureDetector.onTouchEvent(ev);
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
                                Toast.makeText(JustPlayerActivity.this, "Áudio: " + names.get(which), Toast.LENGTH_SHORT).show();
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
                                Toast.makeText(JustPlayerActivity.this, "Legenda: " + names.get(which), Toast.LENGTH_SHORT).show();
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
