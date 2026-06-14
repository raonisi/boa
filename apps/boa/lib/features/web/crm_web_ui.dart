import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/features/web/crm_web_route_meta.dart';
import 'package:flutter/material.dart';

/// AppBar 아래 컴팩트 브랜드·맥락 strip — Native AppBar와 톤을 맞춘다.
class CrmWebChromeStrip extends StatelessWidget {
  const CrmWebChromeStrip({
    super.key,
    required this.subtitle,
    this.pcRecommended = false,
    this.highRisk = false,
  });

  final String subtitle;
  final bool pcRecommended;
  final bool highRisk;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: BoaColors.ivory,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: BoaColors.border.withValues(alpha: 0.85))),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 3,
                height: 28,
                margin: const EdgeInsets.only(top: 2, right: 10),
                decoration: BoxDecoration(
                  color: BoaColors.deepGreen.withValues(alpha: 0.85),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'BOA 지점관리 CRM',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: BoaColors.navy,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.2,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: BoaColors.textSecondary,
                        height: 1.35,
                      ),
                    ),
                    if (pcRecommended || highRisk) ...[
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          if (pcRecommended) const CrmWebContextBadge.pcRecommended(),
                          if (highRisk) const CrmWebContextBadge.highRisk(),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class CrmWebContextBadge extends StatelessWidget {
  const CrmWebContextBadge({
    super.key,
    required this.label,
    required this.background,
    required this.foreground,
    required this.border,
    required this.icon,
  });

  const CrmWebContextBadge.pcRecommended({super.key})
      : label = 'PC 권장 업무',
        background = const Color(0xFFF4F7F5),
        foreground = BoaColors.deepGreen,
        border = const Color(0xFFD4E4DA),
        icon = Icons.computer_outlined;

  const CrmWebContextBadge.highRisk({super.key})
      : label = '보안 확인 필요',
        background = const Color(0xFFFFF8EE),
        foreground = const Color(0xFF8A5A12),
        border = const Color(0xFFE8D4A8),
        icon = Icons.verified_user_outlined;

  final String label;
  final Color background;
  final Color foreground;
  final Color border;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: foreground),
          const SizedBox(width: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: foreground,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}

/// WebView 상단 PC 권장 안내.
class CrmWebPcRecommendedBanner extends StatelessWidget {
  const CrmWebPcRecommendedBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFF7FAF8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: BoaColors.gold.withValues(alpha: 0.28))),
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
                  '넓은 화면에서 더 편하게 사용할 수 있습니다. 모바일에서는 주요 내용 확인을 중심으로 이용해 주세요.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: BoaColors.textPrimary,
                        fontWeight: FontWeight.w500,
                        height: 1.4,
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
      color: const Color(0xFFFFFBF5),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: BoaColors.gold.withValues(alpha: 0.35))),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.shield_outlined, size: 20, color: BoaColors.gold.withValues(alpha: 0.95)),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '처리 전 내용을 확인해 주세요.',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: const Color(0xFF7A5D1D),
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      message,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: BoaColors.textPrimary,
                            height: 1.4,
                          ),
                    ),
                  ],
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
      color: BoaColors.canvas.withValues(alpha: 0.96),
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
                    title ?? '화면을 불러오는 중입니다.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 12),
                  ...List.generate(
                    3,
                    (i) => Padding(
                      padding: EdgeInsets.only(bottom: i == 2 ? 0 : 8),
                      child: Container(
                        height: 10,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: BoaColors.ivory,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: BoaColors.border.withValues(alpha: 0.6)),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
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
    this.onBack,
    this.onOpenChromeTab,
    this.onOpenExternalBrowser,
    this.showHttp2Hint = false,
  });

  final String message;
  final VoidCallback onRetry;
  final VoidCallback? onBack;
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
                  child: const Icon(Icons.cloud_off_outlined, size: 40, color: BoaColors.navy),
                ),
                const SizedBox(height: 16),
                Text(
                  '정보를 다시 불러오지 못했습니다.',
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
                FilledButton.tonal(onPressed: onRetry, child: const Text('다시 시도')),
                if (onBack != null) ...[
                  const SizedBox(height: 8),
                  OutlinedButton(onPressed: onBack, child: const Text('이전 화면')),
                ],
                if (onOpenChromeTab != null) ...[
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    onPressed: onOpenChromeTab,
                    icon: const Icon(Icons.tab),
                    label: const Text('브라우저 탭으로 열기'),
                  ),
                ],
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
