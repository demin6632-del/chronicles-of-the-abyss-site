package com.chronicles.abyss

import android.app.Activity
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebSettings
import android.webkit.WebViewClient

class MainActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val webView = WebView(this)

        webView.webViewClient = WebViewClient()

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true

        webView.loadUrl("file:///android_asset/game.html")

        setContentView(webView)
    }

    override fun onBackPressed() {
        super.onBackPressed()
    }
}
