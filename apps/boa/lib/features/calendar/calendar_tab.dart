import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);

    if (!AppConfig.hasApiBase) {
      return const BoaServerConfigHint();
    }

    final async = ref.watch(calendarAgendaProvider);

    return async.when(
      data: (agenda) {
        final now = DateTime.now();
        final todaySchedules = todayOpenSchedules(agenda.schedules, now);
        final upcomingSchedules = upcomingOpenSchedules(agenda.schedules, now);

        return Scaffold(
          body: RefreshIndicator(
            onRefresh: () async {
              refreshFieldWorkData(ref);
              await ref.read(calendarAgendaProvider.future);
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  '기한이 지난 후속관리',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600, color: Colors.red.shade800),
                ),
                const SizedBox(height: 8),
                if (agenda.followUpsOverdue.isEmpty)
                  const BoaEmptyState(
                    icon: Icons.warning_amber_outlined,
                    title: '기한이 지난 후속관리가 없습니다',
                    message: '연체 항목이 없습니다.',
                  )
                else
                  ...agenda.followUpsOverdue.map((f) => FollowUpQuickActionTile(key: ValueKey('fu-od-${f['id']}'), raw: f, isOverdue: true)),
                const SizedBox(height: 24),
                Text('오늘 후속관리', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                if (agenda.followUpsToday.isEmpty)
                  const BoaEmptyState(
                    icon: Icons.today_outlined,
                    title: '오늘 처리할 후속관리가 없습니다',
                    message: '고객 상세에서 후속 일정을 등록할 수 있습니다.',
                  )
                else
                  ...agenda.followUpsToday.map((f) => FollowUpQuickActionTile(key: ValueKey('fu-td-${f['id']}'), raw: f)),
                const SizedBox(height: 24),
                Text('오늘 일정', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                if (todaySchedules.isEmpty)
                  const BoaEmptyState(
                    icon: Icons.event_available_outlined,
                    title: '오늘 예정된 일정이 없습니다',
                    message: '하단 일정 등록으로 추가할 수 있습니다.',
                  )
                else
                  ...todaySchedules.map((s) => ScheduleQuickActionTile(key: ValueKey('sch-today-${s['id']}'), raw: s, showTodayBadge: true)),
                const SizedBox(height: 24),
                Text('예정 일정', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                if (upcomingSchedules.isEmpty)
                  const BoaEmptyState(
                    icon: Icons.event_outlined,
                    title: '예정된 일정이 없습니다',
                    message: '다가오는 일정이 없습니다.',
                  )
                else
                  ...upcomingSchedules.take(30).map((s) => ScheduleQuickActionTile(key: ValueKey('sch-up-${s['id']}'), raw: s)),
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
      loading: () => const BoaListLoadingSkeleton(itemCount: 3),
      error: (e, _) => RefreshIndicator(
        onRefresh: () async {
          refreshFieldWorkData(ref);
          await ref.read(calendarAgendaProvider.future);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          children: [
            BoaErrorState(
              title: '일정을 불러오지 못했습니다',
              message: '다시 시도해 주세요.',
              onRetry: () => refreshFieldWorkData(ref),
            ),
          ],
        ),
      ),
    );
  }
}
