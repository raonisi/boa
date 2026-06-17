import 'package:boa/core/widgets/boa_user_labels.dart';
import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_layout_helpers.dart';
import 'package:boa/core/widgets/boa_micro_viz.dart';
import 'package:boa/core/widgets/boa_pull_refresh.dart';
import 'package:boa/core/widgets/boa_quick_create_strip.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/features/search/global_search_screen.dart';
import 'package:boa/features/calendar/schedule_quick_action_tile.dart';
import 'package:boa/features/contracts/contract_summary_card.dart';
import 'package:boa/features/customers/customer_detail_screen.dart';
import 'package:boa/features/followups/followup_quick_action_tile.dart';
import 'package:boa/features/home/dashboard_micro_viz_logic.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:boa/features/home/field_command_helpers.dart';
import 'package:boa/features/home/field_recent_contracts_provider.dart';
import 'package:boa/features/more/goals_dashboard_provider.dart';
import 'package:boa/features/more/performance_screen.dart';
import 'package:boa/features/more/performance_stats_provider.dart';
import 'package:boa/features/notifications/notification_action_tile.dart';
import 'package:boa/features/notifications/notification_priority.dart';
import 'package:boa/features/notifications/unread_count_provider.dart';
import 'package:boa/features/shell/shell_tab_provider.dart';
import 'package:boa/features/work/work_data_refresh.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

@Deprecated('Use refreshFieldWorkData')
void invalidateFieldCommandData(WidgetRef ref) => refreshFieldWorkData(ref);

/// 현장 설계사용 Field Command Center — 오늘 업무.
class FieldCommandCenterView extends ConsumerWidget {
  const FieldCommandCenterView({
    super.key,
    required this.payload,
    required this.userName,
  });

  final DashboardTodayPayload payload;
  final String? userName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final c = payload.cards;
    final unreadAsync = ref.watch(unreadNotificationCountProvider);
    final performanceAsync = ref.watch(performanceStatsProvider);
    final goalsAsync = ref.watch(goalsDashboardProvider);
    final contactQueue = fieldMergeContactQueue(
      overdue: payload.overdueFollowUps,
      today: payload.todayFollowUps,
    );
    final unreadCount = resolveUnreadCount(
      unreadFromProvider: unreadAsync.maybeWhen(data: (n) => n, orElse: () => null),
      pendingNotificationCount: c.pendingNotificationCount,
    );
    final now = DateTime.now();

    return RefreshIndicator(
      onRefresh: () => BoaPullRefresh.runFutureRefresh(context, () async {
        refreshFieldWorkData(ref);
        await Future.wait<void>([
          ref.read(dashboardTodayWorkProvider.future),
          ref.read(unreadNotificationCountProvider.future),
          ref.read(performanceStatsProvider.future),
          ref.read(goalsDashboardProvider.future),
          ref.read(fieldRecentContractsProvider.future),
        ]);
      }),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(
          BoaLayout.horizontalPadding(context),
          16,
          BoaLayout.horizontalPadding(context),
          BoaLayout.bottomSafeInset(context, extra: 24),
        ),
        children: [
          _DashboardHeader(theme: theme, userName: userName, date: now),
          const SizedBox(height: 18),
          _KpiMetricsRow(
            todayScheduleCount: c.todayScheduleCount,
            todayFollowUpCount: c.todayFollowUpCount,
            overdueFollowUpCount: c.overdueFollowUpCount,
            unreadCount: unreadCount,
            onOpenCalendar: () => ref.read(shellTabIndexProvider.notifier).state = 3,
            onOpenFollowUps: () => ref.read(shellTabIndexProvider.notifier).state = 3,
            onOpenNotifications: () => ref.read(shellTabIndexProvider.notifier).state = 4,
          ),
          const SizedBox(height: 16),
          _DashboardWorkPulsePanel(
            theme: theme,
            cards: c,
            unreadCount: unreadCount,
            performanceStats: performanceAsync.maybeWhen(data: (s) => s, orElse: () => null),
            goalsDash: goalsAsync.maybeWhen(data: (g) => g, orElse: () => null),
          ),
          const SizedBox(height: 22),
          _PriorityWorkSection(
            contactQueue: contactQueue,
            todaySchedules: payload.todaySchedules,
            overdueFollowUps: payload.overdueFollowUps,
          ),
          const SizedBox(height: 22),
          _QuickActionsBlock(),
          const SizedBox(height: 24),
          BoaSectionHeader(
            title: '오늘 연락할 고객',
            actionLabel: contactQueue.isNotEmpty ? '전체 보기' : null,
            onAction: contactQueue.isNotEmpty ? () => ref.read(shellTabIndexProvider.notifier).state = 3 : null,
          ),
          const SizedBox(height: 8),
          if (contactQueue.isEmpty)
            const BoaEmptyState(
              icon: Icons.call_missed_outgoing_outlined,
              title: '처리할 후속관리가 없습니다',
              message: '후속관리가 등록되면 여기에 표시됩니다.',
            )
          else
            ...contactQueue.take(4).map(
                  (raw) => FollowUpQuickActionTile(
                    key: ValueKey('fu-${raw['id']}'),
                    raw: raw,
                    isOverdue: payload.overdueFollowUps.any((o) => fieldCoerceId(o['id']) == fieldCoerceId(raw['id'])),
                  ),
                ),
          const SizedBox(height: 22),
          BoaSectionHeader(
            title: '오늘 일정',
            actionLabel: '캘린더',
            onAction: () => ref.read(shellTabIndexProvider.notifier).state = 3,
          ),
          const SizedBox(height: 8),
          if (payload.todaySchedules.isEmpty)
            const BoaEmptyState(
              icon: Icons.event_available_outlined,
              title: '오늘 등록된 일정이 없습니다',
              message: '캘린더에서 일정을 등록할 수 있습니다.',
            )
          else
            ...payload.todaySchedules.take(5).map(
                  (s) => ScheduleQuickActionTile(
                    key: ValueKey('sch-${s['id']}'),
                    raw: s,
                    showTodayBadge: true,
                  ),
                ),
          const SizedBox(height: 22),
          _NotificationSummarySection(
            notifications: payload.pendingNotifications,
            onOpenNotifications: () => ref.read(shellTabIndexProvider.notifier).state = 4,
          ),
          const SizedBox(height: 20),
          _RecentContractsSection(theme: theme),
          if (payload.longUnmanagedCustomers.isNotEmpty) ...[
            const SizedBox(height: 20),
            BoaSectionHeader(
              title: '관리 필요 고객',
              actionLabel: '고객 목록',
              onAction: () => ref.read(shellTabIndexProvider.notifier).state = 1,
            ),
            const SizedBox(height: 8),
            ...payload.longUnmanagedCustomers.take(5).map(
                  (c) => _LongUnmanagedCustomerTile(
                    key: ValueKey('lum-${c['id']}'),
                    raw: c,
                  ),
                ),
          ],
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

class _DashboardHeader extends StatelessWidget {
  const _DashboardHeader({
    required this.theme,
    required this.userName,
    required this.date,
  });

  final ThemeData theme;
  final String? userName;
  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final cs = theme.colorScheme;
    final compact = BoaLayout.isCompactWidth(context);
    final dateLabel = fieldKoreanDateHeader(date);

    return BoaSurfaceCard(
      margin: EdgeInsets.zero,
      highlight: true,
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (compact)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '오늘 업무',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: BoaColors.navy,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  dateLabel,
                  style: theme.textTheme.labelMedium?.copyWith(color: cs.onSurfaceVariant),
                ),
              ],
            )
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    '오늘 업무',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: BoaColors.navy,
                    ),
                  ),
                ),
                Text(
                  dateLabel,
                  style: theme.textTheme.labelMedium?.copyWith(color: cs.onSurfaceVariant),
                ),
              ],
            ),
          if (userName != null) ...[
            const SizedBox(height: 6),
            Text(
              '$userName님',
              style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: 8),
          Text(
            '오늘 일정, 후속관리, 알림을 같은 흐름으로 정리했습니다.',
            style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant, height: 1.4),
          ),
        ],
      ),
    );
  }
}

class _KpiMetricsRow extends StatelessWidget {
  const _KpiMetricsRow({
    required this.todayScheduleCount,
    required this.todayFollowUpCount,
    required this.overdueFollowUpCount,
    required this.unreadCount,
    required this.onOpenCalendar,
    required this.onOpenFollowUps,
    required this.onOpenNotifications,
  });

  final int todayScheduleCount;
  final int todayFollowUpCount;
  final int overdueFollowUpCount;
  final int unreadCount;
  final VoidCallback onOpenCalendar;
  final VoidCallback onOpenFollowUps;
  final VoidCallback onOpenNotifications;

  @override
  Widget build(BuildContext context) {
    final metrics = <_KpiMetricData>[
      _KpiMetricData(
        icon: Icons.event_outlined,
        label: '오늘 일정',
        value: '$todayScheduleCount',
        unit: '건',
        hint: '예정된 일정',
        progress: kpiCardPulseProgress(value: todayScheduleCount, kind: 'schedule'),
        onTap: onOpenCalendar,
        accent: null,
      ),
      _KpiMetricData(
        icon: Icons.add_task_outlined,
        label: '오늘 후속관리',
        value: '$todayFollowUpCount',
        unit: '건',
        hint: '오늘 처리할 후속',
        progress: kpiCardPulseProgress(value: todayFollowUpCount, kind: 'followup'),
        onTap: onOpenFollowUps,
        accent: null,
      ),
      _KpiMetricData(
        icon: Icons.warning_amber_outlined,
        label: '지연된 후속관리',
        value: '$overdueFollowUpCount',
        unit: '건',
        hint: '먼저 확인할 일',
        progress: kpiCardPulseProgress(value: overdueFollowUpCount, kind: 'followup'),
        onTap: onOpenFollowUps,
        accent: overdueFollowUpCount > 0 ? BoaColors.urgent : null,
      ),
      _KpiMetricData(
        icon: Icons.notifications_outlined,
        label: '읽지 않은 알림',
        value: '$unreadCount',
        unit: '건',
        hint: '알림 보기',
        progress: kpiCardPulseProgress(value: unreadCount, kind: 'notification'),
        onTap: onOpenNotifications,
        accent: null,
      ),
    ];

    return SizedBox(
      height: 126,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: metrics.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, i) => _KpiMetricCard(data: metrics[i]),
      ),
    );
  }
}

class _KpiMetricData {
  const _KpiMetricData({
    required this.icon,
    required this.label,
    required this.value,
    required this.unit,
    required this.hint,
    required this.onTap,
    this.progress,
    this.accent,
  });

  final IconData icon;
  final String label;
  final String value;
  final String unit;
  final String hint;
  final VoidCallback onTap;
  final double? progress;
  final Color? accent;
}

class _KpiMetricCard extends StatelessWidget {
  const _KpiMetricCard({required this.data});

  final _KpiMetricData data;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final valueColor = data.accent ?? cs.onSurface;

    return SizedBox(
      width: 132,
      child: Material(
        color: BoaColors.card,
        borderRadius: BorderRadius.circular(16),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: data.onTap,
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: BoaColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(data.icon, size: 20, color: BoaColors.deepGreen),
                const SizedBox(height: 8),
                Text(
                  data.label,
                  style: theme.textTheme.labelSmall?.copyWith(color: cs.onSurfaceVariant),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      data.value,
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        height: 1,
                        color: valueColor,
                      ),
                    ),
                    const SizedBox(width: 2),
                    Text(
                      data.unit,
                      style: theme.textTheme.labelSmall?.copyWith(color: cs.onSurfaceVariant),
                    ),
                  ],
                ),
                const Spacer(),
                if (data.progress != null) ...[
                  BoaMicroTrack(
                    progress: data.progress!,
                    fillColor: data.accent ?? BoaColors.deepGreen,
                  ),
                  const SizedBox(height: 6),
                ],
                Text(
                  data.hint,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: data.accent ?? cs.onSurfaceVariant,
                    fontSize: 10,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DashboardWorkPulsePanel extends StatelessWidget {
  const _DashboardWorkPulsePanel({
    required this.theme,
    required this.cards,
    required this.unreadCount,
    this.performanceStats,
    this.goalsDash,
  });

  final ThemeData theme;
  final DashboardCards cards;
  final int unreadCount;
  final Map<String, dynamic>? performanceStats;
  final Map<String, dynamic>? goalsDash;

  @override
  Widget build(BuildContext context) {
    final pendingFollowUpCount = cards.overdueFollowUpCount + cards.todayFollowUpCount;
    final metrics = buildDashboardPulseMetrics(
      monthlyContractCount: cards.monthlyContractCount,
      monthlyPremiumSum: cards.monthlyPremiumSum,
      todayContactCount: cards.todayFollowUpCount,
      pendingFollowUpCount: pendingFollowUpCount,
      overdueFollowUpCount: cards.overdueFollowUpCount,
      unreadNotificationCount: unreadCount,
      goalsDash: goalsDash,
      performanceStats: performanceStats,
    );
    final hasAnyData = metrics.any((m) => m.hasData);

    return BoaSurfaceCard(
      margin: EdgeInsets.zero,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '오늘 업무',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: BoaColors.navy,
                  ),
                ),
              ),
              TextButton(
                onPressed: () {
                  Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(builder: (_) => const PerformanceScreen()),
                  );
                },
                child: const Text('상세 보기'),
              ),
            ],
          ),
          if (!hasAnyData)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                '이번 달 실적·오늘 업무 데이터가 아직 없습니다.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            )
          else
            ...metrics.map((m) {
              final accent = m.label == '미처리 후속관리' && cards.overdueFollowUpCount > 0
                  ? BoaColors.urgent
                  : null;
              return BoaMicroPulseRow(
                label: m.label,
                valueText: m.valueText,
                hint: m.hint,
                progress: m.progress,
                progressLabel: m.progressLabel,
                accentColor: accent,
              );
            }),
        ],
      ),
    );
  }
}

class _PriorityWorkSection extends StatelessWidget {
  const _PriorityWorkSection({
    required this.contactQueue,
    required this.todaySchedules,
    required this.overdueFollowUps,
  });

  final List<Map<String, dynamic>> contactQueue;
  final List<Map<String, dynamic>> todaySchedules;
  final List<Map<String, dynamic>> overdueFollowUps;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    if (contactQueue.isEmpty && todaySchedules.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const BoaSectionHeader(title: '먼저 처리할 일'),
          const SizedBox(height: 8),
          BoaSurfaceCard(
            margin: EdgeInsets.zero,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Column(
              children: [
                Icon(Icons.task_alt_outlined, size: 36, color: cs.onSurfaceVariant.withValues(alpha: 0.6)),
                const SizedBox(height: 12),
                Text(
                  '아직 처리할 업무가 없습니다',
                  style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 6),
                Text(
                  '일정이나 후속관리가 등록되면 여기에 우선 표시됩니다.',
                  style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ],
      );
    }

    final firstFollowUp = contactQueue.isNotEmpty ? contactQueue.first : null;
    final isOverdue = firstFollowUp != null &&
        overdueFollowUps.any((o) => fieldCoerceId(o['id']) == fieldCoerceId(firstFollowUp['id']));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const BoaSectionHeader(title: '먼저 처리할 일'),
        const SizedBox(height: 8),
        if (firstFollowUp != null)
          FollowUpQuickActionTile(
            key: ValueKey('priority-fu-${firstFollowUp['id']}'),
            raw: firstFollowUp,
            isOverdue: isOverdue,
          )
        else if (todaySchedules.isNotEmpty)
          ScheduleQuickActionTile(
            key: ValueKey('priority-sch-${todaySchedules.first['id']}'),
            raw: todaySchedules.first,
            showTodayBadge: true,
          ),
      ],
    );
  }
}

class _QuickActionsBlock extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FilledButton.tonalIcon(
          onPressed: () => openGlobalSearch(context),
          icon: const Icon(Icons.search),
          label: const Text('고객 검색'),
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            padding: const EdgeInsets.symmetric(horizontal: 16),
          ),
        ),
        const SizedBox(height: 14),
        const BoaQuickCreateStrip(sectionTitle: '빠른 실행'),
      ],
    );
  }
}

class _RecentContractsSection extends ConsumerWidget {
  const _RecentContractsSection({required this.theme});

  final ThemeData theme;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(fieldRecentContractsProvider);
    return async.when(
      data: (items) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            BoaSectionHeader(
              title: '최근 계약',
              actionLabel: '전체',
              onAction: () => ref.read(shellTabIndexProvider.notifier).state = 2,
            ),
            const SizedBox(height: 8),
            if (items.isEmpty)
              const BoaEmptyState(
                icon: Icons.description_outlined,
                title: '등록된 계약이 없습니다',
                message: '계약 등록 후 여기에 표시됩니다.',
              )
            else
              ...items.take(4).map(
                    (row) => ContractSummaryCard(
                      key: ValueKey('recent-contract-${row.id}'),
                      row: row,
                      compact: true,
                      onTap: row.customerId == null
                          ? null
                          : () {
                              Navigator.of(context).push<void>(
                                MaterialPageRoute<void>(
                                  builder: (_) => CustomerDetailScreen(customerId: row.customerId!),
                                ),
                              );
                            },
                    ),
                  ),
          ],
        );
      },
      loading: () => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('최근 계약', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          const LinearProgressIndicator(minHeight: 2),
        ],
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

class _NotificationSummarySection extends ConsumerStatefulWidget {
  const _NotificationSummarySection({
    required this.notifications,
    required this.onOpenNotifications,
  });

  final List<Map<String, dynamic>> notifications;
  final VoidCallback onOpenNotifications;

  @override
  ConsumerState<_NotificationSummarySection> createState() => _NotificationSummarySectionState();
}

class _NotificationSummarySectionState extends ConsumerState<_NotificationSummarySection> {
  @override
  Widget build(BuildContext context) {
    final notifications = widget.notifications;
    final top = sortNotificationsForQueue([...notifications]).take(3).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        BoaSectionHeader(
          title: '읽지 않은 알림',
          actionLabel: '알림 보기',
          onAction: widget.onOpenNotifications,
        ),
        const SizedBox(height: 8),
        if (notifications.isEmpty)
          const BoaEmptyState(
            icon: Icons.notifications_none_outlined,
            title: '읽지 않은 알림이 없습니다',
            message: '새 알림이 생기면 여기에 표시됩니다.',
          )
        else
          ...top.map(
            (n) => NotificationActionTile(
              key: ValueKey('home-notif-${n['id']}'),
              raw: n,
              priority: classifyNotificationPriority(n),
              compact: true,
              onAfterRead: () => refreshFieldWorkData(ref),
            ),
          ),
      ],
    );
  }
}

class _LongUnmanagedCustomerTile extends StatelessWidget {
  const _LongUnmanagedCustomerTile({super.key, required this.raw});

  final Map<String, dynamic> raw;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final id = fieldCoerceId(raw['id']);
    final name = '${raw['name'] ?? '고객'}';
    final status = consultStatusLabel('${raw['consultStatus'] ?? ''}');

    return BoaSurfaceCard(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      onTap: id == null
          ? null
          : () {
              Navigator.of(context).push<void>(
                MaterialPageRoute<void>(builder: (_) => CustomerDetailScreen(customerId: id)),
              );
            },
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: theme.colorScheme.secondaryContainer.withValues(alpha: 0.5),
            child: Icon(Icons.person_outline, size: 18, color: theme.colorScheme.secondary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.titleSmall),
                if (status.isNotEmpty)
                  Text(status, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
              ],
            ),
          ),
          Icon(Icons.chevron_right, size: 20, color: theme.colorScheme.onSurfaceVariant),
        ],
      ),
    );
  }
}
