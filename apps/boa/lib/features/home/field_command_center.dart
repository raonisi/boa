import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_quick_create_strip.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/features/search/global_search_screen.dart';
import 'package:boa/features/calendar/schedule_quick_action_tile.dart';
import 'package:boa/features/contracts/contract_summary_card.dart';
import 'package:boa/features/customers/customer_detail_screen.dart';
import 'package:boa/features/followups/followup_quick_action_tile.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:boa/features/home/field_command_helpers.dart';
import 'package:boa/features/home/field_recent_contracts_provider.dart';
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

/// 현장 설계사용 Field Command Center — 오늘의 업무 보드.
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
    final contactQueue = fieldMergeContactQueue(
      overdue: payload.overdueFollowUps,
      today: payload.todayFollowUps,
    );
    final pendingFollowUpCount = c.overdueFollowUpCount + c.todayFollowUpCount;
    final now = DateTime.now();

    return RefreshIndicator(
      onRefresh: () async {
        refreshFieldWorkData(ref);
        await Future.wait<void>([
          ref.read(dashboardTodayWorkProvider.future),
          ref.read(unreadNotificationCountProvider.future),
          ref.read(performanceStatsProvider.future),
          ref.read(fieldRecentContractsProvider.future),
        ]);
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          _DashboardHeader(theme: theme, userName: userName, date: now),
          const SizedBox(height: 18),
          _KpiMetricsRow(
            todayScheduleCount: c.todayScheduleCount,
            pendingFollowUpCount: pendingFollowUpCount,
            overdueFollowUpCount: c.overdueFollowUpCount,
            pendingNotificationCount: c.pendingNotificationCount,
            monthlyContractCount: c.monthlyContractCount,
            unreadAsync: unreadAsync,
            onOpenCalendar: () => ref.read(shellTabIndexProvider.notifier).state = 3,
            onOpenNotifications: () => ref.read(shellTabIndexProvider.notifier).state = 4,
            onOpenContracts: () => ref.read(shellTabIndexProvider.notifier).state = 2,
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
          _MonthlyPerformanceCard(theme: theme),
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
    return BoaSurfaceCard(
      margin: EdgeInsets.zero,
      highlight: true,
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  '오늘의 업무 보드',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: BoaColors.navy,
                  ),
                ),
              ),
              Text(
                fieldKoreanDateHeader(date),
                style: theme.textTheme.labelMedium?.copyWith(color: cs.onSurfaceVariant),
              ),
            ],
          ),
          if (userName != null) ...[
            const SizedBox(height: 6),
            Text(
              '$userName님',
              style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
            ),
          ],
          const SizedBox(height: 8),
          Text(
            '오늘 확인할 일정과 후속관리를 정리했습니다.',
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
    required this.pendingFollowUpCount,
    required this.overdueFollowUpCount,
    required this.pendingNotificationCount,
    required this.monthlyContractCount,
    required this.unreadAsync,
    required this.onOpenCalendar,
    required this.onOpenNotifications,
    required this.onOpenContracts,
  });

  final int todayScheduleCount;
  final int pendingFollowUpCount;
  final int overdueFollowUpCount;
  final int pendingNotificationCount;
  final int monthlyContractCount;
  final AsyncValue<int> unreadAsync;
  final VoidCallback onOpenCalendar;
  final VoidCallback onOpenNotifications;
  final VoidCallback onOpenContracts;

  @override
  Widget build(BuildContext context) {
    final unread = unreadAsync.maybeWhen(data: (n) => n, orElse: () => null);
    final metrics = <_KpiMetricData>[
      _KpiMetricData(
        icon: Icons.event_outlined,
        label: '오늘 일정',
        value: '$todayScheduleCount',
        unit: '건',
        hint: '예정된 일정',
        onTap: onOpenCalendar,
        accent: null,
      ),
      _KpiMetricData(
        icon: Icons.add_task_outlined,
        label: '미완료 후속',
        value: '$pendingFollowUpCount',
        unit: '건',
        hint: overdueFollowUpCount > 0 ? '연체 $overdueFollowUpCount건 포함' : '오늘 연락 예정',
        onTap: onOpenCalendar,
        accent: overdueFollowUpCount > 0 ? BoaColors.urgent : null,
      ),
      _KpiMetricData(
        icon: Icons.notifications_outlined,
        label: '새 알림',
        value: unread != null ? '$unread' : (pendingNotificationCount > 0 ? '$pendingNotificationCount' : '0'),
        unit: '건',
        hint: '미확인 알림',
        onTap: onOpenNotifications,
        accent: (unread ?? pendingNotificationCount) > 0 ? null : null,
      ),
      _KpiMetricData(
        icon: Icons.description_outlined,
        label: '이번 달 계약',
        value: '$monthlyContractCount',
        unit: '건',
        hint: '신규 계약',
        onTap: onOpenContracts,
        accent: null,
      ),
    ];

    return SizedBox(
      height: 118,
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
    this.accent,
  });

  final IconData icon;
  final String label;
  final String value;
  final String unit;
  final String hint;
  final VoidCallback onTap;
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
          const BoaSectionHeader(title: '우선 처리 업무'),
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
        const BoaSectionHeader(title: '우선 처리 업무'),
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
          title: '최근 알림',
          actionLabel: '알림함 보기',
          onAction: widget.onOpenNotifications,
        ),
        const SizedBox(height: 8),
        if (notifications.isEmpty)
          const BoaEmptyState(
            icon: Icons.notifications_none_outlined,
            title: '아직 처리할 알림이 없습니다',
            message: '새 알림이 오면 여기에 표시됩니다.',
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
    final status = '${raw['consultStatus'] ?? ''}';

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

class _MonthlyPerformanceCard extends ConsumerWidget {
  const _MonthlyPerformanceCard({required this.theme});

  final ThemeData theme;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(performanceStatsProvider);
    return async.when(
      data: (stats) {
        if (stats == null) return const SizedBox.shrink();
        final contracts = stats['newContractCount'] ?? stats['contractCount'];
        final contractStr = contracts == null ? '—' : '$contracts';
        final prem = stats['monthlyPremiumSum'] ?? stats['monthlyPremiumTotal'];
        String premStr = '—';
        if (prem is int) premStr = '${fieldCommaInt(prem)}원';
        if (prem is num) premStr = '${fieldCommaInt(prem.round())}원';

        return BoaSurfaceCard(
          margin: EdgeInsets.zero,
          padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '이번 달 실적',
                      style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600, color: BoaColors.navy),
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
              Text('신규 계약 $contractStr건 · 월납 $premStr', style: theme.textTheme.bodyMedium),
            ],
          ),
        );
      },
      loading: () => const Padding(padding: EdgeInsets.only(top: 4), child: LinearProgressIndicator(minHeight: 2)),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}
