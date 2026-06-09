import 'dart:async';

import 'package:boa/core/config/app_config.dart';
import 'package:boa/features/web/crm_web_error_messages.dart';
import 'package:boa/features/web/crm_web_portal_paths.dart';
import 'package:boa/features/web/crm_web_route_meta.dart';
import 'package:boa/features/web/crm_web_ui.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// 일부 서버·CDN은 WebView+모바일 UA에서만 `ERR_HTTP2_PROTOCOL_ERROR`가 나고,
/// **데스크톱 Chrome UA**로는 HTTP/2 협상이 통과하는 경우가 있어 **먼저 데스크톱 UA**로 연다.
const String _kCrmEmbeddedChromeUa =
    'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

const String _kCrmEmbeddedDesktopChromeUa =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/// 웹 CRM 화면을 인앱 WebView로 연다. JWT는 Authorization 헤더로만 전달하며 UI/URL에 노출하지 않는다.
class CrmWebScreen extends StatefulWidget {
  const CrmWebScreen({
    super.key,
    required this.title,
    required this.path,
    required this.sessionToken,
    this.subtitle,
    this.pcRecommended = false,
    this.highRisk = false,
    this.highRiskNotice,
    this.category = CrmWebRouteCategory.adminWork,
  });

  final String title;
  final String path;
  final String sessionToken;
  final String? subtitle;
  final bool pcRecommended;
  final bool highRisk;
  final String? highRiskNotice;
  final CrmWebRouteCategory category;

  /// Drawer `routeKey` 기준 메타·경로로 WebView 화면을 연다.
  factory CrmWebScreen.fromRouteKey({
    required String routeKey,
    required String sessionToken,
  }) {
    final meta = crmWebRouteMetaForKey(routeKey);
    final path = crmWebPathForRouteKey(routeKey);
    if (meta == null || path == null) {
      throw ArgumentError('Unknown CRM web route key: $routeKey');
    }
    return CrmWebScreen(
      title: meta.title,
      subtitle: meta.subtitle,
      path: path,
      sessionToken: sessionToken,
      pcRecommended: meta.pcRecommended,
      highRisk: meta.highRisk,
      highRiskNotice: meta.highRiskNotice,
      category: meta.category,
    );
  }

  /// SPA 경로 기준 메타를 보조로 적용한다.
  factory CrmWebScreen.forPath({
    required String path,
    required String sessionToken,
    String? title,
  }) {
    final meta = crmWebRouteMetaForPath(path, titleOverride: title);
    return CrmWebScreen(
      title: meta.title,
      subtitle: meta.subtitle,
      path: path,
      sessionToken: sessionToken,
      pcRecommended: meta.pcRecommended,
      highRisk: meta.highRisk,
      highRiskNotice: meta.highRiskNotice,
      category: meta.category,
    );
  }

  @override
  State<CrmWebScreen> createState() => _CrmWebScreenState();
}

class _CrmWebScreenState extends State<CrmWebScreen> {
  late final WebViewController _controller;
  var _loading = true;
  String? _rawError;
  var _http2AlternateUaTried = false;
  var _http2AutoLaunchedChromeTab = false;
  var _http2ChromeTabHandoff = false;
  var _reloadInProgress = false;
  int _reloadGeneration = 0;

  bool _looksLikeHttp2Failure(WebResourceError e) => webViewErrorLooksLikeHttp2(e.description);

  Uri get _pageUri {
    final base = AppConfig.resolvedWebBaseOrigin!;
    final p = widget.path.startsWith('/') ? widget.path : '/${widget.path}';
    return Uri.parse(base).resolve(p);
  }

  Uri get _webSessionUri {
    final base = AppConfig.resolvedWebBaseOrigin!;
    return Uri.parse(base).resolve('/api/mobile/web-session').replace(
          queryParameters: {'redirect': crmWebRedirectPathWithQuery(_pageUri)},
        );
  }

  String get _displayError =>
      _rawError == null ? '화면을 불러오지 못했습니다.' : userFacingWebViewError(_rawError);

  bool get _showHttp2Hint => webViewErrorLooksLikeHttp2(_rawError);

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
                _rawError = null;
              });
            }
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
          onWebResourceError: (WebResourceError e) {
            if (e.isForMainFrame == false) return;
            if (mounted && _looksLikeHttp2Failure(e) && !_http2AlternateUaTried) {
              _http2AlternateUaTried = true;
              unawaited(_reloadWithMobileUserAgent());
              return;
            }
            if (mounted) {
              final isHttp2 = _looksLikeHttp2Failure(e);
              final exhaustedUa = _http2AlternateUaTried;
              setState(() {
                _loading = false;
                _rawError = e.description.isNotEmpty ? e.description : 'load_failed';
              });
              if (isHttp2 && exhaustedUa && !_http2AutoLaunchedChromeTab && !kIsWeb) {
                _http2AutoLaunchedChromeTab = true;
                WidgetsBinding.instance.addPostFrameCallback((_) async {
                  if (!mounted) return;
                  final ok = await _openBestAvailableBrowser(showFailureSnackBar: true);
                  if (!mounted) return;
                  if (ok) {
                    setState(() {
                      _http2ChromeTabHandoff = true;
                      _rawError = null;
                      _loading = false;
                    });
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('브라우저 탭으로 열었습니다. 작업은 탭에서 이어가 주세요.')),
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
    if (_reloadInProgress) return;
    final gen = ++_reloadGeneration;
    _reloadInProgress = true;
    if (mounted) {
      setState(() {
        _loading = true;
        _rawError = null;
      });
    }
    try {
      try {
        await _controller.setUserAgent(_kCrmEmbeddedDesktopChromeUa);
      } catch (_) {}
      if (gen != _reloadGeneration || !mounted) return;
      await _controller.loadRequest(
        _webSessionUri,
        headers: {'Authorization': 'Bearer ${widget.sessionToken}'},
      );
    } finally {
      if (gen == _reloadGeneration) _reloadInProgress = false;
    }
  }

  Future<void> _reloadWithMobileUserAgent() async {
    if (!mounted || _reloadInProgress) return;
    final gen = ++_reloadGeneration;
    _reloadInProgress = true;
    setState(() {
      _loading = true;
      _rawError = null;
    });
    try {
      try {
        await _controller.clearCache();
      } catch (_) {}
      try {
        await _controller.setUserAgent(_kCrmEmbeddedChromeUa);
      } catch (_) {}
      if (gen != _reloadGeneration || !mounted) return;
      await _controller.loadRequest(
        _webSessionUri,
        headers: {'Authorization': 'Bearer ${widget.sessionToken}'},
      );
    } finally {
      if (gen == _reloadGeneration) _reloadInProgress = false;
    }
  }

  Future<bool> _openInChromeCustomTab({bool showFailureSnackBar = true}) async {
    final uri = _pageUri;
    try {
      final supported = await supportsLaunchMode(LaunchMode.inAppBrowserView);
      if (!supported) {
        if (showFailureSnackBar && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('브라우저 탭을 사용할 수 없어 외부 브라우저로 시도해 주세요.')),
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
          const SnackBar(content: Text('브라우저 탭을 열 수 없습니다.')),
        );
      }
      return ok;
    } catch (_) {
      if (!mounted) return false;
      if (showFailureSnackBar) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('브라우저 탭을 열 수 없습니다.')),
        );
      }
      return false;
    }
  }

  Future<bool> _openBestAvailableBrowser({bool showFailureSnackBar = true}) async {
    final inAppOk = await _openInChromeCustomTab(showFailureSnackBar: false);
    if (inAppOk) return true;

    try {
      final ok = await launchUrl(_pageUri, mode: LaunchMode.externalApplication);
      if (!mounted) return ok;
      if (!ok && showFailureSnackBar) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('브라우저 탭과 외부 브라우저를 열 수 없습니다.')),
        );
      }
      return ok;
    } catch (_) {
      if (!mounted) return false;
      if (showFailureSnackBar) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('브라우저를 열 수 없습니다.')),
        );
      }
      return false;
    }
  }

  Future<void> _openInExternalBrowser() async {
    try {
      final ok = await launchUrl(_pageUri, mode: LaunchMode.externalApplication);
      if (!mounted) return;
      if (!ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('브라우저를 열 수 없습니다.')),
        );
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('브라우저를 열 수 없습니다.')),
      );
    }
  }

  Future<void> _handleSystemBack() async {
    if (_http2ChromeTabHandoff) {
      if (mounted) Navigator.of(context).pop();
      return;
    }
    try {
      if (await _controller.canGoBack()) {
        await _controller.goBack();
        return;
      }
    } catch (_) {}
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _openChromeTabAndEnterHandoff() async {
    setState(() {
      _http2ChromeTabHandoff = true;
      _rawError = null;
      _loading = true;
    });
    final ok = await _openBestAvailableBrowser();
    if (!mounted) return;
    if (!ok) {
      setState(() {
        _loading = false;
        _rawError = 'browser_launch_failed';
      });
      return;
    }
    setState(() {
      _http2ChromeTabHandoff = true;
      _rawError = null;
      _loading = false;
    });
  }

  void _retryWebViewFromHandoff() {
    setState(() {
      _http2ChromeTabHandoff = false;
      _rawError = null;
      _loading = true;
      _http2AlternateUaTried = false;
      _http2AutoLaunchedChromeTab = false;
    });
    unawaited(_applyUserAgentAndLoad());
  }

  void _retryLoad() {
    setState(() {
      _rawError = null;
      _loading = true;
      _http2AlternateUaTried = false;
      _http2AutoLaunchedChromeTab = false;
      _http2ChromeTabHandoff = false;
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
                '이 메뉴는 브라우저 탭에서 열립니다',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 12),
              Text(
                '앱 내 화면은 이 서버와 연결 방식이 맞지 않을 수 있습니다. '
                '아래 버튼으로 브라우저 탭에서 열어 작업을 이어가 주세요.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () => unawaited(_openChromeTabAndEnterHandoff()),
                icon: const Icon(Icons.tab),
                label: const Text('브라우저 탭으로 다시 열기'),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: _openInExternalBrowser,
                child: const Text('외부 브라우저에서 열기'),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: _retryWebViewFromHandoff,
                child: const Text('앱 내 화면으로 다시 시도'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderSubtitle(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final subtitle = widget.subtitle ?? '웹 CRM · ${crmWebCategoryLabel(widget.category)}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          subtitle,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.labelSmall?.copyWith(color: cs.onSurfaceVariant),
        ),
        Text(
          crmWebCategoryLabel(widget.category),
          style: theme.textTheme.labelSmall?.copyWith(
            color: cs.primary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  List<Widget> _buildContextBanners() {
    final banners = <Widget>[];
    if (widget.pcRecommended) {
      banners.add(const CrmWebPcRecommendedBanner());
    }
    if (widget.highRisk) {
      banners.add(CrmWebHighRiskBanner(
        message: widget.highRiskNotice ??
            '삭제·병합·인수인계 작업은 실행 전 대상을 다시 확인해 주세요.',
      ));
    }
    return banners;
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
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            tooltip: '뒤로',
            onPressed: () => unawaited(_handleSystemBack()),
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.title, maxLines: 1, overflow: TextOverflow.ellipsis),
              _buildHeaderSubtitle(context),
            ],
          ),
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
              onPressed: _reloadInProgress ? null : _retryLoad,
              icon: const Icon(Icons.refresh),
            ),
            IconButton(
              tooltip: '브라우저 탭으로 열기',
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
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ..._buildContextBanners(),
                  Expanded(
                    child: Stack(
                      children: [
                        WebViewWidget(controller: _controller),
                        if (_loading && _rawError == null)
                          CrmWebLoadingOverlay(title: '${widget.title} 불러오는 중…'),
                        if (_rawError != null)
                          CrmWebErrorPanel(
                            message: _displayError,
                            showHttp2Hint: _showHttp2Hint,
                            onRetry: _retryLoad,
                            onOpenChromeTab: _showHttp2Hint
                                ? () => unawaited(_openChromeTabAndEnterHandoff())
                                : null,
                            onOpenExternalBrowser: _openInExternalBrowser,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
