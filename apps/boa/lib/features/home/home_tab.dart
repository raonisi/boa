import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class HomeTab extends ConsumerWidget {
  const HomeTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final session = ref.watch(sessionProvider);

    if (!AppConfig.hasApiBase) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('API 미설정', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(
            'BOA_API_BASE_URL dart-define 을 지정하세요.',
            style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
        ],
      );
    }

    final async = ref.watch(dashboardTodayWorkProvider);

    return async.when(
      data: (d) {
        final c = d.cards;
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(dashboardTodayWorkProvider);
            await ref.read(dashboardTodayWorkProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              if (session != null)
                Text(
                  '${session.user.name}님, 안녕하세요',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
              const SizedBox(height: 16),
              Text('오늘의 브리핑', style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _StatChip(theme, '오늘 일정', '${c.todayScheduleCount}'),
                  _StatChip(theme, '미완료 일정', '${c.incompleteScheduleCount}'),
                  _StatChip(theme, '미처리 알림', '${c.pendingNotificationCount}'),
                  _StatChip(theme, '장기 미관리', '${c.longUnmanagedCustomerCount}'),
                  _StatChip(theme, '이번 달 계약', '${c.monthlyContractCount}'),
                  _StatChip(theme, '월 보험료 합', '${_comma(c.monthlyPremiumSum)}원'),
                  _StatChip(theme, '오늘 재연락', '${c.todayFollowUpCount}'),
                  _StatChip(theme, '연체 재연락', '${c.overdueFollowUpCount}'),
                ],
              ),
              const SizedBox(height: 24),
              Text('오늘 일정', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              if (d.todaySchedules.isEmpty)
                Text('오늘 예정된 일정이 없습니다.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant))
              else
                ...d.todaySchedules.take(6).map((s) => _ScheduleTile(theme, s)),
            ],
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text('불러오기 실패', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          Text('$e', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error)),
          const SizedBox(height: 16),
          FilledButton.tonal(
            onPressed: () => ref.invalidate(dashboardTodayWorkProvider),
            child: const Text('다시 시도'),
          ),
        ],
      ),
    );
  }

  static String _comma(int n) {
    final s = n.toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
      buf.write(s[i]);
    }
    return buf.toString();
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip(this.theme, this.label, this.value);

  final ThemeData theme;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Chip(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      label: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 148),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label, style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            Text(value, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

class _ScheduleTile extends StatelessWidget {
  const _ScheduleTile(this.theme, this.raw);

  final ThemeData theme;
  final Map<String, dynamic> raw;

  @override
  Widget build(BuildContext context) {
    final title = '${raw['title'] ?? '일정'}';
    final when = _fmtTime(raw['startTime']);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        dense: true,
        title: Text(title, style: theme.textTheme.bodyLarge),
        subtitle: Text(when, style: theme.textTheme.bodySmall),
      ),
    );
  }

  static String _fmtTime(dynamic t) {
    if (t == null) return '';
    final s = '$t';
    if (s.length >= 16) return s.substring(0, 16).replaceFirst('T', ' ');
    return s;
  }
}
