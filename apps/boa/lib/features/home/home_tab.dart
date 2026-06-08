import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/features/calendar/calendar_agenda_provider.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:boa/features/more/performance_screen.dart';
import 'package:boa/features/notifications/notification_priority.dart';
import 'package:boa/features/notifications/notifications_providers.dart';
import 'package:boa/features/more/performance_stats_provider.dart';
import 'package:boa/features/notifications/unread_count_provider.dart';
import 'package:boa/features/shell/shell_tab_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum _HomeNotificationFilter { all, urgent, today, general }

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
              _FieldQuickActions(
                onOpenCustomers: () => ref.read(shellTabIndexProvider.notifier).state = 1,
                onOpenCalendar: () => ref.read(shellTabIndexProvider.notifier).state = 3,
                onOpenNotifications: () => ref.read(shellTabIndexProvider.notifier).state = 4,
              ),
              const SizedBox(height: 14),
              _PriorityQueueCard(
                overdueFollowUps: c.overdueFollowUpCount,
                incompleteSchedules: c.incompleteScheduleCount,
                pendingNotifications: c.pendingNotificationCount,
                onOpenCustomers: () => ref.read(shellTabIndexProvider.notifier).state = 1,
                onOpenCalendar: () => ref.read(shellTabIndexProvider.notifier).state = 3,
                onOpenNotifications: () => ref.read(shellTabIndexProvider.notifier).state = 4,
              ),
              const SizedBox(height: 18),
              _MonthlyPerformanceCard(theme: theme),
              const SizedBox(height: 18),
              _PendingNotificationQuickActions(
                theme: theme,
                notifications: d.pendingNotifications,
                onOpenNotifications: () => ref.read(shellTabIndexProvider.notifier).state = 4,
              ),
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
      loading: () => const BoaListLoadingSkeleton(itemCount: 3),
      error: (e, _) => ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          BoaErrorState(
            title: '대시보드를 불러오지 못했습니다',
            message: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
            onRetry: () {
              ref.invalidate(dashboardTodayWorkProvider);
              ref.invalidate(unreadNotificationCountProvider);
              ref.invalidate(calendarAgendaProvider);
              ref.invalidate(performanceStatsProvider);
            },
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

class _FieldQuickActions extends StatelessWidget {
  const _FieldQuickActions({
    required this.onOpenCustomers,
    required this.onOpenCalendar,
    required this.onOpenNotifications,
  });

  final VoidCallback onOpenCustomers;
  final VoidCallback onOpenCalendar;
  final VoidCallback onOpenNotifications;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('현장 빠른 실행', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _QuickActionChip(icon: Icons.people_alt_outlined, label: '고객 확인', onTap: onOpenCustomers),
            _QuickActionChip(icon: Icons.calendar_month_outlined, label: '오늘 일정', onTap: onOpenCalendar),
            _QuickActionChip(icon: Icons.notifications_active_outlined, label: '알림 처리', onTap: onOpenNotifications),
          ],
        ),
      ],
    );
  }
}

class _QuickActionChip extends StatelessWidget {
  const _QuickActionChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ActionChip(
      avatar: Icon(icon, size: 18, color: theme.colorScheme.primary),
      label: Text(label, style: theme.textTheme.labelLarge),
      onPressed: onTap,
    );
  }
}

class _PriorityQueueCard extends StatelessWidget {
  const _PriorityQueueCard({
    required this.overdueFollowUps,
    required this.incompleteSchedules,
    required this.pendingNotifications,
    required this.onOpenCustomers,
    required this.onOpenCalendar,
    required this.onOpenNotifications,
  });

  final int overdueFollowUps;
  final int incompleteSchedules;
  final int pendingNotifications;
  final VoidCallback onOpenCustomers;
  final VoidCallback onOpenCalendar;
  final VoidCallback onOpenNotifications;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '현장 우선 작업',
              style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 3),
            Text(
              '지금 바로 처리하면 누락을 줄일 수 있습니다.',
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 10),
            _PriorityItem(
              icon: Icons.call_missed_outgoing_outlined,
              label: '연체 재연락',
              count: overdueFollowUps,
              onTap: onOpenCustomers,
              color: Colors.red.shade700,
            ),
            _PriorityItem(
              icon: Icons.event_busy_outlined,
              label: '미완료 일정',
              count: incompleteSchedules,
              onTap: onOpenCalendar,
              color: Colors.orange.shade700,
            ),
            _PriorityItem(
              icon: Icons.notifications_none_outlined,
              label: '미처리 알림',
              count: pendingNotifications,
              onTap: onOpenNotifications,
              color: Colors.blue.shade700,
            ),
          ],
        ),
      ),
    );
  }
}

class _PriorityItem extends StatelessWidget {
  const _PriorityItem({
    required this.icon,
    required this.label,
    required this.count,
    required this.onTap,
    required this.color,
  });

  final IconData icon;
  final String label;
  final int count;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
              ),
            ),
            Text(
              '$count건',
              style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(width: 2),
            const Icon(Icons.chevron_right, size: 18),
          ],
        ),
      ),
    );
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

class _PendingNotificationQuickActions extends ConsumerStatefulWidget {
  const _PendingNotificationQuickActions({
    required this.theme,
    required this.notifications,
    required this.onOpenNotifications,
  });

  final ThemeData theme;
  final List<Map<String, dynamic>> notifications;
  final VoidCallback onOpenNotifications;

  @override
  ConsumerState<_PendingNotificationQuickActions> createState() => _PendingNotificationQuickActionsState();
}

class _PendingNotificationQuickActionsState extends ConsumerState<_PendingNotificationQuickActions> {
  _HomeNotificationFilter _selectedFilter = _HomeNotificationFilter.all;

  @override
  Widget build(BuildContext context) {
    final notifications = widget.notifications;
    final theme = widget.theme;
    final urgentCount = notifications.where((n) => classifyNotificationPriority(n) == NotificationPriority.urgent).length;
    final todayCount = notifications.where((n) => classifyNotificationPriority(n) == NotificationPriority.today).length;
    final generalCount = notifications.where((n) => classifyNotificationPriority(n) == NotificationPriority.general).length;
    final top = [...notifications]
        .where((n) {
          final p = classifyNotificationPriority(n);
          if (_selectedFilter == _HomeNotificationFilter.all) return true;
          if (_selectedFilter == _HomeNotificationFilter.urgent) return p == NotificationPriority.urgent;
          if (_selectedFilter == _HomeNotificationFilter.today) return p == NotificationPriority.today;
          return p == NotificationPriority.general;
        })
        .toList();
    final sortedTop = sortNotificationsForQueue(top);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                '즉시 처리 알림',
                style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
            TextButton(onPressed: widget.onOpenNotifications, child: const Text('전체 보기')),
          ],
        ),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            _InlinePriorityPill(
              label: '전체',
              count: notifications.length,
              color: Colors.blueGrey,
              selected: _selectedFilter == _HomeNotificationFilter.all,
              onTap: () => setState(() => _selectedFilter = _HomeNotificationFilter.all),
            ),
            _InlinePriorityPill(
              label: '긴급',
              count: urgentCount,
              color: Colors.red,
              selected: _selectedFilter == _HomeNotificationFilter.urgent,
              onTap: () => setState(() => _selectedFilter = _HomeNotificationFilter.urgent),
            ),
            _InlinePriorityPill(
              label: '오늘 처리',
              count: todayCount,
              color: Colors.orange,
              selected: _selectedFilter == _HomeNotificationFilter.today,
              onTap: () => setState(() => _selectedFilter = _HomeNotificationFilter.today),
            ),
            _InlinePriorityPill(
              label: '일반',
              count: generalCount,
              color: Colors.blueGrey,
              selected: _selectedFilter == _HomeNotificationFilter.general,
              onTap: () => setState(() => _selectedFilter = _HomeNotificationFilter.general),
            ),
          ],
        ),
        const SizedBox(height: 6),
        if (top.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              _selectedFilter == _HomeNotificationFilter.all ? '처리할 알림이 없습니다.' : '선택한 우선순위 알림이 없습니다.',
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          )
        else
          ...sortedTop.take(3).map((n) => _HomeNotificationTile(theme: theme, raw: n, priority: classifyNotificationPriority(n))),
      ],
    );
  }
}

class _InlinePriorityPill extends StatelessWidget {
  const _InlinePriorityPill({
    required this.label,
    required this.count,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.18) : color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? color.withValues(alpha: 0.6) : color.withValues(alpha: 0.25)),
        ),
        child: Text(
          '$label $count건',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color.withValues(alpha: selected ? 1 : 0.88)),
        ),
      ),
    );
  }
}

class _HomeNotificationTile extends ConsumerWidget {
  const _HomeNotificationTile({required this.theme, required this.raw, required this.priority});

  final ThemeData theme;
  final Map<String, dynamic> raw;
  final NotificationPriority priority;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final idVal = raw['id'];
    final id = idVal is int ? idVal : int.tryParse('$idVal') ?? 0;
    final title = '${raw['title'] ?? '알림'}';
    final type = '${raw['type'] ?? ''}';
    final accentColor = switch (priority) {
      NotificationPriority.urgent => Colors.red.shade400,
      NotificationPriority.today => Colors.orange.shade400,
      NotificationPriority.general => Colors.blueGrey.shade400,
    };
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 4,
              height: 42,
              margin: const EdgeInsets.only(top: 2, right: 8),
              decoration: BoxDecoration(
                color: accentColor,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.notification_important_outlined, size: 16, color: theme.colorScheme.primary),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                  if (type.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: Text(
                        type,
                        style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                      ),
                    ),
                  const SizedBox(height: 4),
                  _PriorityBadge(priority: priority),
                ],
              ),
            ),
            TextButton(
              onPressed: id == 0
                  ? null
                  : () async {
                      try {
                        await markMobileNotificationRead(ref, id);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('알림을 읽음 처리했습니다.')));
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                        }
                      }
                    },
              style: TextButton.styleFrom(
                minimumSize: const Size(40, 32),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
              ),
              child: const Text('읽음'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PriorityBadge extends StatelessWidget {
  const _PriorityBadge({required this.priority});

  final NotificationPriority priority;

  @override
  Widget build(BuildContext context) {
    final (label, bg, fg) = switch (priority) {
      NotificationPriority.urgent => ('긴급', Colors.red.shade100, Colors.red.shade700),
      NotificationPriority.today => ('오늘 처리', Colors.orange.shade100, Colors.orange.shade700),
      NotificationPriority.general => ('일반', Colors.blueGrey.shade100, Colors.blueGrey.shade700),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, color: fg, fontWeight: FontWeight.w600),
      ),
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
