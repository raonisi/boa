import 'package:boa/core/api/mobile_work_api.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/features/calendar/calendar_agenda_provider.dart';
import 'package:boa/features/customers/customer_followups_provider.dart';
import 'package:boa/features/customers/customer_schedules_provider.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:boa/features/home/field_command_helpers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CreateFollowUpDialog extends ConsumerStatefulWidget {
  const CreateFollowUpDialog({super.key, required this.customerId});

  final int customerId;

  @override
  ConsumerState<CreateFollowUpDialog> createState() => _CreateFollowUpDialogState();
}

class _CreateFollowUpDialogState extends ConsumerState<CreateFollowUpDialog> {
  late final TextEditingController _reason;
  DateTime _nextDate = DateTime.now().add(const Duration(days: 1));
  String _nextAction = '전화';
  bool _saving = false;

  static const _actions = ['전화', '카톡', '문자', '방문', '설계안 발송', '계약 확인', '보장분석', '사후관리', '기타'];

  @override
  void initState() {
    super.initState();
    _reason = TextEditingController();
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final p = await showDatePicker(
      context: context,
      initialDate: _nextDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 730)),
    );
    if (p != null) setState(() => _nextDate = p);
  }

  Future<void> _submit() async {
    if (_reason.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('사유를 입력해 주세요.')));
      return;
    }
    setState(() => _saving = true);
    try {
      await mobileCreateFollowUp(
        ref,
        customerId: widget.customerId,
        nextContactDate: fieldDateOnlyApi(_nextDate),
        reason: _reason.text.trim(),
        nextAction: _nextAction,
      );
      ref.invalidate(customerFollowUpsProvider(widget.customerId));
      ref.invalidate(dashboardTodayWorkProvider);
      ref.invalidate(calendarAgendaProvider);
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
      title: const Text('후속 등록'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _reason,
              decoration: const InputDecoration(labelText: '사유', border: OutlineInputBorder()),
              maxLines: 2,
              textInputAction: TextInputAction.done,
            ),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('다음 연락일'),
              subtitle: Text(fieldDateOnlyApi(_nextDate)),
              trailing: const Icon(Icons.calendar_today_outlined),
              onTap: _saving ? null : _pickDate,
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              key: ValueKey(_nextAction),
              initialValue: _nextAction,
              decoration: const InputDecoration(labelText: '다음 조치', border: OutlineInputBorder()),
              items: _actions.map((a) => DropdownMenuItem<String>(value: a, child: Text(a))).toList(),
              onChanged: _saving ? null : (v) => setState(() => _nextAction = v ?? _nextAction),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: _saving ? null : () => Navigator.of(context).pop(), child: const Text('취소')),
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

class CreateCustomerScheduleDialog extends ConsumerStatefulWidget {
  const CreateCustomerScheduleDialog({
    super.key,
    required this.customerId,
    required this.customerName,
  });

  final int customerId;
  final String customerName;

  @override
  ConsumerState<CreateCustomerScheduleDialog> createState() => _CreateCustomerScheduleDialogState();
}

class _CreateCustomerScheduleDialogState extends ConsumerState<CreateCustomerScheduleDialog> {
  late final TextEditingController _title;
  late final TextEditingController _memo;
  String _type = '고객상담';
  late DateTime _date;
  late TimeOfDay _time;
  bool _saving = false;

  static const _types = ['고객상담', '재통화', '계약예정', '보장분석', '해지방어', '기타'];

  @override
  void initState() {
    super.initState();
    _title = TextEditingController(text: '${widget.customerName} 상담');
    _memo = TextEditingController(text: '고객 #${widget.customerId}');
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

  String _isoStart() => encodeScheduleDateTimeForApi(
        combineLocalDateAndTime(_date, _time.hour, _time.minute),
      );

  Future<void> _pickDate() async {
    final p = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
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
      await mobileCreateSchedule(
        ref,
        title: _title.text.trim(),
        type: _type,
        startTime: _isoStart(),
        memo: _memo.text.trim().isEmpty ? null : _memo.text.trim(),
      );
      ref.invalidate(customerSchedulesProvider(widget.customerId));
      ref.invalidate(calendarAgendaProvider);
      ref.invalidate(dashboardTodayWorkProvider);
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
          children: [
            TextField(
              controller: _title,
              decoration: const InputDecoration(labelText: '제목', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              key: ValueKey(_type),
              initialValue: _type,
              decoration: const InputDecoration(labelText: '유형', border: OutlineInputBorder()),
              items: _types.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
              onChanged: _saving ? null : (v) => setState(() => _type = v ?? _type),
            ),
            const SizedBox(height: 10),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('날짜'),
              subtitle: Text(fieldDateOnlyApi(_date)),
              trailing: const Icon(Icons.calendar_today_outlined),
              onTap: _saving ? null : _pickDate,
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('시간'),
              subtitle: Text(_time.format(context)),
              trailing: const Icon(Icons.access_time),
              onTap: _saving ? null : _pickTime,
            ),
            TextField(
              controller: _memo,
              decoration: const InputDecoration(labelText: '메모', border: OutlineInputBorder()),
              maxLines: 2,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: _saving ? null : () => Navigator.of(context).pop(), child: const Text('취소')),
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
