package kr.raonisis.boa;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    dispatchBoaAndroidBackButton();
                }
            }
        );
    }

    @Override
    public void onResume() {
        super.onResume();
        dispatchBoaAppResume();
    }

    private void dispatchBoaAppResume() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        getBridge()
            .getWebView()
            .evaluateJavascript(
                "(function(){try{if(window.__boaHandleAppResume){window.__boaHandleAppResume();}}catch(error){}})()",
                null
            );
    }

    private void dispatchBoaAndroidBackButton() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        getBridge()
            .getWebView()
            .evaluateJavascript(
                "(function(){try{if(window.__boaHandleAndroidBackButton){return window.__boaHandleAndroidBackButton();}}catch(error){}return 'handled';})()",
                result -> {
                    if ("\"exit-app\"".equals(result)) {
                        finishAndRemoveTask();
                    }
                }
            );
    }
}
