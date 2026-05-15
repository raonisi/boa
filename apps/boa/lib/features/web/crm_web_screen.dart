import 'package:boa/core/config/app_config.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// 웹 CRM 화면을 인앱 WebView로 연다. (앱 JWT와 웹 세션은 별도이므로 웹에서 한 번 더 로그인할 수 있음.)
class CrmWebScreen extends StatefulWidget {
  const CrmWebScreen({
    super.key,
    required this.title,
    required this.path,
  });

  final String title;
  final String path;

  @override
  State<CrmWebScreen> createState() => _CrmWebScreenState();
}

class _CrmWebScreenState extends State<CrmWebScreen> {
  late final WebViewController _controller;
  var _loading = true;
  String? _error;

  Uri get _pageUri {
    final base = AppConfig.resolvedWebBaseOrigin!;
    final p = widget.path.startsWith('/') ? widget.path : '/${widget.path}';
    return Uri.parse(base).resolve(p);
  }

  @override
  void initState() {
    super.initState();
    final uri = _pageUri;
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) {
              setState(() {
                _loading = true;
                _error = null;
              });
            }
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
          onWebResourceError: (WebResourceError e) {
            if (mounted) {
              setState(() {
                _loading = false;
                _error = e.description.isNotEmpty ? e.description : '페이지를 불러오지 못했습니다.';
              });
            }
          },
        ),
      )
      ..loadRequest(uri);
  }

  Future<void> _openInExternalBrowser() async {
    final uri = _pageUri;
    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!mounted) return;
      if (!ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('브라우저를 열 수 없습니다.')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('브라우저를 열 수 없습니다. (${e.runtimeType})')),
      );
    }
  }

  Future<void> _handleSystemBack() async {
    if (await _controller.canGoBack()) {
      await _controller.goBack();
    } else if (mounted) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleSystemBack();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.title),
          bottom: _loading
              ? PreferredSize(
                  preferredSize: const Size.fromHeight(3),
                  child: LinearProgressIndicator(
                    backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                  ),
                )
              : null,
          actions: [
            IconButton(
              tooltip: '새로고침',
              onPressed: () => _controller.reload(),
              icon: const Icon(Icons.refresh),
            ),
            IconButton(
              tooltip: '브라우저에서 열기',
              onPressed: _openInExternalBrowser,
              icon: const Icon(Icons.open_in_browser),
            ),
          ],
        ),
        body: Stack(
          children: [
            WebViewWidget(controller: _controller),
            if (_error != null)
              ColoredBox(
                color: Theme.of(context).colorScheme.surface,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: () {
                            setState(() => _error = null);
                            _controller.reload();
                          },
                          child: const Text('다시 시도'),
                        ),
                        TextButton(
                          onPressed: _openInExternalBrowser,
                          child: const Text('브라우저에서 열기'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
