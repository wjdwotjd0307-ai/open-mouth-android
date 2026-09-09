package kr.openmouth.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.Toast;

public class MainActivity extends Activity {

    private static final int AUDIO_PERMISSION_REQUEST = 1001;
    private static final String PREFS = "open_mouth_prefs";
    private static final String KEY_SERVER = "server_url";

    private WebView webView;
    private ProgressBar progress;
    private PermissionRequest pendingWebPermission;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        progress = findViewById(R.id.progress);

        configureWebView();

        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String savedUrl = prefs.getString(KEY_SERVER, "");

        if (savedUrl == null || savedUrl.trim().isEmpty()) {
            showServerDialog(false);
        } else {
            loadServer(savedUrl);
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " OPEN-MOUTH-ANDROID/1.0");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean wantsAudio = false;
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                            wantsAudio = true;
                            break;
                        }
                    }

                    if (!wantsAudio) {
                        request.deny();
                        return;
                    }

                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                            == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        pendingWebPermission = request;
                        requestPermissions(
                                new String[]{Manifest.permission.RECORD_AUDIO},
                                AUDIO_PERMISSION_REQUEST
                        );
                    }
                });
            }
        });
    }

    private void showServerDialog(boolean editing) {
        final EditText input = new EditText(this);
        input.setHint("https://open-mouth-xxxx.onrender.com");
        input.setSingleLine(true);
        input.setPadding(42, 24, 42, 24);

        String current = getSharedPreferences(PREFS, MODE_PRIVATE)
                .getString(KEY_SERVER, "");
        if (current != null && !current.isEmpty()) {
            input.setText(current);
        }

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(editing ? "서버 주소 변경" : "OPEN MOUTH 연결")
                .setMessage("무료 HTTPS 서버 주소를 입력해 주세요.\n예: https://open-mouth-xxxx.onrender.com")
                .setView(input)
                .setCancelable(false)
                .setPositiveButton("연결", null)
                .setNegativeButton(editing ? "취소" : null, null)
                .create();

        dialog.setOnShowListener(d -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                String url = normalizeUrl(input.getText().toString());
                if (!isValidHttpsUrl(url)) {
                    input.setError("https:// 로 시작하는 주소를 입력해 주세요.");
                    return;
                }
                getSharedPreferences(PREFS, MODE_PRIVATE)
                        .edit()
                        .putString(KEY_SERVER, url)
                        .apply();
                dialog.dismiss();
                loadServer(url);
            });
        });

        dialog.show();
    }

    private String normalizeUrl(String raw) {
        if (raw == null) return "";
        String url = raw.trim();
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url;
    }

    private boolean isValidHttpsUrl(String url) {
        return url != null
                && url.startsWith("https://")
                && url.length() > "https://a.b".length();
    }

    private void loadServer(String url) {
        progress.setVisibility(View.VISIBLE);
        webView.loadUrl(url);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            new AlertDialog.Builder(this)
                    .setTitle("OPEN MOUTH")
                    .setItems(new String[]{"앱 종료", "서버 주소 변경", "취소"}, (dialog, which) -> {
                        if (which == 0) {
                            finish();
                        } else if (which == 1) {
                            showServerDialog(true);
                        }
                    })
                    .show();
        }
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == AUDIO_PERMISSION_REQUEST && pendingWebPermission != null) {
            if (grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingWebPermission.grant(
                        new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE}
                );
            } else {
                pendingWebPermission.deny();
                Toast.makeText(
                        this,
                        "AI 영어회화를 위해 마이크 권한이 필요합니다.",
                        Toast.LENGTH_LONG
                ).show();
            }
            pendingWebPermission = null;
        }
    }
}
