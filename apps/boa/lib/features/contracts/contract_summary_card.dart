import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/features/contracts/contract_display_logic.dart';
import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:flutter/material.dart';

/// 계약 목록·고객 상세·Field Command Center 공통 요약 카드.
class ContractSummaryCard extends StatelessWidget {
  const ContractSummaryCard({
    super.key,
    required this.row,
    this.customerName,
    this.showCustomerLine = false,
    this.compact = false,
    this.onTap,
  });

  final BoaContractRow row;
  final String? customerName;
  final bool showCustomerLine;
  final bool compact;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final title = contractDisplayTitle(row);
    final subtitle = contractDisplaySubtitle(row);
    final statusColors = contractStatusColors(row.contractStatus);
    final paymentColors = paymentStatusColors(row.paymentStatus);

    final cs = theme.colorScheme;

    return BoaSurfaceCard(
      margin: EdgeInsets.symmetric(horizontal: compact ? 0 : 16, vertical: compact ? 4 : 6),
      padding: EdgeInsets.fromLTRB(14, compact ? 10 : 12, 12, compact ? 10 : 12),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8EEF4),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: BoaColors.border),
                ),
                child: const Icon(Icons.description_outlined, size: 18, color: BoaColors.navy),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (showCustomerLine && customerName != null && customerName!.trim().isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: Text(
                          customerName!.trim(),
                          style: theme.textTheme.labelMedium?.copyWith(color: cs.primary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    Text(
                      '상품명',
                      style: theme.textTheme.labelSmall?.copyWith(color: cs.onSurfaceVariant, fontWeight: FontWeight.w600),
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
                  ],
                ),
              ),
              if (row.contractStatus != null && row.contractStatus!.isNotEmpty) ...[
                const SizedBox(width: 8),
                _StatusBadge(label: row.contractStatus!, colors: statusColors),
              ],
            ],
          ),
              SizedBox(height: compact ? 8 : 10),
              Row(
                children: [
                  Expanded(
                    child: _MetaCell(
                      label: '계약일',
                      value: formatContractDateLabel(row.contractDate),
                      theme: theme,
                    ),
                  ),
                  Expanded(
                    child: _MetaCell(
                      label: '월납보험료',
                      value: formatContractPremiumLabel(row.monthlyPremium),
                      theme: theme,
                      valueStyle: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: theme.colorScheme.primary,
                      ),
                    ),
                  ),
                ],
              ),
          if (!compact && row.paymentStatus != null && row.paymentStatus!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: _StatusBadge(label: row.paymentStatus!, colors: paymentColors, small: true),
            ),
          ],
          if (onTap != null) ...[
            const SizedBox(height: 4),
            Align(
              alignment: Alignment.centerRight,
              child: Icon(Icons.chevron_right, size: 20, color: cs.onSurfaceVariant),
            ),
          ],
        ],
      ),
    );
  }
}

class _MetaCell extends StatelessWidget {
  const _MetaCell({
    required this.label,
    required this.value,
    required this.theme,
    this.valueStyle,
  });

  final String label;
  final String value;
  final ThemeData theme;
  final TextStyle? valueStyle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        const SizedBox(height: 2),
        Text(
          value,
          style: valueStyle ?? theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label, required this.colors, this.small = false});

  final String label;
  final ({int background, int foreground}) colors;
  final bool small;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 6 : 8, vertical: small ? 2 : 4),
      decoration: BoxDecoration(
        color: Color(colors.background),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: small ? 10 : 11,
          fontWeight: FontWeight.w600,
          color: Color(colors.foreground),
        ),
      ),
    );
  }
}
