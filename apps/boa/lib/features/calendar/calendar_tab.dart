import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_layout_helpers.dart';
import 'package:boa/core/widgets/boa_pull_refresh.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/features/calendar/calendar_agenda_provider.dart';
import 'package:boa/features/calendar/schedule_create_dialog.dart';
import 'package:boa/features/calendar/schedule_quick_action_tile.dart';
import 'package:boa/features/calendar/schedule_work_logic.dart';
import 'package:boa/features/followups/followup_quick_action_tile.dart';
import 'package:boa/features/work/work_data_refresh.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CalendarTab extends ConsumerWidget {
  const CalendarTab({super.key});

  Future<void> _refreshCalendar(BuildContext context, WidgetRef ref) {
    return BoaPullRefresh.runFutureRefresh(context, () async {
      refreshFieldWorkData(ref);
      await ref.read(calendarAgendaProvider.future);
    });
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);

    if (!AppConfig.hasApiBase) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [BoaServerConfigHint()],
      );
    }

    final async = ref.watch(calendarAgendaProvider);

    return async.when(
      data: (agenda) {
        final now = DateTime.now();
        final todaySchedules = todayOpenSchedules(agenda.schedules, now);
        final upcomingSchedules = upcomingOpenSchedules(agenda.schedules, now);
        final openFollowUpCount = agenda.followUpsOverdue.length + agenda.followUpsToday.length;

        return Scaffold(
          body: RefreshIndicator(
            onRefresh: () => _refreshCalendar(context, ref),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.fromLTRB(
                16,
                12,
                16,
                BoaLayout.bottomSafeInset(context, extra: 88),
              ),
              children: [
                Text('일정', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(
                  '오늘 일정과 다가오는 일정, 후속관리를 한곳에서 확인합니다.',
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant, height: 1.35),
                ),
                const SizedBox(height: 14),
                BoaSurfaceCard(
                  margin: EdgeInsets.zero,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  child: Row(
                    children: [
                      Icon(Icons.event_outlined, size: 22, color: theme.colorScheme.primary),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          '오늘 일정 ${todaySchedules.length}건 · 후속 $openFollowUpCount건',
                          style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                const BoaSectionHeader(title: '오늘 일정'),
                const SizedBox(height: 8),
                if (todaySchedules.isEmpty)
                  const BoaEmptyState(
                    icon: Icons.event_available_outlined,
                    title: '오늘 등록된 일정이 없습니다',
                    message: '하단 일정 등록으로 추가할 수 있습니다.',
                  )
                else
                  ...todaySchedules.map(
                    (s) => ScheduleQuickActionTile(
                      key: ValueKey('sch-today-${s['id']}'),
                      raw: s,
                      showTodayBadge: true,
                    ),
                  ),
                const SizedBox(height: 22),
                const BoaSectionHeader(title: '다가오는 일정'),
                const SizedBox(height: 8),
                if (upcomingSchedules.isEmpty)
                  const BoaEmptyState(
                    icon: Icons.event_outlined,
                    title: '예정된 일정이 없습니다',
                    message: '다가오는 일정이 없습니다.',
                  )
                else
                  ...upcomingSchedules.take(30).map(
                        (s) => ScheduleQuickActionTile(key: ValueKey('sch-up-${s['id']}'), raw: s),
                      ),
                const SizedBox(height: 22),
                const BoaSectionHeader(title: '후속관리'),
                const SizedBox(height: 8),
                if (agenda.followUpsOverdue.isNotEmpty) ...[
                  Text(
                    '기한 임박',
                    style: theme.textTheme.labelLarge?.copyWith(color: Colors.red.shade800, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 6),
                  ...agenda.followUpsOverdue.map(
                    (f) => FollowUpQuickActionTile(key: ValueKey('fu-od-${f['id']}'), raw: f, isOverdue: true),
                  ),
                  const SizedBox(height: 12),
                ],
                Text('미완료 후속', style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                if (agenda.followUpsToday.isEmpty && agenda.followUpsOverdue.isEmpty)
                  const BoaEmptyState(
                    icon: Icons.today_outlined,
                    title: '처리할 후속관리가 없습니다',
                    message: '고객 상세에서 후속을 등록할 수 있습니다.',
                  )
                else if (agenda.followUpsToday.isEmpty)
                  Text(
                    '오늘 처리할 후속은 없습니다.',
                    style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                  )
                else
                  ...agenda.followUpsToday.map(
                    (f) => FollowUpQuickActionTile(key: ValueKey('fu-td-${f['id']}'), raw: f),
                  ),
              ],
            ),
          ),
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () async {
              final ok = await showDialog<bool>(context: context, builder: (_) => const CreateScheduleDialog());
              if (ok == true && context.mounted) {
                refreshFieldWorkData(ref);
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('일정을 등록했습니다.')));
              }
            },
            icon: const Icon(Icons.add),
            label: const Text('일정 등록'),
          ),
        );
      },
      loading: () => RefreshIndicator(
        onRefresh: () => _refreshCalendar(context, ref),
        child: boaRefreshScrollChild(
          context: context,
          child: const Column(
            children: [
              SizedBox(height: 8),
              Center(child: Text('일정 정보를 불러오는 중입니다…')),
              SizedBox(height: 16),
              BoaListLoadingSkeleton(itemCount: 3),
            ],
          ),
        ),
      ),
      error: (e, _) => RefreshIndicator(
        onRefresh: () => _refreshCalendar(context, ref),
        child: boaRefreshScrollChild(
          context: context,
          child: BoaErrorState(
            title: '일정 정보를 불러오지 못했습니다',
            message: '잠시 후 다시 시도해 주세요.',
            onRetry: () => _refreshCalendar(context, ref),
          ),
        ),
      ),
    );
  }
}
