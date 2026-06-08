import 'package:boa/core/api/mobile_work_api.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/features/calendar/calendar_agenda_provider.dart';
import 'package:boa/features/customers/customer_detail_screen.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CalendarTab extends ConsumerWidget {
  const CalendarTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);

    if (!AppConfig.hasApiBase) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'BOA_API_BASE_URL 을 설정하면 일정·후속관리가 표시됩니다.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
        ),
      );
    }

    final async = ref.watch(calendarAgendaProvider);

    return async.when(
      data: (agenda) {
        final sortedSchedules = [...agenda.schedules];
        sortedSchedules.sort((a, b) {
          final ta = parseApiDate(a['startTime']) ?? DateTime.fromMillisecondsSinceEpoch(0);
          final tb = parseApiDate(b['startTime']) ?? DateTime.fromMillisecondsSinceEpoch(0);
          return ta.compareTo(tb);
        });
        final scheduleRows = sortedSchedules.take(40).toList();

        return Scaffold(
          body: RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(calendarAgendaProvider);
              await ref.read(calendarAgendaProvider.future);
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Text('연체 후속관리', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                if (agenda.followUpsOverdue.isEmpty)
                  const BoaEmptyState(
                    icon: Icons.warning_amber_outlined,
                    title: '연체 후속관리가 없습니다.',
                    message: '기한이 지난 후속 일정이 없습니다.',
                  )
                else
                  ...agenda.followUpsOverdue.map((f) => _FollowUpCard(theme: theme, raw: f)),
                const SizedBox(height: 24),
                Text('오늘·예정 후속관리', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                if (agenda.followUpsToday.isEmpty)
                  const BoaEmptyState(
                    icon: Icons.today_outlined,
                    title: '오늘 예정된 후속관리가 없습니다.',
                    message: '고객 상세에서 후속 일정을 등록할 수 있습니다.',
                  )
                else
                  ...agenda.followUpsToday.map((f) => _FollowUpCard(theme: theme, raw: f)),
                const SizedBox(height: 24),
                Text('일정 (가까운 순)', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                if (scheduleRows.isEmpty)
                  const BoaEmptyState(
                    icon: Icons.event_available_outlined,
                    title: '등록된 일정이 없습니다.',
                    message: '하단 일정 등록으로 상담·재통화 일정을 추가하세요.',
                  )
                else
                  ...scheduleRows.map((s) => _ScheduleCard(theme: theme, raw: s)),
              ],
            ),
          ),
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () async {
              final ok = await showDialog<bool>(
                context: context,
                builder: (ctx) => const _CreateScheduleDialog(),
              );
              if (ok == true && context.mounted) {
                ref.invalidate(calendarAgendaProvider);
                ref.invalidate(dashboardTodayWorkProvider);
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
          ref.invalidate(calendarAgendaProvider);
          await ref.read(calendarAgendaProvider.future);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          children: [
            BoaErrorState(
              title: '일정을 불러오지 못했습니다',
              message: '다시 시도해 주세요.',
              onRetry: () => ref.invalidate(calendarAgendaProvider),
            ),
          ],
        ),
      ),
    );
  }
}

void _invalidateAgenda(WidgetRef ref) {
  ref.invalidate(calendarAgendaProvider);
  ref.invalidate(dashboardTodayWorkProvider);
}

Future<bool> _confirmFollowUpCancel(BuildContext context) async =>
    await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('후속 취소'),
        content: const Text('이 후속관리를 취소할까요?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('아니오')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('취소')),
        ],
      ),
    ) ??
    false;

int? _coerceId(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse('$v');
}

String _dateOnlyApi(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

bool _isOpenFollowUp(String status) => status == 'scheduled' || status == 'postponed';

bool _isFinishedSchedule(String status) => status == '완료' || status == '취소' || status == '노쇼';

class _FollowUpCard extends ConsumerWidget {
  const _FollowUpCard({required this.theme, required this.raw});

  final ThemeData theme;
  final Map<String, dynamic> raw;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reason = '${raw['reason'] ?? ''}';
    final next = _fmt(raw['nextContactDate']);
    final status = '${raw['status'] ?? ''}';
    final action = '${raw['nextAction'] ?? ''}';
    final cid = raw['customerId'];
    final customerId = _coerceId(cid);
    final id = _coerceId(raw['id']);
    final canAct = id != null && _isOpenFollowUp(status);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 4, 4, 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(reason.isEmpty ? '후속관리' : reason, maxLines: 2, overflow: TextOverflow.ellipsis),
                subtitle: Text(
                  [
                    if (cid != null) '고객 #$cid',
                    if (next.isNotEmpty) next,
                    if (status.isNotEmpty) status,
                    if (action.isNotEmpty) action,
                  ].where((e) => e.isNotEmpty).join(' · '),
                  style: theme.textTheme.bodySmall,
                ),
              ),
            ),
            if (customerId != null)
              IconButton(
                tooltip: '고객 상세',
                icon: Icon(Icons.person_outline, color: theme.colorScheme.secondary),
                onPressed: () {
                  Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(builder: (_) => CustomerDetailScreen(customerId: customerId)),
                  );
                },
              ),
            if (canAct)
              PopupMenuButton<String>(
                icon: Icon(Icons.more_vert, color: theme.colorScheme.onSurfaceVariant),
                onSelected: (value) async {
                  if (value == 'complete') {
                    try {
                      await mobileCompleteFollowUp(ref, id);
                      _invalidateAgenda(ref);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('후속관리를 완료했습니다.')));
                      }
                    } catch (e) {
                      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                    }
                  } else if (value == 'postpone') {
                    final initial = parseApiDate(raw['nextContactDate']) ?? DateTime.now();
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: DateTime(initial.year, initial.month, initial.day),
                      firstDate: DateTime.now().subtract(const Duration(days: 365)),
                      lastDate: DateTime.now().add(const Duration(days: 730)),
                    );
                    if (picked == null || !context.mounted) return;
                    try {
                      await mobilePostponeFollowUp(ref, id, nextContactDate: _dateOnlyApi(picked));
                      _invalidateAgenda(ref);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('다음 연락일을 변경했습니다.')));
                      }
                    } catch (e) {
                      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                    }
                  } else if (value == 'cancel') {
                    if (!await _confirmFollowUpCancel(context) || !context.mounted) return;
                    try {
                      await mobileCancelFollowUp(ref, id);
                      _invalidateAgenda(ref);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('후속관리를 취소했습니다.')));
                      }
                    } catch (e) {
                      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                    }
                  }
                },
                itemBuilder: (ctx) => [
                  const PopupMenuItem(value: 'complete', child: Text('완료')),
                  const PopupMenuItem(value: 'postpone', child: Text('연기…')),
                  PopupMenuItem(
                    value: 'cancel',
                    child: Text('후속 취소', style: TextStyle(color: theme.colorScheme.error)),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  static String _fmt(dynamic t) {
    if (t == null) return '';
    final s = '$t';
    if (s.length >= 16) return s.substring(0, 16).replaceFirst('T', ' ');
    return s;
  }
}

class _ScheduleCard extends ConsumerWidget {
  const _ScheduleCard({required this.theme, required this.raw});

  final ThemeData theme;
  final Map<String, dynamic> raw;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final title = '${raw['title'] ?? '일정'}';
    final status = '${raw['status'] ?? ''}';
    final typ = '${raw['type'] ?? ''}';
    final start = _fmt(raw['startTime']);
    final id = _coerceId(raw['id']);
    final canComplete = id != null && !_isFinishedSchedule(status);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 4, 4, 4),
        child: Row(
          children: [
            Expanded(
              child: ListTile(
                title: Text(title),
                subtitle: Text([start, typ, status].where((e) => e.isNotEmpty).join(' · ')),
              ),
            ),
            if (canComplete)
              IconButton(
                tooltip: '완료',
                icon: Icon(Icons.check_circle_outline, color: theme.colorScheme.primary),
                onPressed: () async {
                  try {
                    await mobileCompleteSchedule(ref, id);
                    _invalidateAgenda(ref);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('일정을 완료 처리했습니다.')));
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                    }
                  }
                },
              ),
          ],
        ),
      ),
    );
  }

  static String _fmt(dynamic t) {
    if (t == null) return '';
    final s = '$t';
    if (s.length >= 16) return s.substring(0, 16).replaceFirst('T', ' ');
    return s;
  }
}

class _CreateScheduleDialog extends ConsumerStatefulWidget {
  const _CreateScheduleDialog();

  @override
  ConsumerState<_CreateScheduleDialog> createState() => _CreateScheduleDialogState();
}

class _CreateScheduleDialogState extends ConsumerState<_CreateScheduleDialog> {
  late final TextEditingController _title;
  late final TextEditingController _memo;
  String _type = '고객상담';
  late DateTime _date;
  late TimeOfDay _time;
  bool _saving = false;

  static const _types = [
    '고객상담',
    '재통화',
    '계약예정',
    '보장분석',
    '해지방어',
    '팀회의',
    '교육',
    '외근',
    '휴무',
    '기타',
  ];

  @override
  void initState() {
    super.initState();
    _title = TextEditingController();
    _memo = TextEditingController();
    final seed = DateTime.now().add(const Duration(hours: 1));
    _date = DateTime(seed.year, seed.month, seed.day);
    _time = TimeOfDay(hour: seed.hour, minute: seed.minute);
  }

  @override
  void dispose() {
    _title.dispose();
    _memo.dispose();
    super.dispose();
  }

  DateTime _startDateTime() => DateTime(_date.year, _date.month, _date.day, _time.hour, _time.minute);

  Future<void> _pickDate() async {
    final p = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 730)),
    );
    if (p != null) setState(() => _date = p);
  }

  Future<void> _pickTime() async {
    final p = await showTimePicker(context: context, initialTime: _time);
    if (p != null) setState(() => _time = p);
  }

  Future<void> _submit() async {
    if (_title.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('제목을 입력해 주세요.')));
      return;
    }
    setState(() => _saving = true);
    try {
      final start = _startDateTime();
      final end = start.add(const Duration(hours: 1));
      await mobileCreateSchedule(
        ref,
        title: _title.text.trim(),
        type: _type,
        startTime: start.toIso8601String(),
        endTime: end.toIso8601String(),
        memo: _memo.text.trim().isEmpty ? null : _memo.text.trim(),
      );
      if (mounted) {
        boaLightSuccessHaptic();
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('일정 등록'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _title,
              decoration: const InputDecoration(labelText: '제목', border: OutlineInputBorder()),
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              key: ValueKey(_type),
              initialValue: _type,
              decoration: const InputDecoration(labelText: '유형', border: OutlineInputBorder()),
              items: _types.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
              onChanged: _saving ? null : (v) => setState(() => _type = v ?? _type),
            ),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('시작일'),
              subtitle: Text('${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}'),
              trailing: const Icon(Icons.calendar_today_outlined),
              onTap: _saving ? null : _pickDate,
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('시작 시간'),
              subtitle: Text(_time.format(context)),
              trailing: const Icon(Icons.schedule),
              onTap: _saving ? null : _pickTime,
            ),
            const Text('종료는 시작으로부터 1시간 후로 등록됩니다.', style: TextStyle(fontSize: 12)),
            const SizedBox(height: 12),
            TextField(
              controller: _memo,
              decoration: const InputDecoration(labelText: '메모 (선택)', border: OutlineInputBorder()),
              maxLines: 2,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: _saving ? null : () => Navigator.pop(context), child: const Text('닫기')),
        FilledButton(
          onPressed: _saving ? null : _submit,
          child: _saving
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('등록'),
        ),
      ],
    );
  }
}
