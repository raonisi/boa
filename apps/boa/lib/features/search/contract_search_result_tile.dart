import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/features/contracts/contract_display_logic.dart';
import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:boa/features/customers/customer_detail_screen.dart';
import 'package:boa/features/home/field_command_helpers.dart';
import 'package:flutter/material.dart';

/// 통합 검색 계약 결과 카드.
class ContractSearchResultTile extends StatelessWidget {
  const ContractSearchResultTile({
    super.key,
    required this.contract,
    this.onTap,
  });

  final BoaContractRow contract;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final title = contractDisplayTitle(contract);
    final subtitle = contractDisplaySubtitle(contract);
    final statusColors = contractStatusColors(contract.contractStatus);
    final premium = contract.monthlyPremium;

    void openDetail() {
      if (onTap != null) {
        onTap!();
        return;
      }
      final customerId = contract.customerId;
      if (customerId == null) return;
      Navigator.of(context).push<void>(
        MaterialPageRoute<void>(builder: (_) => CustomerDetailScreen(customerId: customerId)),
      );
    }

    return BoaSurfaceCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      onTap: contract.customerId != null ? openDetail : null,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: cs.secondaryContainer.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.description_outlined, size: 20, color: cs.secondary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '계약',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: cs.secondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                if (premium != null && premium > 0) ...[
                  const SizedBox(height: 6),
                  Text(
                    '월납 ${fieldCommaInt(premium)}원',
                    style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
                  ),
                ],
              ],
            ),
          ),
          if (contract.contractStatus != null && contract.contractStatus!.isNotEmpty) ...[
            const SizedBox(width: 8),
            _ContractStatusBadge(label: contract.contractStatus!, colors: statusColors),
          ],
          if (contract.customerId != null)
            Icon(Icons.chevron_right, color: cs.onSurfaceVariant, size: 22),
        ],
      ),
    );
  }
}

class _ContractStatusBadge extends StatelessWidget {
  const _ContractStatusBadge({required this.label, required this.colors});

  final String label;
  final ({int background, int foreground}) colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Color(colors.background),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(colors.foreground)),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}
