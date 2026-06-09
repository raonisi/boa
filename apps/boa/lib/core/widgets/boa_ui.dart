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
        Expanded(
          child: Text(
            title,
            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
          ),
        ),
        if (actionLabel != null && onAction != null)
          TextButton(onPressed: onAction, child: Text(actionLabel!)),
      ],
    );
  }
}

/// 앱 전반 카드 — 얇은 테두리·여백 통일.
class BoaSurfaceCard extends StatelessWidget {
  const BoaSurfaceCard({
    super.key,
    required this.child,
    this.margin,
    this.onTap,
    this.padding = const EdgeInsets.all(16),
    this.color,
  });

  final Widget child;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(14),
      side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.45)),
    );
    final content = Padding(padding: padding, child: child);
    return Card(
      margin: margin ?? const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      elevation: 0,
      color: color ?? cs.surface,
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
    final cs = theme.colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.settings_suggest_outlined, size: 44, color: cs.primary.withValues(alpha: 0.85)),
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
              style: theme.textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
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
  final cs = Theme.of(context).colorScheme;
  return InputDecoration(
    hintText: hintText,
    prefixIcon: const Icon(Icons.search),
    suffixIcon: suffixIcon,
    filled: true,
    fillColor: cs.surfaceContainerHighest.withValues(alpha: 0.35),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.5)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide(color: cs.primary, width: 1.5),
    ),
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
  );
}
