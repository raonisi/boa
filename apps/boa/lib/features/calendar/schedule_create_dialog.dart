import 'package:boa/core/api/mobile_work_api.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 일반 일정 등록 다이얼로그 (캘린더 FAB 등).
class CreateScheduleDialog extends ConsumerStatefulWidget {
  const CreateScheduleDialog({super.key});

  @override
  ConsumerState<CreateScheduleDialog> createState() => _CreateScheduleDialogState();
}

class _CreateScheduleDialogState extends ConsumerState<CreateScheduleDialog> {
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
