import 'package:boa/core/config/app_config.dart';
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
        body: const Center(child: Text('BOA_API_BASE_URL 을 설정해 주세요.')),
      );
    }

    final async = ref.watch(performanceStatsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('실적관리')),
      body: async.when(
        data: (stats) {
          if (stats == null) {
            return Center(child: Text('데이터가 없습니다.', style: theme.textTheme.bodyLarge));
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
            padding: const EdgeInsets.all(16),
            children: [
              Text('이번 달 (계약일 기준)', style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary)),
              const SizedBox(height: 12),
              ...rows.map((r) {
                final v = r.$2;
                final text = v == null ? '—' : '$v';
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(r.$1),
                    trailing: Text(text, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                  ),
                );
              }),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Text('$e', textAlign: TextAlign.center))),
      ),
    );
  }
}
