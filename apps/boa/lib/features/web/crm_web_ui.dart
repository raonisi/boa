import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/features/web/crm_web_route_meta.dart';
import 'package:flutter/material.dart';

/// WebView 상단 PC 권장 안내.
class CrmWebPcRecommendedBanner extends StatelessWidget {
  const CrmWebPcRecommendedBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: BoaColors.ivory,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: BoaColors.gold.withValues(alpha: 0.35))),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.computer_outlined, size: 20, color: BoaColors.deepGreen),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '이 화면은 대량·관리자 작업이 포함되어 PC 사용을 권장합니다.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: BoaColors.textPrimary,
                        fontWeight: FontWeight.w600,
                        height: 1.35,
                      ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 고위험 작업 주의 안내.
class CrmWebHighRiskBanner extends StatelessWidget {
  const CrmWebHighRiskBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFFFF8F6),
      child: DecoratedBox(
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Color(0xFFF5C6C2))),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.warning_amber_rounded, size: 20, color: BoaColors.urgent),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  message,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: BoaColors.urgent,
                        fontWeight: FontWeight.w600,
                        height: 1.35,
                      ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// WebView 로딩 중 오버레이.
class CrmWebLoadingOverlay extends StatelessWidget {
  const CrmWebLoadingOverlay({super.key, this.title});

  final String? title;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ColoredBox(
      color: BoaColors.canvas.withValues(alpha: 0.94),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 320),
          child: Card(
            elevation: 0,
            color: BoaColors.card,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: BoaColors.border),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(
                    width: 36,
                    height: 36,
                    child: CircularProgressIndicator(strokeWidth: 3, color: BoaColors.navy),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    title ?? '관리자 화면을 불러오는 중입니다.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '잠시만 기다려 주세요. 연결이 느리면 네트워크 상태를 확인해 주세요.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall?.copyWith(color: BoaColors.textSecondary),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// WebView 오류 패널 — raw URL/token 미표시.
class CrmWebErrorPanel extends StatelessWidget {
  const CrmWebErrorPanel({
    super.key,
    required this.message,
    required this.onRetry,
    this.onOpenChromeTab,
    this.onOpenExternalBrowser,
    this.showHttp2Hint = false,
  });

  final String message;
  final VoidCallback onRetry;
  final VoidCallback? onOpenChromeTab;
  final VoidCallback? onOpenExternalBrowser;
  final bool showHttp2Hint;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ColoredBox(
      color: BoaColors.canvas,
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: BoaColors.ivory,
                    shape: BoxShape.circle,
                    border: Border.all(color: BoaColors.border),
                  ),
                  child: const Icon(Icons.cloud_off_outlined, size: 40, color: BoaColors.urgent),
                ),
                const SizedBox(height: 16),
                Text(
                  '화면을 불러오지 못했습니다.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(color: BoaColors.textSecondary),
                ),
                if (showHttp2Hint) ...[
                  const SizedBox(height: 10),
                  Text(
                    '앱 내 화면과 서버 연결 방식 문제일 수 있습니다. 브라우저 탭으로 열기를 시도해 주세요.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall?.copyWith(color: BoaColors.textSecondary),
                  ),
                ],
                const SizedBox(height: 20),
                if (onOpenChromeTab != null) ...[
                  FilledButton.icon(
                    onPressed: onOpenChromeTab,
                    icon: const Icon(Icons.tab),
                    label: const Text('브라우저 탭으로 열기'),
                  ),
                  const SizedBox(height: 8),
                ],
                FilledButton.tonal(onPressed: onRetry, child: const Text('다시 시도')),
                if (onOpenExternalBrowser != null) ...[
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: onOpenExternalBrowser,
                    child: const Text('외부 브라우저에서 열기'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Drawer WebView 메뉴 타일.
class CrmWebDrawerTile extends StatelessWidget {
  const CrmWebDrawerTile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.category,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final CrmWebRouteCategory? category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListTile(
      leading: Icon(icon, color: BoaColors.navy),
      title: Text(title),
      subtitle: subtitle == null && category == null
          ? null
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (subtitle != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(subtitle!, style: theme.textTheme.bodySmall?.copyWith(color: BoaColors.textSecondary)),
                  ),
                if (category != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      crmWebCategoryLabel(category!),
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: BoaColors.deepGreen,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
      isThreeLine: subtitle != null || category != null,
      onTap: onTap,
    );
  }
}
