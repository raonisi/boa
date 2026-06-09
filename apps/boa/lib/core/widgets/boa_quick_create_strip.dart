import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/features/search/quick_create_actions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 가로 스크롤 빠른 실행 버튼 — Field Command Center·Global Search 공통.
class BoaQuickCreateStrip extends ConsumerWidget {
  const BoaQuickCreateStrip({
    super.key,
    this.sectionTitle = '빠른 실행',
    this.customerId,
    this.customerName,
    this.actions = const [
      QuickCreateAction.customerRegister,
      QuickCreateAction.consultation,
      QuickCreateAction.followUp,
      QuickCreateAction.schedule,
      QuickCreateAction.contract,
    ],
  });

  final String sectionTitle;
  final int? customerId;
  final String? customerName;
  final List<QuickCreateAction> actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          sectionTitle,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
            color: BoaColors.textPrimary,
          ),
        ),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (var i = 0; i < actions.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                _QuickCreateButton(
                  icon: quickCreateActionIcon(actions[i]),
                  label: quickCreateActionLabel(actions[i]),
                  onTap: () => runQuickCreate(
                    context,
                    ref,
                    actions[i],
                    customerId: customerId,
                    customerName: customerName,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _QuickCreateButton extends StatelessWidget {
  const _QuickCreateButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: BoaColors.card,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: BoaColors.border),
            color: BoaColors.ivory.withValues(alpha: 0.55),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 20, color: BoaColors.deepGreen),
              const SizedBox(width: 8),
              Text(
                label,
                style: theme.textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w500,
                  color: BoaColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
