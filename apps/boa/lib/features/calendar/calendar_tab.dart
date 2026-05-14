import 'package:boa/core/config/app_config.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CalendarTab extends ConsumerWidget {
  const CalendarTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);

    if (!AppConfig.hasApiBase) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'BOA_API_BASE_URL 을 설정하면 오늘·미완료 일정이 표시됩니다.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
        ),
      );
    }

    final async = ref.watch(dashboardTodayWorkProvider);

    return async.when(
      data: (d) {
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(dashboardTodayWorkProvider);
            await ref.read(dashboardTodayWorkProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text('오늘 일정', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              if (d.todaySchedules.isEmpty)
                Text('없음', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant))
              else
                ...d.todaySchedules.map((s) => _ScheduleCard(theme, s)),
              const SizedBox(height: 24),
              Text('기한 경과·미완료', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              if (d.incompleteSchedules.isEmpty)
                Text('없음', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant))
              else
                ...d.incompleteSchedules.map((s) => _ScheduleCard(theme, s)),
            ],
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('$e', textAlign: TextAlign.center)),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  const _ScheduleCard(this.theme, this.raw);

  final ThemeData theme;
  final Map<String, dynamic> raw;

  @override
  Widget build(BuildContext context) {
    final title = '${raw['title'] ?? '일정'}';
    final status = '${raw['status'] ?? ''}';
    final start = _fmt(raw['startTime']);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(title),
        subtitle: Text([start, status].where((e) => e.isNotEmpty).join(' · ')),
      ),
    );
  }

  static String _fmt(dynamic t) {
    if (t == null) return '';
    final s = '$t';
    if (s.length >= 16) return s.substring(0, 16).replaceFirst('T', ' ');
    return s;
  }
}
