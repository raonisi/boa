import 'package:boa/core/api/mobile_work_api.dart';
import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/core/widgets/boa_work_action_chip.dart';
import 'package:boa/features/calendar/calendar_agenda_provider.dart';
import 'package:boa/features/calendar/schedule_create_dialog.dart';
import 'package:boa/features/calendar/schedule_work_logic.dart';
import 'package:boa/features/customers/customer_detail_dialogs.dart';
import 'package:boa/features/customers/customer_detail_screen.dart';
import 'package:boa/features/customers/customer_web_actions.dart';
import 'package:boa/features/home/field_command_helpers.dart';
import 'package:boa/features/work/work_data_refresh.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<bool> confirmScheduleComplete(BuildContext context, String title) async =>
    await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('일정 완료'),
        content: Text('「$title」 일정을 완료 처리할까요?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('완료')),
        ],
      ),
    ) ??
    false;

/// 일정 quick action 타일 — Field Command Center / CustomerDetail / Calendar 공통.
class ScheduleQuickActionTile extends ConsumerStatefulWidget {
  const ScheduleQuickActionTile({
    super.key,
    required this.raw,
    this.customerContextId,
    this.customerContextName,
    this.showTodayBadge = false,
  });

  final Map<String, dynamic> raw;
  final int? customerContextId;
  final String? customerContextName;
  final bool showTodayBadge;

  @override
  ConsumerState<ScheduleQuickActionTile> createState() => _ScheduleQuickActionTileState();
}

class _ScheduleQuickActionTileState extends ConsumerState<ScheduleQuickActionTile> {
  bool _busy = false;

  int? get _effectiveCustomerId => widget.customerContextId ?? fieldCoerceId(widget.raw['customerId']);

  Future<void> _completeSchedule(int scheduleId, String title) async {
    if (_busy) return;
    final confirmed = await confirmScheduleComplete(context, title);
    if (!confirmed || !mounted) return;
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await mobileCompleteSchedule(ref, scheduleId);
      refreshFieldWorkData(ref, customerId: _effectiveCustomerId);
      boaLightSuccessHaptic();
      messenger.showSnackBar(const SnackBar(content: Text('일정을 완료했습니다.')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _openCustomerDetail() {
    final cid = _effectiveCustomerId;
    if (cid == null) return;
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(builder: (_) => CustomerDetailScreen(customerId: cid)),
    );
  }

  void _openConsultation() {
    final cid = _effectiveCustomerId;
    if (cid == null) return;
    final name = widget.customerContextName ?? '${widget.raw['customerName'] ?? ''}'.trim();
    openCustomerWebDetail(
      context,
      ref,
      customerId: cid,
      title: name.isEmpty ? '상담기록' : '$name · 상담기록',
    );
  }

  Future<void> _openScheduleDialog() async {
    final cid = _effectiveCustomerId;
    final bool? ok;
    if (cid != null) {
      final name = widget.customerContextName ?? '${widget.raw['customerName'] ?? '고객'}'.trim();
      ok = await showDialog<bool>(
        context: context,
        builder: (_) => CreateCustomerScheduleDialog(customerId: cid, customerName: name.isEmpty ? '고객' : name),
      );
    } else {
      ok = await showDialog<bool>(context: context, builder: (_) => const CreateScheduleDialog());
    }
    if (!mounted || ok != true) return;
    refreshFieldWorkData(ref, customerId: cid);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('일정을 등록했습니다.')));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final raw = widget.raw;
    final scheduleId = fieldCoerceId(raw['id']);
    final title = '${raw['title'] ?? '일정'}';
    final typ = '${raw['type'] ?? ''}';
    final status = '${raw['status'] ?? ''}';
    final start = parseScheduleStart(raw);
    final whenLabel = fieldFmtDateTime(raw['startTime']);
    final timeLabel = fieldFmtTime(raw['startTime']);
    final canComplete = scheduleId != null && !fieldIsFinishedSchedule(status);
    final isToday = widget.showTodayBadge ||
        (start != null && isSameCalendarDay(start, DateTime.now()));

    return BoaSurfaceCard(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 8),
      child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (isToday)
                  Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F0EC),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: BoaColors.border),
                    ),
                    child: Text(
                      '오늘',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: BoaColors.deepGreen,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600), maxLines: 2, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Text(
                        [if (timeLabel.isNotEmpty) timeLabel else whenLabel, if (typ.isNotEmpty) typ, if (status.isNotEmpty) status]
                            .where((e) => e.isNotEmpty)
                            .join(' · '),
                        style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                if (canComplete)
                  BoaWorkActionChip(
                    label: '완료',
                    icon: Icons.check_circle_outline,
                    loading: _busy,
                    onPressed: _busy ? null : () => _completeSchedule(scheduleId, title),
                  ),
                if (_effectiveCustomerId != null)
                  BoaWorkActionChip(
                    label: '고객 보기',
                    icon: Icons.person_outline,
                    onPressed: _openCustomerDetail,
                  ),
                if (_effectiveCustomerId != null)
                  BoaWorkActionChip(
                    label: '상담 기록',
                    icon: Icons.edit_note_outlined,
                    onPressed: _openConsultation,
                  ),
                BoaWorkActionChip(
                  label: '일정 등록',
                  icon: Icons.add_circle_outline,
                  onPressed: _openScheduleDialog,
                ),
              ],
            ),
          ],
        ),
    );
  }
}
