import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// 저장·완료 등 긍정 액션에만 가벼운 햅틱 (과도한 진동 금지).
void boaLightSuccessHaptic() {
  HapticFeedback.lightImpact();
}

class BoaListLoadingSkeleton extends StatelessWidget {
  const BoaListLoadingSkeleton({super.key, this.itemCount = 4});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final base = scheme.surfaceContainerHighest.withValues(alpha: 0.55);
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: itemCount,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, __) => Card(
        elevation: 0,
        color: scheme.surface,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(height: 14, width: 140, decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(6))),
              const SizedBox(height: 10),
              Container(height: 12, width: double.infinity, decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(6))),
              const SizedBox(height: 6),
              Container(height: 12, width: 200, decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(6))),
            ],
          ),
        ),
      ),
    );
  }
}

class BoaEmptyState extends StatelessWidget {
  const BoaEmptyState({
    super.key,
    required this.title,
    this.message,
    this.icon = Icons.inbox_outlined,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.7)),
            const SizedBox(height: 16),
            Text(title, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600), textAlign: TextAlign.center),
            if (message != null) ...[
              const SizedBox(height: 8),
              Text(
                message!,
                style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                textAlign: TextAlign.center,
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 20),
              FilledButton.tonal(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

class BoaErrorState extends StatelessWidget {
  const BoaErrorState({
    super.key,
    required this.message,
    this.title = '불러오지 못했습니다',
    this.onRetry,
  });

  final String title;
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return BoaEmptyState(
      icon: Icons.cloud_off_outlined,
      title: title,
      message: message,
      actionLabel: onRetry != null ? '다시 시도' : null,
      onAction: onRetry,
    );
  }
}
