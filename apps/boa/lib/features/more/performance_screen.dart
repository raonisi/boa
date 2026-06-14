import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/widgets/boa_layout_helpers.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/core/widgets/boa_user_messages.dart';
import 'package:boa/features/more/performance_stats_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class PerformanceScreen extends ConsumerWidget {
  const PerformanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    if (!AppConfig.hasApiBase) {
      return Scaffold(
        appBar: AppBar(title: const Text('실적관리')),
        body: const BoaServerConfigHint(),
      );
    }

    final async = ref.watch(performanceStatsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('실적관리')),
      body: async.when(
        data: (stats) {
          if (stats == null) {
            return const BoaEmptyState(
              icon: Icons.bar_chart_outlined,
              title: '이번 달 실적 데이터가 없습니다.',
              message: '계약·상담이 등록되면 실적이 집계됩니다.',
            );
          }
          final rows = <(String label, dynamic value)>[
            ('배정', stats['assigned']),
            ('미상담', stats['uncontacted']),
            ('부재', stats['absent']),
            ('통화완료', stats['called']),
            ('상담예정', stats['scheduled']),
            ('설계중', stats['designing']),
            ('계약', stats['contracted']),
            ('보류', stats['held']),
            ('거절', stats['rejected']),
            ('신규계약 수', stats['newContractCount'] ?? stats['contractCount']),
            ('월납 합계', stats['monthlyPremiumSum'] ?? stats['monthlyPremiumTotal']),
            ('상담율(%)', stats['consultRate']),
            ('계약율(%)', stats['contractRate']),
            ('유지 계약 수', stats['activeContracts']),
            ('해지·실효 수', stats['canceledContracts']),
          ];
          return ListView(
            padding: BoaLayout.listPadding(context, horizontal: 16, top: 16, extraBottom: 16),
            children: [
              Text('이번 달 (계약일 기준)', style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary)),
              const SizedBox(height: 12),
              ...rows.map((r) {
                final v = r.$2;
                final text = v == null ? '—' : '$v';
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(r.$1, maxLines: 2, overflow: TextOverflow.ellipsis),
                    trailing: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 120),
                      child: Text(
                        text,
                        style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.end,
                      ),
                    ),
                  ),
                );
              }),
            ],
          );
        },
        loading: () => const BoaListLoadingSkeleton(itemCount: 3),
        error: (e, _) => BoaErrorState(
          title: '실적을 불러오지 못했습니다',
          message: boaUserFacingErrorMessage(e, context: BoaUserErrorContext.performance),
          onRetry: () => ref.invalidate(performanceStatsProvider),
        ),
      ),
    );
  }
}
