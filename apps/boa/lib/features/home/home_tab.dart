import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:boa/features/calendar/calendar_agenda_provider.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:boa/features/more/performance_screen.dart';
import 'package:boa/features/more/performance_stats_provider.dart';
import 'package:boa/features/notifications/unread_count_provider.dart';
import 'package:boa/features/shell/shell_tab_provider.dart';
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
    final unreadAsync = ref.watch(unreadNotificationCountProvider);

    return async.when(
      data: (d) {
        final c = d.cards;
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(dashboardTodayWorkProvider);
            ref.invalidate(unreadNotificationCountProvider);
            ref.invalidate(calendarAgendaProvider);
            ref.invalidate(performanceStatsProvider);
            await Future.wait<void>([
              ref.read(dashboardTodayWorkProvider.future),
              ref.read(unreadNotificationCountProvider.future),
              ref.read(calendarAgendaProvider.future),
              ref.read(performanceStatsProvider.future),
            ]);
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(20),
            children: [
              if (session != null)
                Text(
                  '${session.user.name}님, 안녕하세요',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
              unreadAsync.when(
                data: (n) => n > 0
                    ? Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: InkWell(
                            onTap: () => ref.read(shellTabIndexProvider.notifier).state = 4,
                            borderRadius: BorderRadius.circular(20),
                            child: Chip(
                              avatar: Icon(Icons.notifications_active_outlined, size: 18, color: theme.colorScheme.primary),
                              label: Text('미읽음 알림 $n건'),
                            ),
                          ),
                        ),
                      )
                    : const SizedBox.shrink(),
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
              ),
              const SizedBox(height: 16),
              Text('오늘의 브리핑', style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _StatChip(theme, '오늘 일정', '${c.todayScheduleCount}', () => ref.read(shellTabIndexProvider.notifier).state = 3),
                  _StatChip(theme, '미완료 일정', '${c.incompleteScheduleCount}', () => ref.read(shellTabIndexProvider.notifier).state = 3),
                  _StatChip(theme, '미처리 알림', '${c.pendingNotificationCount}', () => ref.read(shellTabIndexProvider.notifier).state = 4),
                  _StatChip(theme, '장기 미관리', '${c.longUnmanagedCustomerCount}', () => ref.read(shellTabIndexProvider.notifier).state = 1),
                  _StatChip(theme, '이번 달 계약', '${c.monthlyContractCount}', () => ref.read(shellTabIndexProvider.notifier).state = 2),
                  _StatChip(theme, '월 보험료 합', '${_comma(c.monthlyPremiumSum)}원', () => ref.read(shellTabIndexProvider.notifier).state = 2),
                  _StatChip(theme, '오늘 재연락', '${c.todayFollowUpCount}', () => ref.read(shellTabIndexProvider.notifier).state = 3),
                  _StatChip(theme, '연체 재연락', '${c.overdueFollowUpCount}', () => ref.read(shellTabIndexProvider.notifier).state = 3),
                ],
              ),
              const SizedBox(height: 16),
              _MonthlyPerformanceCard(theme: theme),
              const SizedBox(height: 24),
              Text('오늘 일정', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              if (d.todaySchedules.isEmpty)
                Text('오늘 예정된 일정이 없습니다.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant))
              else
                ...d.todaySchedules.take(6).map((s) => _ScheduleTile(theme, s, () => ref.read(shellTabIndexProvider.notifier).state = 3)),
            ],
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          Text('불러오기 실패', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          Text('$e', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error)),
          const SizedBox(height: 16),
          FilledButton.tonal(
            onPressed: () {
              ref.invalidate(dashboardTodayWorkProvider);
              ref.invalidate(unreadNotificationCountProvider);
              ref.invalidate(calendarAgendaProvider);
              ref.invalidate(performanceStatsProvider);
            },
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

/// 홈에서 `performanceStatsProvider`로 이번 달 실적 한 줄 + 실적 화면 이동.
class _MonthlyPerformanceCard extends ConsumerWidget {
  const _MonthlyPerformanceCard({required this.theme});

  final ThemeData theme;

  static String _premiumLabel(dynamic prem) {
    if (prem == null) return '—';
    if (prem is int) return '${HomeTab._comma(prem)}원';
    if (prem is num) return '${HomeTab._comma(prem.round())}원';
    return '$prem';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(performanceStatsProvider);
    return async.when(
      data: (stats) {
        if (stats == null) return const SizedBox.shrink();
        final contracts = stats['newContractCount'] ?? stats['contractCount'];
        final contractStr = contracts == null ? '—' : '$contracts';
        final premStr = _premiumLabel(stats['monthlyPremiumSum'] ?? stats['monthlyPremiumTotal']);
        return Card(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '이번 달 실적 (계약일 기준)',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        Navigator.of(context).push<void>(
                          MaterialPageRoute<void>(builder: (_) => const PerformanceScreen()),
                        );
                      },
                      child: const Text('상세'),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '신규 계약 $contractStr건 · 월납 $premStr',
                  style: theme.textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        );
      },
      loading: () => const Padding(
        padding: EdgeInsets.only(top: 4),
        child: LinearProgressIndicator(minHeight: 2),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip(this.theme, this.label, this.value, this.onTap);

  final ThemeData theme;
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Chip(
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
      ),
    );
  }
}

class _ScheduleTile extends StatelessWidget {
  const _ScheduleTile(this.theme, this.raw, this.onTapOpenCalendar);

  final ThemeData theme;
  final Map<String, dynamic> raw;
  final VoidCallback onTapOpenCalendar;

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
        trailing: const Icon(Icons.chevron_right, size: 20),
        onTap: onTapOpenCalendar,
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
