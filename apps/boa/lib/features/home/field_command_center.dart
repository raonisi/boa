import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_quick_create_strip.dart';
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

/// 현장 설계사용 Field Command Center — 오늘 실행 업무 보드.
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
    final todayActionCount = fieldTodayActionCount(
      todayFollowUpCount: c.todayFollowUpCount,
      todayScheduleCount: c.todayScheduleCount,
      pendingNotificationCount: c.pendingNotificationCount,
    );
    final contactQueue = fieldMergeContactQueue(
      overdue: payload.overdueFollowUps,
      today: payload.todayFollowUps,
    );

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
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
        children: [
          if (userName != null)
            Text(
              '$userName님, 오늘 할 일',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
          const SizedBox(height: 4),
          Text(
            '연락 · 일정 · 알림을 한 화면에서 바로 처리하세요.',
            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 16),
          _HeroSummaryCard(
            theme: theme,
            todayActionCount: todayActionCount,
            overdueFollowUpCount: c.overdueFollowUpCount,
            todayScheduleCount: c.todayScheduleCount,
            pendingNotificationCount: c.pendingNotificationCount,
            monthlyContractCount: c.monthlyContractCount,
            monthlyPremiumSum: c.monthlyPremiumSum,
            unreadAsync: unreadAsync,
            onOpenCalendar: () => ref.read(shellTabIndexProvider.notifier).state = 3,
            onOpenNotifications: () => ref.read(shellTabIndexProvider.notifier).state = 4,
            onOpenContracts: () => ref.read(shellTabIndexProvider.notifier).state = 2,
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => openGlobalSearch(context),
            icon: const Icon(Icons.search),
            label: const Text('고객 검색'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 12),
              alignment: Alignment.center,
            ),
          ),
          const SizedBox(height: 12),
          const BoaQuickCreateStrip(),
          const SizedBox(height: 20),
          _SectionHeader(
            title: '오늘 연락할 고객',
            actionLabel: contactQueue.isNotEmpty ? '전체 일정' : null,
            onAction: contactQueue.isNotEmpty ? () => ref.read(shellTabIndexProvider.notifier).state = 3 : null,
          ),
          const SizedBox(height: 8),
          if (contactQueue.isEmpty)
            const BoaEmptyState(
              icon: Icons.call_missed_outgoing_outlined,
              title: '오늘 연락 예정 고객이 없습니다',
              message: '후속관리가 등록되면 여기에 표시됩니다.',
            )
          else
            ...contactQueue.map(
              (raw) => FollowUpQuickActionTile(
                key: ValueKey('fu-${raw['id']}'),
                raw: raw,
                isOverdue: payload.overdueFollowUps.any((o) => fieldCoerceId(o['id']) == fieldCoerceId(raw['id'])),
              ),
            ),
          const SizedBox(height: 20),
          _SectionHeader(
            title: '오늘 일정',
            actionLabel: '캘린더',
            onAction: () => ref.read(shellTabIndexProvider.notifier).state = 3,
          ),
          const SizedBox(height: 8),
          if (payload.todaySchedules.isEmpty)
            const BoaEmptyState(
              icon: Icons.event_available_outlined,
              title: '오늘 예정된 일정이 없습니다',
              message: '캘린더에서 일정을 등록할 수 있습니다.',
            )
          else
            ...payload.todaySchedules.take(6).map(
                  (s) => ScheduleQuickActionTile(
                    key: ValueKey('sch-${s['id']}'),
                    raw: s,
                    showTodayBadge: true,
                  ),
                ),
          const SizedBox(height: 20),
          _RecentContractsSection(theme: theme),
          const SizedBox(height: 20),
          _NotificationSummarySection(
            notifications: payload.pendingNotifications,
            onOpenNotifications: () => ref.read(shellTabIndexProvider.notifier).state = 4,
          ),
          if (payload.longUnmanagedCustomers.isNotEmpty) ...[
            const SizedBox(height: 20),
            _SectionHeader(
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

class _HeroSummaryCard extends StatelessWidget {
  const _HeroSummaryCard({
    required this.theme,
    required this.todayActionCount,
    required this.overdueFollowUpCount,
    required this.todayScheduleCount,
    required this.pendingNotificationCount,
    required this.monthlyContractCount,
    required this.monthlyPremiumSum,
    required this.unreadAsync,
    required this.onOpenCalendar,
    required this.onOpenNotifications,
    required this.onOpenContracts,
  });

  final ThemeData theme;
  final int todayActionCount;
  final int overdueFollowUpCount;
  final int todayScheduleCount;
  final int pendingNotificationCount;
  final int monthlyContractCount;
  final int monthlyPremiumSum;
  final AsyncValue<int> unreadAsync;
  final VoidCallback onOpenCalendar;
  final VoidCallback onOpenNotifications;
  final VoidCallback onOpenContracts;

  @override
  Widget build(BuildContext context) {
    final cs = theme.colorScheme;
    final headline = todayActionCount == 0 && overdueFollowUpCount == 0
        ? '오늘 예정된 업무가 없습니다'
        : '오늘 처리할 업무 $todayActionCount건';

    return Card(
      elevation: 0,
      color: cs.primaryContainer.withValues(alpha: 0.35),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              headline,
              style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700, color: cs.primary),
            ),
            if (overdueFollowUpCount > 0)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  '연체 재연락 $overdueFollowUpCount건 — 우선 처리하세요',
                  style: theme.textTheme.bodySmall?.copyWith(color: Colors.red.shade700, fontWeight: FontWeight.w600),
                ),
              ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _SummaryMetric(
                  label: '오늘 일정',
                  value: '$todayScheduleCount',
                  onTap: onOpenCalendar,
                ),
                _SummaryMetric(
                  label: '미처리 알림',
                  value: '$pendingNotificationCount',
                  onTap: onOpenNotifications,
                ),
                _SummaryMetric(
                  label: '연체 재연락',
                  value: '$overdueFollowUpCount',
                  onTap: onOpenCalendar,
                  accent: overdueFollowUpCount > 0 ? Colors.red.shade700 : null,
                ),
                unreadAsync.when(
                  data: (n) => _SummaryMetric(
                    label: '미읽음',
                    value: '$n',
                    onTap: onOpenNotifications,
                  ),
                  loading: () => _SummaryMetric(label: '미읽음', value: '…', onTap: onOpenNotifications),
                  error: (_, __) => _SummaryMetric(label: '미읽음', value: '—', onTap: onOpenNotifications),
                ),
              ],
            ),
            const SizedBox(height: 10),
            InkWell(
              onTap: onOpenContracts,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Text(
                  '이번 달 신규 계약 $monthlyContractCount건 · 월납 ${fieldCommaInt(monthlyPremiumSum)}원',
                  style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryMetric extends StatelessWidget {
  const _SummaryMetric({
    required this.label,
    required this.value,
    required this.onTap,
    this.accent,
  });

  final String label;
  final String value;
  final VoidCallback onTap;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: theme.colorScheme.outlineVariant.withValues(alpha: 0.6)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label, style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            Text(
              value,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: accent ?? theme.colorScheme.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Expanded(
          child: Text(title, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
        ),
        if (actionLabel != null && onAction != null)
          TextButton(onPressed: onAction, child: Text(actionLabel!)),
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
            _SectionHeader(
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
              ...items.take(5).map(
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
        _SectionHeader(
          title: '알림 요약',
          actionLabel: '알림함',
          onAction: widget.onOpenNotifications,
        ),
        const SizedBox(height: 8),
        if (notifications.isEmpty)
          const BoaEmptyState(
            icon: Icons.notifications_none_outlined,
            title: '확인할 업무가 없습니다.',
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

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        dense: true,
        leading: Icon(Icons.person_outline, color: theme.colorScheme.secondary),
        title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: status.isNotEmpty ? Text(status, style: theme.textTheme.bodySmall) : null,
        trailing: const Icon(Icons.chevron_right, size: 20),
        onTap: id == null
            ? null
            : () {
                Navigator.of(context).push<void>(
                  MaterialPageRoute<void>(builder: (_) => CustomerDetailScreen(customerId: id)),
                );
              },
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
                        '이번 달 실적',
                        style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600, color: theme.colorScheme.primary),
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
                Text('신규 계약 $contractStr건 · 월납 $premStr', style: theme.textTheme.bodyMedium),
              ],
            ),
          ),
        );
      },
      loading: () => const Padding(padding: EdgeInsets.only(top: 4), child: LinearProgressIndicator(minHeight: 2)),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}
