import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/features/more/push_preferences_logic.dart';
import 'package:boa/features/more/push_preferences_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class PushPreferencesScreen extends ConsumerWidget {
  const PushPreferencesScreen({super.key});

  static const _workRows = <({String key, String title, String subtitle})>[
    (key: 'followUpTodayEnabled', title: '오늘 할 일 · 후속관리', subtitle: '오늘 확인할 후속관리 알림'),
    (key: 'scheduleReminderEnabled', title: '일정 알림', subtitle: '일정 리마인더 및 미완료 일정'),
    (key: 'deleteRequestEnabled', title: '계약 삭제 요청', subtitle: '처리할 삭제 요청 알림'),
    (key: 'testNotificationEnabled', title: '테스트 알림', subtitle: '기기 등록 확인용 (민감정보 없음)'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(pushPreferencesNotifierProvider);
    final notifier = ref.read(pushPreferencesNotifierProvider.notifier);
    final theme = Theme.of(context);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Scaffold(
      appBar: AppBar(title: const Text('알림 설정')),
      body: _buildBody(context, theme, state, notifier, bottomInset),
      bottomNavigationBar: state.prefs != null && !state.loading && state.errorMessage == null
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: FilledButton(
                  onPressed: state.saving
                      ? null
                      : () async {
                          final prefs = state.prefs!;
                          final ok = await notifier.save(prefs);
                          if (!context.mounted) return;
                          if (ok) {
                            boaLightSuccessHaptic();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('알림 설정을 저장했습니다.')),
                            );
                          } else {
                            final err = ref.read(pushPreferencesNotifierProvider).errorMessage;
                            if (err != null) {
                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
                            }
                          }
                        },
                  child: state.saving
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('저장'),
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildBody(
    BuildContext context,
    ThemeData theme,
    PushPreferencesState state,
    PushPreferencesNotifier notifier,
    double bottomInset,
  ) {
    if (state.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.errorMessage != null && state.prefs == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(state.errorMessage!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton.tonal(onPressed: notifier.load, child: const Text('다시 시도')),
            ],
          ),
        ),
      );
    }
    final prefs = state.prefs ?? const PushPreferenceFields();

    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 96 + bottomInset),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            child: SwitchListTile(
              title: const Text('업무 푸시 알림 전체'),
              subtitle: const Text('아래 업무 유형 알림을 한 번에 켜거나 끕니다.'),
              value: prefs.allWorkNotificationsEnabled,
              onChanged: state.saving
                  ? null
                  : (v) => notifier.updateLocal(prefs.withAllWorkNotifications(v)),
            ),
          ),
          const SizedBox(height: 12),
          Text('업무 유형별 알림', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          ..._workRows.map((row) {
            final value = _boolForKey(prefs, row.key);
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: SwitchListTile(
                title: Text(row.title),
                subtitle: Text(row.subtitle, style: theme.textTheme.bodySmall),
                value: value,
                onChanged: state.saving ? null : (v) => notifier.updateLocal(_setKey(prefs, row.key, v)),
              ),
            );
          }),
          const SizedBox(height: 12),
          Text('조용한 시간대', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  title: const Text('조용한 시간대 사용'),
                  subtitle: const Text('설정한 시간에는 푸시를 보내지 않습니다.'),
                  value: prefs.quietHoursEnabled,
                  onChanged: state.saving ? null : (v) => notifier.updateLocal(prefs.copyWith(quietHoursEnabled: v)),
                ),
                const Divider(height: 1),
                ListTile(
                  title: const Text('시작'),
                  subtitle: Text(prefs.quietHoursStart),
                  trailing: const Icon(Icons.schedule_outlined),
                  onTap: state.saving
                      ? null
                      : () => _pickTime(context, prefs.quietHoursStart, (t) {
                            notifier.updateLocal(
                              prefs.copyWith(quietHoursStart: formatTimeForApi(t.hour, t.minute)),
                            );
                          }),
                ),
                ListTile(
                  title: const Text('종료'),
                  subtitle: Text(prefs.quietHoursEnd),
                  trailing: const Icon(Icons.schedule_outlined),
                  onTap: state.saving
                      ? null
                      : () => _pickTime(context, prefs.quietHoursEnd, (t) {
                            notifier.updateLocal(
                              prefs.copyWith(quietHoursEnd: formatTimeForApi(t.hour, t.minute)),
                            );
                          }),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            '타임존: ${prefs.timezone}',
            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 8),
          Text(
            '잠금화면 알림에는 고객명·전화번호·보험정보·토큰이 표시되지 않습니다.',
            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  bool _boolForKey(PushPreferenceFields prefs, String key) => switch (key) {
        'followUpTodayEnabled' => prefs.followUpTodayEnabled,
        'scheduleReminderEnabled' => prefs.scheduleReminderEnabled,
        'deleteRequestEnabled' => prefs.deleteRequestEnabled,
        'testNotificationEnabled' => prefs.testNotificationEnabled,
        _ => false,
      };

  PushPreferenceFields _setKey(PushPreferenceFields prefs, String key, bool value) => switch (key) {
        'followUpTodayEnabled' => prefs.copyWith(followUpTodayEnabled: value),
        'scheduleReminderEnabled' => prefs.copyWith(scheduleReminderEnabled: value),
        'deleteRequestEnabled' => prefs.copyWith(deleteRequestEnabled: value),
        'testNotificationEnabled' => prefs.copyWith(testNotificationEnabled: value),
        _ => prefs,
      };

  Future<void> _pickTime(BuildContext context, String hhmm, void Function(TimeOfDay) onPicked) async {
    final parts = hhmm.split(':');
    final h = int.tryParse(parts.first) ?? 21;
    final m = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: h.clamp(0, 23), minute: m.clamp(0, 59)),
    );
    if (picked != null) onPicked(picked);
  }
}
