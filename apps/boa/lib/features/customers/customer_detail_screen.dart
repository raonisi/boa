import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/api/mobile_work_api.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:boa/features/calendar/calendar_agenda_provider.dart';
import 'package:boa/features/contracts/contract_create_screen.dart';
import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:boa/features/customers/customer_contracts_provider.dart';
import 'package:boa/features/customers/customer_followups_provider.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final customerDetailProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, customerId) async {
  if (!AppConfig.hasApiBase) {
    throw Exception('BOA_API_BASE_URL 미설정');
  }
  if (ref.watch(sessionProvider) == null) {
    throw Exception('세션 없음');
  }
  final dio = ref.watch(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>('/api/mobile/customers/$customerId');
    final c = res.data?['customer'];
    if (c is! Map<String, dynamic>) {
      throw Exception('고객 데이터 형식 오류');
    }
    return c;
  } on DioException catch (e) {
    final body = e.response?.data;
    String msg = '고객 정보를 불러오지 못했습니다.';
    if (body is Map && body['error'] != null) {
      msg = '${body['error']}';
    } else if (e.message != null) {
      msg = e.message!;
    }
    throw Exception(msg);
  }
});

String? _str(dynamic v) {
  if (v == null) return null;
  if (v is String) return v.isEmpty ? null : v;
  return '$v';
}

class CustomerDetailScreen extends ConsumerWidget {
  const CustomerDetailScreen({super.key, required this.customerId});

  final int customerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final async = ref.watch(customerDetailProvider(customerId));
    final detailReady = async.hasValue;

    return Scaffold(
      appBar: AppBar(title: const Text('고객 상세')),
      floatingActionButton: detailReady
          ? FloatingActionButton.extended(
              onPressed: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => _CreateFollowUpDialog(customerId: customerId),
                );
                if (ok == true && context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('후속관리를 등록했습니다.')));
                }
              },
              icon: const Icon(Icons.add_task_outlined),
              label: const Text('후속 등록'),
            )
          : null,
      body: async.when(
        data: (c) {
          final name = _str(c['name']) ?? '고객';
          final contractsAsync = ref.watch(customerContractsProvider(customerId));
          final followUpsAsync = ref.watch(customerFollowUpsProvider(customerId));
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(customerDetailProvider(customerId));
              ref.invalidate(customerContractsProvider(customerId));
              ref.invalidate(customerFollowUpsProvider(customerId));
              await Future.wait<void>([
                ref.read(customerDetailProvider(customerId).future),
                ref.read(customerContractsProvider(customerId).future),
                ref.read(customerFollowUpsProvider(customerId).future),
              ]);
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              children: [
                Text(name, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 16),
                _detailRow(theme, '연락처', _str(c['phone'])),
                _detailRow(theme, '상담상태', _str(c['consultStatus'])),
                _detailRow(theme, '우선순위', _str(c['priority'])),
                _detailRow(theme, '다음 조치', _str(c['nextAction'])),
                _detailRow(theme, '지역', _str(c['region'])),
                _detailRow(theme, '유입', _str(c['source'])),
                _detailRow(theme, '메모', _str(c['memo'])),
                const Divider(height: 36),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '계약',
                        style: theme.textTheme.titleSmall?.copyWith(
                          color: theme.colorScheme.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    FilledButton.tonalIcon(
                      onPressed: () async {
                        final ok = await Navigator.of(context).push<bool>(
                          MaterialPageRoute<bool>(
                            builder: (_) => ContractCreateScreen(
                              customerId: customerId,
                              customerName: name,
                            ),
                          ),
                        );
                        if (ok == true && context.mounted) {
                          ref.invalidate(customerContractsProvider(customerId));
                          ref.invalidate(customerDetailProvider(customerId));
                          await ref.read(contractsListNotifierProvider.notifier).refresh();
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('계약을 등록했습니다.')),
                          );
                        }
                      },
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('신규 계약'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                contractsAsync.when(
                  data: (rows) {
                    if (rows.isEmpty) {
                      return Text(
                        '등록된 계약이 없습니다.',
                        style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                      );
                    }
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: rows
                          .map(
                            (r) => Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                dense: true,
                                title: Text(
                                  r.productName?.trim().isNotEmpty == true
                                      ? r.productName!.trim()
                                      : (r.company?.trim().isNotEmpty == true ? r.company!.trim() : '계약 #${r.id}'),
                                ),
                                subtitle: Text(
                                  [
                                    if (r.contractStatus != null) r.contractStatus!,
                                    if (r.monthlyPremium != null) '월 ${r.monthlyPremium}원',
                                  ].join(' · '),
                                  style: theme.textTheme.bodySmall,
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    );
                  },
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: LinearProgressIndicator(),
                  ),
                  error: (e, _) => Text(
                    '$e',
                    style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error),
                  ),
                ),
                const Divider(height: 36),
                Text(
                  '후속관리',
                  style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                followUpsAsync.when(
                  data: (rows) {
                    if (rows.isEmpty) {
                      return Text(
                        '등록된 후속관리가 없습니다.',
                        style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                      );
                    }
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: rows
                          .take(25)
                          .map((fu) => _CustomerFollowUpTile(customerId: customerId, raw: fu))
                          .toList(),
                    );
                  },
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: LinearProgressIndicator(),
                  ),
                  error: (e, _) => Text(
                    '$e',
                    style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error),
                  ),
                ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('$e', textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton.tonal(
                  onPressed: () => ref.invalidate(customerDetailProvider(customerId)),
                  child: const Text('다시 시도'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

Widget _detailRow(ThemeData theme, String label, String? value) {
  if (value == null) return const SizedBox.shrink();
  return Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: theme.textTheme.labelLarge?.copyWith(color: theme.colorScheme.primary)),
        const SizedBox(height: 4),
        Text(value, style: theme.textTheme.bodyLarge),
      ],
    ),
  );
}

String _fmtShort(dynamic t) {
  if (t == null) return '';
  final s = '$t';
  if (s.length >= 16) return s.substring(0, 16).replaceFirst('T', ' ');
  return s;
}

int? _coerceId(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse('$v');
}

bool _isOpenFollowUp(String status) => status == 'scheduled' || status == 'postponed';

String _dateOnlyApi(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

class _CustomerFollowUpTile extends ConsumerWidget {
  const _CustomerFollowUpTile({required this.customerId, required this.raw});

  final int customerId;
  final Map<String, dynamic> raw;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final reason = '${raw['reason'] ?? ''}';
    final id = _coerceId(raw['id']);
    final title = reason.trim().isNotEmpty ? reason.trim() : '후속 #${id ?? ''}';
    final next = _fmtShort(raw['nextContactDate']);
    final st = '${raw['status'] ?? ''}';
    final act = '${raw['nextAction'] ?? ''}';
    final canAct = id != null && _isOpenFollowUp(st);

    void invalidateRelated() {
      ref.invalidate(customerFollowUpsProvider(customerId));
      ref.invalidate(dashboardTodayWorkProvider);
      ref.invalidate(calendarAgendaProvider);
    }

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
                title: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis),
                subtitle: Text(
                  [if (next.isNotEmpty) next, if (st.isNotEmpty) st, if (act.isNotEmpty) act].join(' · '),
                  style: theme.textTheme.bodySmall,
                ),
              ),
            ),
            if (canAct)
              PopupMenuButton<String>(
                icon: Icon(Icons.more_vert, color: theme.colorScheme.onSurfaceVariant),
                onSelected: (value) async {
                  if (value == 'complete') {
                    try {
                      await mobileCompleteFollowUp(ref, id);
                      invalidateRelated();
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
                      invalidateRelated();
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('다음 연락일을 변경했습니다.')));
                      }
                    } catch (e) {
                      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                    }
                  } else if (value == 'cancel') {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('후속 취소'),
                        content: const Text('이 후속관리를 취소할까요?'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('아니오')),
                          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('취소')),
                        ],
                      ),
                    );
                    if (ok != true || !context.mounted) return;
                    try {
                      await mobileCancelFollowUp(ref, id);
                      invalidateRelated();
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
}

class _CreateFollowUpDialog extends ConsumerStatefulWidget {
  const _CreateFollowUpDialog({required this.customerId});

  final int customerId;

  @override
  ConsumerState<_CreateFollowUpDialog> createState() => _CreateFollowUpDialogState();
}

class _CreateFollowUpDialogState extends ConsumerState<_CreateFollowUpDialog> {
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

  String _fmtD(DateTime d) => _dateOnlyApi(d);

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
        nextContactDate: _fmtD(_nextDate),
        reason: _reason.text.trim(),
        nextAction: _nextAction,
      );
      ref.invalidate(customerFollowUpsProvider(widget.customerId));
      ref.invalidate(dashboardTodayWorkProvider);
      ref.invalidate(calendarAgendaProvider);
      if (mounted) Navigator.of(context).pop(true);
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
              decoration: const InputDecoration(
                labelText: '사유',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
              textInputAction: TextInputAction.done,
            ),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('다음 연락일'),
              subtitle: Text(_fmtD(_nextDate)),
              trailing: const Icon(Icons.calendar_today_outlined),
              onTap: _saving ? null : _pickDate,
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              key: ValueKey(_nextAction),
              initialValue: _nextAction,
              decoration: const InputDecoration(
                labelText: '다음 조치',
                border: OutlineInputBorder(),
              ),
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
