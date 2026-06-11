import 'package:boa/core/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

DateTime? _lastBoaHapticAt;
const _boaHapticMinGap = Duration(milliseconds: 80);

void _runBoaHaptic(void Function() feedback) {
  final now = DateTime.now();
  if (_lastBoaHapticAt != null && now.difference(_lastBoaHapticAt!) < _boaHapticMinGap) {
    return;
  }
  _lastBoaHapticAt = now;
  feedback();
}

/// 탭·필터·카드 선택 등 상태/선택 변화에만 사용.
void boaSelectionHaptic() {
  _runBoaHaptic(HapticFeedback.selectionClick);
}

/// 저장·완료 등 긍정 액션에만 가벼운 햅틱 (과도한 진동 금지).
void boaLightSuccessHaptic() {
  _runBoaHaptic(HapticFeedback.lightImpact);
}

/// @visibleForTesting
void resetBoaHapticThrottleForTest() {
  _lastBoaHapticAt = null;
}

class BoaListLoadingSkeleton extends StatelessWidget {
  const BoaListLoadingSkeleton({super.key, this.itemCount = 4});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    const base = Color(0xFFEDEFF2);
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: itemCount,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, __) => Card(
        elevation: 0,
        color: BoaColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: BoaColors.border),
        ),
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
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: BoaColors.ivory,
                shape: BoxShape.circle,
                border: Border.all(color: BoaColors.border),
              ),
              child: Icon(icon, size: 34, color: BoaColors.textSecondary.withValues(alpha: 0.85)),
            ),
            const SizedBox(height: 16),
            Text(title, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600), textAlign: TextAlign.center),
            if (message != null) ...[
              const SizedBox(height: 8),
              Text(
                message!,
                style: theme.textTheme.bodyMedium?.copyWith(color: BoaColors.textSecondary),
                textAlign: TextAlign.center,
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 20),
              FilledButton.tonal(
                onPressed: onAction,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFE8EEF4),
                  foregroundColor: BoaColors.navy,
                ),
                child: Text(actionLabel!),
              ),
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
