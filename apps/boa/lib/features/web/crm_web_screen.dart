import 'dart:async';

import 'package:boa/core/config/app_config.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// 일부 서버·CDN은 WebView+모바일 UA에서만 `ERR_HTTP2_PROTOCOL_ERROR`가 나고,
/// **데스크톱 Chrome UA**로는 HTTP/2 협상이 통과하는 경우가 있어 **먼저 데스크톱 UA**로 연다.
/// 그래도 실패하면 **모바일 UA**로 한 번 더 시도한다.
const String _kCrmEmbeddedChromeUa =
    'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

const String _kCrmEmbeddedDesktopChromeUa =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/// 웹 CRM 화면을 인앱 WebView로 연다. (앱 JWT와 웹 세션은 별도이므로 웹에서 한 번 더 로그인할 수 있음.)
class CrmWebScreen extends StatefulWidget {
  const CrmWebScreen({
    super.key,
    required this.title,
    required this.path,
    required this.sessionToken,
  });

  final String title;
  final String path;
  final String sessionToken;

  @override
  State<CrmWebScreen> createState() => _CrmWebScreenState();
}

class _CrmWebScreenState extends State<CrmWebScreen> {
  late final WebViewController _controller;
  var _loading = true;
  String? _error;
  var _http2AlternateUaTried = false;
  var _http2AutoLaunchedChromeTab = false;

  /// WebView는 HTTP/2에서 계속 실패하지만 Chrome 탭으로는 열린 경우 — 오류 패널 대신 안내 화면을 쓴다.
  var _http2ChromeTabHandoff = false;

  bool _looksLikeHttp2Failure(WebResourceError e) {
    final d = e.description.toUpperCase();
    if (d.contains('ERR_HTTP2')) return true;
    if (d.contains('HTTP2') && d.contains('PROTOCOL')) return true;
    if (d.contains('HTTP_2') && d.contains('PROTOCOL')) return true;
    return false;
  }

  Uri get _pageUri {
    final base = AppConfig.resolvedWebBaseOrigin!;
    final p = widget.path.startsWith('/') ? widget.path : '/${widget.path}';
    return Uri.parse(base).resolve(p);
  }

  Uri get _webSessionUri {
    final base = AppConfig.resolvedWebBaseOrigin!;
    return Uri.parse(base).resolve('/api/mobile/web-session').replace(
      queryParameters: {'redirect': _pageUri.path},
    );
  }

  @override
  void initState() {
    super.initState();
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
            if (e.isForMainFrame == false) return;
            final desc = e.description;
            if (mounted &&
                _looksLikeHttp2Failure(e) &&
                !_http2AlternateUaTried) {
              _http2AlternateUaTried = true;
              unawaited(_reloadWithMobileUserAgent());
              return;
            }
            if (mounted) {
              final isHttp2 = _looksLikeHttp2Failure(e);
              final exhaustedUa = _http2AlternateUaTried;
              setState(() {
                _loading = false;
                _error = desc.isNotEmpty ? desc : '페이지를 불러오지 못했습니다.';
              });
              // WebView로는 HTTP/2가 계속 깨질 때가 많아, 재시도(모바일 UA)까지 끝난 뒤
              // Chrome Custom Tab / SFSafariView를 한 번 자동으로 연다.
              if (isHttp2 &&
                  exhaustedUa &&
                  !_http2AutoLaunchedChromeTab &&
                  !kIsWeb) {
                _http2AutoLaunchedChromeTab = true;
                WidgetsBinding.instance.addPostFrameCallback((_) async {
                  if (!mounted) return;
                  final ok = await _openBestAvailableBrowser(
                      showFailureSnackBar: true);
                  if (!mounted) return;
                  if (ok) {
                    setState(() {
                      _http2ChromeTabHandoff = true;
                      _error = null;
                      _loading = false;
                    });
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Chrome 탭으로 열었습니다. 작업은 탭에서 이어가 주세요.'),
                      ),
                    );
                  }
                });
              }
            }
          },
        ),
      );
    unawaited(_applyUserAgentAndLoad());
  }

  Future<void> _applyUserAgentAndLoad() async {
    try {
      await _controller.setUserAgent(_kCrmEmbeddedDesktopChromeUa);
    } catch (_) {}
    await _controller.loadRequest(
      _webSessionUri,
      headers: {'Authorization': 'Bearer ${widget.sessionToken}'},
    );
  }

  Future<void> _reloadWithMobileUserAgent() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _controller.clearCache();
    } catch (_) {}
    try {
      await _controller.setUserAgent(_kCrmEmbeddedChromeUa);
    } catch (_) {}
    await _controller.loadRequest(
      _webSessionUri,
      headers: {'Authorization': 'Bearer ${widget.sessionToken}'},
    );
  }

  /// Android: Chrome Custom Tabs / iOS: SFSafariViewController — WebView와 달리
  /// 시스템 브라우저 엔진이라 `ERR_HTTP2_PROTOCOL_ERROR`가 사라지는 경우가 있다.
  ///
  /// [showFailureSnackBar]가 false이면 실패 시 스낵바를 띄우지 않는다(호출부에서 처리).
  Future<bool> _openInChromeCustomTab({bool showFailureSnackBar = true}) async {
    final uri = _pageUri;
    try {
      final supported = await supportsLaunchMode(LaunchMode.inAppBrowserView);
      if (!supported) {
        if (showFailureSnackBar && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text('Chrome 탭을 사용할 수 없어 외부 브라우저로 시도해 주세요.')),
          );
        }
        return false;
      }
      final ok = await launchUrl(
        uri,
        mode: LaunchMode.inAppBrowserView,
        browserConfiguration: const BrowserConfiguration(showTitle: true),
      );
      if (!mounted) return ok;
      if (!ok && showFailureSnackBar) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Chrome 탭을 열 수 없습니다.')),
        );
      }
      return ok;
    } catch (e) {
      if (!mounted) return false;
      if (showFailureSnackBar) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Chrome 탭을 열 수 없습니다. (${e.runtimeType})')),
        );
      }
      return false;
    }
  }

  Future<bool> _openBestAvailableBrowser(
      {bool showFailureSnackBar = true}) async {
    final inAppOk = await _openInChromeCustomTab(showFailureSnackBar: false);
    if (inAppOk) return true;

    try {
      final ok =
          await launchUrl(_pageUri, mode: LaunchMode.externalApplication);
      if (!mounted) return ok;
      if (!ok && showFailureSnackBar) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Chrome 탭과 외부 브라우저를 열 수 없습니다.')),
        );
      }
      return ok;
    } catch (e) {
      if (!mounted) return false;
      if (showFailureSnackBar) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('브라우저를 열 수 없습니다. (${e.runtimeType})')),
        );
      }
      return false;
    }
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
    if (_http2ChromeTabHandoff) {
      if (mounted) Navigator.of(context).pop();
      return;
    }
    if (await _controller.canGoBack()) {
      await _controller.goBack();
    } else if (mounted) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _openChromeTabAndEnterHandoff() async {
    setState(() {
      _http2ChromeTabHandoff = true;
      _error = null;
      _loading = true;
    });
    final ok = await _openBestAvailableBrowser();
    if (!mounted) return;
    if (!ok) {
      setState(() {
        _loading = false;
        _error = '브라우저를 열 수 없습니다. 네트워크 또는 기본 브라우저 설정을 확인해 주세요.';
      });
      return;
    }
    setState(() {
      _http2ChromeTabHandoff = true;
      _error = null;
      _loading = false;
    });
  }

  void _retryWebViewFromHandoff() {
    setState(() {
      _http2ChromeTabHandoff = false;
      _error = null;
      _loading = true;
      _http2AlternateUaTried = false;
      _http2AutoLaunchedChromeTab = false;
    });
    unawaited(_applyUserAgentAndLoad());
  }

  Widget _buildChromeTabHandoffBody(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 400),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.tab, size: 48, color: scheme.primary),
              const SizedBox(height: 16),
              Text(
                '이 메뉴는 Chrome 탭에서 열립니다',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 12),
              Text(
                '앱 안 WebView는 이 서버와 HTTP/2에서 호환되지 않습니다. '
                '페이지는 Chrome 탭(또는 아래 버튼)에서 열리며, 그곳에서 그대로 이용하시면 됩니다.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () => unawaited(_openChromeTabAndEnterHandoff()),
                icon: const Icon(Icons.tab),
                label: const Text('Chrome 탭으로 다시 열기'),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: _openInExternalBrowser,
                child: const Text('외부 브라우저에서 열기'),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: _retryWebViewFromHandoff,
                child: const Text('WebView로 다시 시도 (개발·점검용)'),
              ),
            ],
          ),
        ),
      ),
    );
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
                    backgroundColor:
                        Theme.of(context).colorScheme.surfaceContainerHighest,
                  ),
                )
              : null,
          actions: [
            IconButton(
              tooltip: '새로고침',
              onPressed: () {
                setState(() {
                  _error = null;
                  _loading = true;
                  _http2AlternateUaTried = false;
                  _http2AutoLaunchedChromeTab = false;
                  _http2ChromeTabHandoff = false;
                });
                unawaited(_applyUserAgentAndLoad());
              },
              icon: const Icon(Icons.refresh),
            ),
            IconButton(
              tooltip: 'Chrome 탭으로 열기',
              onPressed: () => unawaited(_openChromeTabAndEnterHandoff()),
              icon: const Icon(Icons.tab),
            ),
            IconButton(
              tooltip: '외부 브라우저에서 열기',
              onPressed: _openInExternalBrowser,
              icon: const Icon(Icons.open_in_browser),
            ),
          ],
        ),
        body: _http2ChromeTabHandoff
            ? _buildChromeTabHandoffBody(context)
            : Stack(
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
                              if (_error!.toUpperCase().contains('ERR_HTTP2') ||
                                  _error!.toUpperCase().contains('HTTP2')) ...[
                                const SizedBox(height: 12),
                                Text(
                                  '인앱 WebView와 서버 HTTP/2 협상 문제로 보입니다. 잠시 후 Chrome 탭이 자동으로 열릴 수 있습니다. 열리지 않으면 아래 버튼을 누르거나, 서버(Nginx 등)의 HTTP/2 설정을 점검해 주세요.',
                                  textAlign: TextAlign.center,
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodySmall
                                      ?.copyWith(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurfaceVariant,
                                      ),
                                ),
                              ],
                              const SizedBox(height: 16),
                              if (_error!.toUpperCase().contains('ERR_HTTP2') ||
                                  _error!.toUpperCase().contains('HTTP2')) ...[
                                FilledButton.icon(
                                  onPressed: () => unawaited(
                                      _openChromeTabAndEnterHandoff()),
                                  icon: const Icon(Icons.tab),
                                  label: const Text('Chrome 탭으로 열기'),
                                ),
                                const SizedBox(height: 8),
                              ],
                              FilledButton.tonal(
                                onPressed: () {
                                  setState(() {
                                    _error = null;
                                    _loading = true;
                                    _http2AlternateUaTried = false;
                                    _http2AutoLaunchedChromeTab = false;
                                    _http2ChromeTabHandoff = false;
                                  });
                                  unawaited(_applyUserAgentAndLoad());
                                },
                                child: const Text('다시 시도'),
                              ),
                              TextButton(
                                onPressed: _openInExternalBrowser,
                                child: const Text('외부 브라우저에서 열기'),
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
