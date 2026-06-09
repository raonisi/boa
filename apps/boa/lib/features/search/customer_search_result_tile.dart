import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/features/customers/customer_detail_logic.dart';
import 'package:boa/features/customers/customers_providers.dart';
import 'package:boa/features/search/quick_create_actions.dart';
import 'package:flutter/material.dart';

/// 전역 검색 결과 고객 카드.
class CustomerSearchResultTile extends StatelessWidget {
  const CustomerSearchResultTile({
    super.key,
    required this.customer,
    required this.onOpenDetail,
    this.onQuickAction,
    this.showQuickActions = true,
  });

  final BoaCustomerRow customer;
  final VoidCallback onOpenDetail;
  final void Function(QuickCreateAction action)? onQuickAction;
  final bool showQuickActions;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final initial = customer.name.isNotEmpty ? customer.name[0] : '?';

    return BoaSurfaceCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      onTap: onOpenDetail,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: const Color(0xFFE8EEF4),
                child: Text(
                  initial,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: BoaColors.navy,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      customer.name,
                      style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        if (customer.consultStatus != null && customer.consultStatus!.isNotEmpty)
                          _MetaChip(label: customer.consultStatus!, color: cs.primary),
                        if (customer.priority != null && customer.priority!.isNotEmpty)
                          _MetaChip(label: '우선순위 ${priorityLabel(customer.priority)}', color: cs.secondary),
                        if (customer.phone != null && customer.phone!.isNotEmpty)
                          _MetaChip(label: customer.phone!, color: cs.tertiary),
                      ],
                    ),
                    if (customer.nextAction != null && customer.nextAction!.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        '다음 액션 · ${customer.nextAction!}',
                        style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: cs.onSurfaceVariant, size: 22),
            ],
          ),
          if (showQuickActions && onQuickAction != null) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                _QuickActionButton(
                  label: '상담 기록',
                  icon: Icons.edit_note_outlined,
                  onTap: () => onQuickAction!(QuickCreateAction.consultation),
                ),
                _QuickActionButton(
                  label: '후속 등록',
                  icon: Icons.add_task_outlined,
                  onTap: () => onQuickAction!(QuickCreateAction.followUp),
                ),
                _QuickActionButton(
                  label: '일정 등록',
                  icon: Icons.event_outlined,
                  onTap: () => onQuickAction!(QuickCreateAction.schedule),
                ),
                _QuickActionButton(
                  label: '계약 등록',
                  icon: Icons.description_outlined,
                  onTap: () => onQuickAction!(QuickCreateAction.contract),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.22)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  const _QuickActionButton({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Material(
      color: cs.surface,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          constraints: const BoxConstraints(minHeight: 36),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.45)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: cs.primary),
              const SizedBox(width: 5),
              Text(label, style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      ),
    );
  }
}
