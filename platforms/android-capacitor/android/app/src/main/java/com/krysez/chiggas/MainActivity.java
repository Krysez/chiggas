package com.krysez.chiggas;

import android.graphics.Color;
import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private OnBackPressedCallback chiggasBackCallback;
    private GooglePlayBillingBridge googlePlayBillingBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        prepareFullscreenWindow();
        hideSystemUI();
        setupGooglePlayBillingBridge();

        chiggasBackCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                dispatchBackToGame();
            }
        };

        getOnBackPressedDispatcher().addCallback(this, chiggasBackCallback);
    }

    @Override
    public void onResume() {
        super.onResume();
        hideSystemUI();
        if (googlePlayBillingBridge != null) {
            googlePlayBillingBridge.onResume();
            googlePlayBillingBridge.injectJavascriptBridge();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
            if (googlePlayBillingBridge != null) {
                googlePlayBillingBridge.injectJavascriptBridge();
            }
        }
    }

    @Override
    public void onDestroy() {
        if (googlePlayBillingBridge != null) {
            googlePlayBillingBridge.destroy();
            googlePlayBillingBridge = null;
        }
        super.onDestroy();
    }

    private void setupGooglePlayBillingBridge() {
        if (this.bridge == null || this.bridge.getWebView() == null) return;

        WebView webView = this.bridge.getWebView();
        googlePlayBillingBridge = new GooglePlayBillingBridge(this, webView);
        webView.addJavascriptInterface(googlePlayBillingBridge, "AndroidChiggasBilling");
        googlePlayBillingBridge.injectJavascriptBridge();
        googlePlayBillingBridge.connect();
    }

    private void prepareFullscreenWindow() {
        Window window = getWindow();
        if (window == null) return;

        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        window.getDecorView().setBackgroundColor(Color.BLACK);
    }

    private void dispatchBackToGame() {
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().evaluateJavascript(
                "window.dispatchEvent(new Event('chiggasAndroidBack'));",
                null
            );
            hideSystemUI();
        }
    }

    private void hideSystemUI() {
        Window window = getWindow();
        if (window == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);

            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
        } else {
            window.getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
        }
    }
}
