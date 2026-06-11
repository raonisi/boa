import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/widgets/boa_layout_helpers.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/features/more/goals_dashboard_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class GoalsScreen extends ConsumerWidget {
  const GoalsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    if (!AppConfig.hasApiBase) {
      return Scaffold(
        appBar: AppBar(title: const Text('목표관리')),
        body: const BoaServerConfigHint(),
      );
    }

    final async = ref.watch(goalsDashboardProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('목표관리')),
      body: async.when(
        data: (dash) {
          if (dash == null) {
            return const BoaEmptyState(
              icon: Icons.flag_outlined,
              title: '설정된 목표가 없습니다.',
              message: '목표가 등록되면 달성률이 표시됩니다.',
            );
          }
          final year = dash['year'];
          final month = dash['month'];
          final summary = dash['summary'];
          Map<String, dynamic>? sumMap;
          if (summary is Map) {
            sumMap = Map<String, dynamic>.from(summary);
          }
          final items = dash['items'];
          final itemList = items is List ? items : const [];

          return ListView(
            padding: BoaLayout.listPadding(context, horizontal: 16, top: 16, extraBottom: 16),
            children: [
              Text('$year년 $month월', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
              if (sumMap != null) ...[
                const SizedBox(height: 8),
                Text(
                  '목표 ${sumMap['totalGoals'] ?? 0}건 · 달성 ${sumMap['achievedGoals'] ?? 0} · 진행 ${sumMap['pendingGoals'] ?? 0}',
                  style: theme.textTheme.bodyMedium,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (sumMap['averageContractRate'] != null || sumMap['averagePremiumRate'] != null)
                  Text(
                    '평균 달성률: 계약 ${sumMap['averageContractRate'] ?? '—'}% · 보험료 ${sumMap['averagePremiumRate'] ?? '—'}%',
                    style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
              const SizedBox(height: 16),
              Text('목표별 진행', style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary)),
              const SizedBox(height: 8),
              if (itemList.isEmpty)
                Text('표시할 목표가 없습니다.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant))
              else
                ...itemList.map((raw) {
                  final m = raw is Map<String, dynamic> ? raw : (raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{});
                  final label = '${m['targetLabel'] ?? ''}';
                  final status = '${m['status'] ?? ''}';
                  final actual = m['actual'];
                  Map<String, dynamic>? act;
                  if (actual is Map) act = Map<String, dynamic>.from(actual);
                  final ar = m['achievementRate'];
                  Map<String, dynamic>? arMap;
                  if (ar is Map) arMap = Map<String, dynamic>.from(ar);
                  final sub = <String>[
                    if (act != null) '실적: 계약 ${act['contractCount'] ?? act['newContractCount'] ?? '—'}, 월납 ${act['monthlyPremium'] ?? act['monthlyPremiumTotal'] ?? '—'}',
                    if (arMap != null) '달성률: 계약 ${arMap['contractCount'] ?? '—'}%, 월납 ${arMap['monthlyPremium'] ?? '—'}%',
                    if (status.isNotEmpty) status,
                  ].join('\n');
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      title: Text(label.isEmpty ? '목표' : label, maxLines: 2, overflow: TextOverflow.ellipsis),
                      subtitle: sub.isEmpty ? null : Text(sub, style: theme.textTheme.bodySmall),
                    ),
                  );
                }),
            ],
          );
        },
        loading: () => const BoaListLoadingSkeleton(itemCount: 2),
        error: (e, _) => BoaErrorState(
          title: '목표를 불러오지 못했습니다',
          message: '$e',
          onRetry: () => ref.invalidate(goalsDashboardProvider),
        ),
      ),
    );
  }
}
