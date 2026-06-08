import 'package:boa/features/customers/customer_detail_logic.dart';
import 'package:boa/features/customers/customers_providers.dart';
import 'package:boa/features/search/quick_create_actions.dart';
import 'package:boa/core/widgets/boa_work_action_chip.dart';
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
    final subtitle = [
      if (customer.consultStatus != null && customer.consultStatus!.isNotEmpty) customer.consultStatus!,
      if (customer.priority != null && customer.priority!.isNotEmpty) '우선순위 ${priorityLabel(customer.priority)}',
      if (customer.nextAction != null && customer.nextAction!.isNotEmpty) customer.nextAction!,
      if (customer.phone != null && customer.phone!.isNotEmpty) customer.phone!,
    ].join(' · ');

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpenDetail,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          customer.name,
                          style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (subtitle.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            subtitle,
                            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: theme.colorScheme.onSurfaceVariant),
                ],
              ),
              if (showQuickActions && onQuickAction != null) ...[
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      BoaWorkActionChip(
                        label: '상담기록',
                        icon: Icons.edit_note_outlined,
                        onPressed: () => onQuickAction!(QuickCreateAction.consultation),
                      ),
                      const SizedBox(width: 6),
                      BoaWorkActionChip(
                        label: '후속',
                        icon: Icons.add_task_outlined,
                        onPressed: () => onQuickAction!(QuickCreateAction.followUp),
                      ),
                      const SizedBox(width: 6),
                      BoaWorkActionChip(
                        label: '일정',
                        icon: Icons.event_outlined,
                        onPressed: () => onQuickAction!(QuickCreateAction.schedule),
                      ),
                      const SizedBox(width: 6),
                      BoaWorkActionChip(
                        label: '계약',
                        icon: Icons.description_outlined,
                        onPressed: () => onQuickAction!(QuickCreateAction.contract),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
