import 'package:boa/core/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// 섹션 제목 + 선택적 액션 — Field Command·고객 상세 등 공통.
class BoaSectionHeader extends StatelessWidget {
  const BoaSectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 3,
          height: 16,
          margin: const EdgeInsets.only(right: 8),
          decoration: BoxDecoration(
            color: BoaColors.gold.withValues(alpha: 0.85),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        Expanded(
          child: Text(
            title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: BoaColors.textPrimary,
            ),
          ),
        ),
        if (actionLabel != null && onAction != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              foregroundColor: BoaColors.deepGreen,
              minimumSize: const Size(48, 40),
              padding: const EdgeInsets.symmetric(horizontal: 8),
            ),
            child: Text(
              actionLabel!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
      ],
    );
  }
}

/// 앱 전반 카드 — 화이트 배경·얇은 테두리·넉넉한 라운드.
class BoaSurfaceCard extends StatelessWidget {
  const BoaSurfaceCard({
    super.key,
    required this.child,
    this.margin,
    this.onTap,
    this.padding = const EdgeInsets.all(16),
    this.color,
    this.highlight = false,
  });

  final Widget child;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final bg = color ?? (highlight ? BoaColors.ivory : BoaColors.card);
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: BorderSide(
        color: highlight ? BoaColors.gold.withValues(alpha: 0.28) : BoaColors.border,
      ),
    );
    final content = Padding(padding: padding, child: child);
    return Card(
      margin: margin ?? const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      elevation: 0,
      color: bg,
      clipBehavior: Clip.antiAlias,
      shape: shape,
      child: onTap == null ? content : InkWell(onTap: onTap, child: content),
    );
  }
}

/// API/서버 미설정 안내 — 개발자 키 대신 실무자용 문구.
class BoaServerConfigHint extends StatelessWidget {
  const BoaServerConfigHint({
    super.key,
    this.title = '서버 연결이 설정되지 않았습니다',
    this.message = '앱을 다시 설치하거나 배포 담당자에게 문의해 주세요.',
  });

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: BoaColors.ivory,
                shape: BoxShape.circle,
                border: Border.all(color: BoaColors.border),
              ),
              child: const Icon(Icons.settings_suggest_outlined, size: 40, color: BoaColors.navy),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(color: BoaColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

/// 검색 필드 공통 장식.
InputDecoration boaSearchDecoration(
  BuildContext context, {
  required String hintText,
  Widget? suffixIcon,
}) {
  return InputDecoration(
    hintText: hintText,
    prefixIcon: const Icon(Icons.search, color: BoaColors.textSecondary),
    suffixIcon: suffixIcon,
    filled: true,
    fillColor: BoaColors.card,
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: BoaColors.border),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: BoaColors.navy, width: 1.5),
    ),
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
  );
}
