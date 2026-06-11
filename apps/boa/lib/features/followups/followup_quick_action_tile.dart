import 'package:boa/core/api/mobile_work_api.dart';
import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/core/widgets/boa_work_action_chip.dart';
import 'package:boa/features/calendar/calendar_agenda_provider.dart';
import 'package:boa/features/customers/customer_detail_dialogs.dart';
import 'package:boa/features/customers/customer_detail_screen.dart';
import 'package:boa/features/customers/customer_web_actions.dart';
import 'package:boa/features/home/field_command_helpers.dart';
import 'package:boa/features/work/work_data_refresh.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<bool> confirmFollowUpCancel(BuildContext context) async =>
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

/// 후속관리 quick action 타일 — Field Command Center / CustomerDetail / Calendar 공통.
class FollowUpQuickActionTile extends ConsumerStatefulWidget {
  const FollowUpQuickActionTile({
    super.key,
    required this.raw,
    this.isOverdue = false,
    this.customerContextId,
    this.customerContextName,
  });

  final Map<String, dynamic> raw;
  final bool isOverdue;

  /// 고객 상세 화면에서 사용 시 고정 고객 ID (네비게이션 문맥 유지).
  final int? customerContextId;
  final String? customerContextName;

  @override
  ConsumerState<FollowUpQuickActionTile> createState() => _FollowUpQuickActionTileState();
}

class _FollowUpQuickActionTileState extends ConsumerState<FollowUpQuickActionTile> {
  int? _busyId;

  int? get _effectiveCustomerId => widget.customerContextId ?? fieldCoerceId(widget.raw['customerId']);

  Future<void> _run(int followUpId, Future<void> Function() action) async {
    if (_busyId != null) return;
    setState(() => _busyId = followUpId);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
      refreshFieldWorkData(ref, customerId: _effectiveCustomerId);
      boaLightSuccessHaptic();
      messenger.showSnackBar(const SnackBar(content: Text('반영되었습니다.')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  void _openCustomerDetail() {
    final cid = _effectiveCustomerId;
    if (cid == null) return;
    boaSelectionHaptic();
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(builder: (_) => CustomerDetailScreen(customerId: cid)),
    );
  }

  Future<void> _openConsultation() async {
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
    if (cid == null) return;
    final name = widget.customerContextName ?? '${widget.raw['customerName'] ?? '고객'}'.trim();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => CreateCustomerScheduleDialog(customerId: cid, customerName: name.isEmpty ? '고객' : name),
    );
    if (!mounted || ok != true) return;
    refreshFieldWorkData(ref, customerId: cid);
    if (!mounted) return;
    boaLightSuccessHaptic();
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('일정을 등록했습니다.')));
  }

  Future<void> _pickPostponeDate(int followUpId) async {
    final initial = parseApiDate(widget.raw['nextContactDate']) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(initial.year, initial.month, initial.day),
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 730)),
    );
    if (picked == null || !context.mounted) return;
    await _run(
      followUpId,
      () => mobilePostponeFollowUp(ref, followUpId, nextContactDate: fieldDateOnlyApi(picked)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final raw = widget.raw;
    final followUpId = fieldCoerceId(raw['id']);
    final customerName = '${raw['customerName'] ?? ''}'.trim();
    final reason = '${raw['reason'] ?? ''}'.trim();
    final nextAction = '${raw['nextAction'] ?? ''}'.trim();
    final status = '${raw['status'] ?? ''}';
    final canAct = followUpId != null && fieldIsOpenFollowUp(status);
    final busy = _busyId == followUpId;
    final inCustomerContext = widget.customerContextId != null;
    final title = inCustomerContext
        ? (reason.isNotEmpty ? reason : '후속관리')
        : (customerName.isNotEmpty ? customerName : (reason.isNotEmpty ? reason : '후속관리'));

    return BoaSurfaceCard(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 8),
      child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              onTap: _effectiveCustomerId == null ? null : _openCustomerDetail,
              borderRadius: BorderRadius.circular(8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (widget.isOverdue)
                    Container(
                      margin: const EdgeInsets.only(right: 8, top: 2),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: BoaColors.urgentBg,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: BoaColors.urgent.withValues(alpha: 0.2)),
                      ),
                      child: const Text(
                        '기한 임박',
                        style: TextStyle(fontSize: 10, color: BoaColors.urgent, fontWeight: FontWeight.w700),
                      ),
                    ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          [
                            fieldFmtDateTime(raw['nextContactDate']),
                            if (!inCustomerContext && reason.isNotEmpty && customerName.isNotEmpty) reason,
                            if (nextAction.isNotEmpty) nextAction,
                          ].where((e) => e.isNotEmpty).join(' · '),
                          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  if (_effectiveCustomerId != null) const Icon(Icons.chevron_right, size: 20),
                ],
              ),
            ),
            if (canAct) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  BoaWorkActionChip(
                    label: '완료',
                    icon: Icons.check_circle_outline,
                    loading: busy,
                    onPressed: busy ? null : () => _run(followUpId, () => mobileCompleteFollowUp(ref, followUpId)),
                  ),
                  BoaWorkActionChip(
                    label: '내일로 연기',
                    icon: Icons.today_outlined,
                    loading: busy,
                    onPressed: busy
                        ? null
                        : () {
                            final next = DateTime.now().add(const Duration(days: 1));
                            _run(followUpId, () => mobilePostponeFollowUp(ref, followUpId, nextContactDate: fieldDateOnlyApi(next)));
                          },
                  ),
                  BoaWorkActionChip(
                    label: '3일 뒤 연기',
                    icon: Icons.date_range_outlined,
                    loading: busy,
                    onPressed: busy
                        ? null
                        : () {
                            final next = DateTime.now().add(const Duration(days: 3));
                            _run(followUpId, () => mobilePostponeFollowUp(ref, followUpId, nextContactDate: fieldDateOnlyApi(next)));
                          },
                  ),
                ],
              ),
            ],
            if (_effectiveCustomerId != null) ...[
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  if (!inCustomerContext)
                    BoaWorkActionChip(
                      label: '고객 보기',
                      icon: Icons.person_outline,
                      onPressed: _openCustomerDetail,
                    ),
                  BoaWorkActionChip(
                    label: '상담 기록',
                    icon: Icons.edit_note_outlined,
                    onPressed: _openConsultation,
                  ),
                  BoaWorkActionChip(
                    label: '일정 등록',
                    icon: Icons.event_outlined,
                    onPressed: _openScheduleDialog,
                  ),
                  if (canAct)
                    PopupMenuButton<String>(
                      tooltip: '더보기',
                      icon: Icon(Icons.more_horiz, color: theme.colorScheme.onSurfaceVariant),
                      onSelected: (value) async {
                        if (value == 'postpone') {
                          await _pickPostponeDate(followUpId);
                        } else if (value == 'cancel') {
                          if (!await confirmFollowUpCancel(context) || !context.mounted) return;
                          await _run(followUpId, () => mobileCancelFollowUp(ref, followUpId));
                        }
                      },
                      itemBuilder: (ctx) => [
                        const PopupMenuItem(value: 'postpone', child: Text('날짜 직접 선택')),
                        PopupMenuItem(
                          value: 'cancel',
                          child: Text('후속 취소', style: TextStyle(color: theme.colorScheme.error)),
                        ),
                      ],
                    ),
                ],
              ),
            ],
          ],
        ),
    );
  }
}
