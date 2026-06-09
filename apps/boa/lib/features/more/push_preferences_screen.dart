import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/features/more/push_preferences_logic.dart';
import 'package:boa/features/more/push_preferences_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class PushPreferencesScreen extends ConsumerWidget {
  const PushPreferencesScreen({super.key});

  static const _workRows = <({String key, String title, String subtitle, IconData icon})>[
    (
      key: 'followUpTodayEnabled',
      title: '오늘 할 일 · 후속관리',
      subtitle: '오늘 확인할 후속관리 알림',
      icon: Icons.support_agent_outlined,
    ),
    (
      key: 'scheduleReminderEnabled',
      title: '일정 알림',
      subtitle: '예정된 일정 및 미완료 일정 알림',
      icon: Icons.event_outlined,
    ),
    (
      key: 'deleteRequestEnabled',
      title: '계약 · 업무',
      subtitle: '계약 삭제 요청 등 처리 알림',
      icon: Icons.description_outlined,
    ),
    (
      key: 'testNotificationEnabled',
      title: '시스템 안내',
      subtitle: '기기 등록 확인용 테스트 알림 (민감정보 없음)',
      icon: Icons.phonelink_setup_outlined,
    ),
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
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('알림 설정을 저장하지 못했습니다')),
                              );
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
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('알림 설정을 불러오는 중입니다…'),
          ],
        ),
      );
    }
    if (state.errorMessage != null && state.prefs == null) {
      return BoaErrorState(
        title: '알림 설정을 불러오지 못했습니다',
        message: '잠시 후 다시 시도해 주세요.',
        onRetry: notifier.load,
      );
    }
    final prefs = state.prefs ?? const PushPreferenceFields();
    final cs = theme.colorScheme;

    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 96 + bottomInset),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          BoaSurfaceCard(
            margin: EdgeInsets.zero,
            highlight: true,
            padding: EdgeInsets.zero,
            child: SwitchListTile(
              title: const Text('알림 받기'),
              subtitle: const Text('업무 알림을 한 번에 켜거나 끕니다. 알림을 끄면 오늘 업무 알림을 받지 못할 수 있습니다.'),
              value: prefs.allWorkNotificationsEnabled,
              onChanged: state.saving
                  ? null
                  : (v) => notifier.updateLocal(prefs.withAllWorkNotifications(v)),
            ),
          ),
          const SizedBox(height: 16),
          Text('업무 유형별 알림', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(
            '필요한 업무 알림만 선택해 받을 수 있습니다.',
            style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 10),
          ..._workRows.map((row) {
            final value = _boolForKey(prefs, row.key);
            return BoaSurfaceCard(
              margin: const EdgeInsets.only(bottom: 8),
              padding: EdgeInsets.zero,
              child: SwitchListTile(
                secondary: Icon(row.icon, color: BoaColors.deepGreen),
                title: Text(row.title),
                subtitle: Text(row.subtitle, style: theme.textTheme.bodySmall),
                value: value,
                onChanged: state.saving || !prefs.allWorkNotificationsEnabled
                    ? null
                    : (v) => notifier.updateLocal(_setKey(prefs, row.key, v)),
              ),
            );
          }),
          const SizedBox(height: 16),
          Text('조용한 시간대', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(
            '설정한 시간에는 푸시를 보내지 않습니다.',
            style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 10),
          BoaSurfaceCard(
            margin: EdgeInsets.zero,
            padding: const EdgeInsets.fromLTRB(4, 4, 4, 12),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SwitchListTile(
                    title: const Text('조용한 시간대 사용'),
                    value: prefs.quietHoursEnabled,
                    onChanged: state.saving ? null : (v) => notifier.updateLocal(prefs.copyWith(quietHoursEnabled: v)),
                  ),
                  if (prefs.quietHoursEnabled) ...[
                    const Divider(height: 1),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final stacked = constraints.maxWidth < 360;
                          final startTile = _QuietTimeTile(
                            label: '시작 시간',
                            value: prefs.quietHoursStart,
                            enabled: !state.saving,
                            onTap: () => _pickTime(context, prefs.quietHoursStart, (t) {
                              notifier.updateLocal(
                                prefs.copyWith(quietHoursStart: formatTimeForApi(t.hour, t.minute)),
                              );
                            }),
                          );
                          final endTile = _QuietTimeTile(
                            label: '종료 시간',
                            value: prefs.quietHoursEnd,
                            enabled: !state.saving,
                            onTap: () => _pickTime(context, prefs.quietHoursEnd, (t) {
                              notifier.updateLocal(
                                prefs.copyWith(quietHoursEnd: formatTimeForApi(t.hour, t.minute)),
                              );
                            }),
                          );
                          if (stacked) {
                            return Column(
                              children: [
                                startTile,
                                const SizedBox(height: 8),
                                endTile,
                              ],
                            );
                          }
                          return Row(
                            children: [
                              Expanded(child: startTile),
                              const SizedBox(width: 12),
                              Expanded(child: endTile),
                            ],
                          );
                        },
                      ),
                    ),
                  ],
                ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            '시간대: ${boaTimezoneLabelKo(prefs.timezone)}',
            style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 8),
          Text(
            '잠금화면 알림에는 고객명·전화번호·보험정보·토큰이 표시되지 않습니다.',
            style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
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

class _QuietTimeTile extends StatelessWidget {
  const _QuietTimeTile({
    required this.label,
    required this.value,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final String value;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Material(
      color: BoaColors.ivory,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: theme.textTheme.labelMedium?.copyWith(color: cs.onSurfaceVariant)),
                    const SizedBox(height: 4),
                    Text(
                      value,
                      style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
              Icon(Icons.schedule_outlined, color: enabled ? cs.primary : cs.outline),
            ],
          ),
        ),
      ),
    );
  }
}
