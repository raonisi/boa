import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/features/calendar/schedule_quick_action_tile.dart';
import 'package:boa/features/calendar/schedule_work_logic.dart';
import 'package:boa/features/contracts/contract_create_screen.dart';
import 'package:boa/features/contracts/contract_data_refresh.dart';
import 'package:boa/features/contracts/contract_summary_card.dart';
import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:boa/features/customers/customer_contact_actions.dart';
import 'package:boa/features/customers/customer_contracts_provider.dart';
import 'package:boa/features/customers/customer_detail_dialogs.dart';
import 'package:boa/features/customers/customer_detail_logic.dart';
import 'package:boa/features/customers/customer_detail_provider.dart';
import 'package:boa/features/customers/customer_followups_provider.dart';
import 'package:boa/features/customers/customer_schedules_provider.dart';
import 'package:boa/features/customers/customer_web_actions.dart';
import 'package:boa/features/followups/followup_quick_action_tile.dart';
import 'package:boa/features/home/field_command_helpers.dart';
import 'package:boa/features/shell/shell_tab_provider.dart';
import 'package:boa/features/work/work_data_refresh.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

@Deprecated('Use refreshFieldWorkData')
void invalidateCustomerDetail360(WidgetRef ref, int customerId) => refreshFieldWorkData(ref, customerId: customerId);

/// 고객 상세 360° — 현장 상담 실행 허브.
class CustomerDetail360View extends ConsumerWidget {
  const CustomerDetail360View({
    super.key,
    required this.customerId,
    required this.customer,
  });

  final int customerId;
  final Map<String, dynamic> customer;

  String? _str(dynamic v) {
    if (v == null) return null;
    if (v is String) return v.isEmpty ? null : v;
    return '$v';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final name = _str(customer['name']) ?? '고객';
    final phone = _str(customer['phone']);
    final consultStatus = _str(customer['consultStatus']);
    final priority = priorityLabel(_str(customer['priority']));
    final nextAction = _str(customer['nextAction']);
    final tags = parseCustomerTags(customer['customerTags'] ?? customer['tags']);
    final updatedAt = parseApiDateTime(customer['updatedAt']);

    final contractsAsync = ref.watch(customerContractsProvider(customerId));
    final followUpsAsync = ref.watch(customerFollowUpsProvider(customerId));
    final schedulesAsync = ref.watch(customerSchedulesProvider(customerId));

    return RefreshIndicator(
      onRefresh: () async {
        refreshFieldWorkData(ref, customerId: customerId);
        await Future.wait<void>([
          ref.read(customerDetailProvider(customerId).future),
          ref.read(customerContractsProvider(customerId).future),
          ref.read(customerFollowUpsProvider(customerId).future),
          ref.read(customerSchedulesProvider(customerId).future),
        ]);
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          _HeroCard(
            theme: theme,
            name: name,
            consultStatus: consultStatus,
            priority: priority,
            nextAction: nextAction,
            tags: tags,
            phone: phone,
            lastActivity: updatedAt != null ? fieldFmtDateTime(updatedAt.toIso8601String()) : null,
            onEditMeta: () => openCustomerWebDetail(context, ref, customerId: customerId, title: '$name · 관리정보'),
          ),
          const SizedBox(height: 14),
          _QuickActionRow(
            onConsultation: () => openCustomerWebDetail(context, ref, customerId: customerId, title: '$name · 상담기록'),
            onFollowUp: () => _openFollowUpDialog(context, ref, customerId),
            onSchedule: () => _openScheduleDialog(context, ref, customerId, name),
            onContract: () => _openContractCreate(context, ref, customerId, name),
            onPhone: phone == null ? null : () => _launchPhone(context, phone),
            onSms: phone == null ? null : () => _launchSms(context, phone),
            onNotifications: () => ref.read(shellTabIndexProvider.notifier).state = 4,
          ),
          if (nextAction != null && nextAction.isNotEmpty) ...[
            const SizedBox(height: 16),
            _NextActionCard(theme: theme, nextAction: nextAction),
          ],
          const SizedBox(height: 20),
          followUpsAsync.when(
            data: (rows) => _FollowUpPanel(theme: theme, customerId: customerId, customerName: name, followUps: rows),
            loading: () => const _PanelLoading(title: '후속관리'),
            error: (e, _) => _PanelError(title: '후속관리', message: '$e'),
          ),
          const SizedBox(height: 16),
          schedulesAsync.when(
            data: (rows) => _SchedulePanel(
              theme: theme,
              customerId: customerId,
              customerName: name,
              schedules: rows,
              onOpenCalendar: () => ref.read(shellTabIndexProvider.notifier).state = 3,
            ),
            loading: () => const _PanelLoading(title: '일정'),
            error: (e, _) => _PanelError(title: '일정', message: '$e'),
          ),
          const SizedBox(height: 16),
          contractsAsync.when(
            data: (rows) => _ContractPanel(
              theme: theme,
              customerId: customerId,
              customerName: name,
              contracts: rows,
              onCreate: () => _openContractCreate(context, ref, customerId, name),
            ),
            loading: () => const _PanelLoading(title: '계약'),
            error: (e, _) => _PanelError(title: '계약', message: '$e'),
          ),
          const SizedBox(height: 16),
          contractsAsync.when(
            data: (contracts) => schedulesAsync.when(
              data: (schedules) => followUpsAsync.when(
                data: (followUps) => _TimelineSection(
                  theme: theme,
                  entries: buildCustomerTimeline(
                    followUps: followUps,
                    contracts: contracts,
                    schedules: schedules,
                  ),
                  onOpenWebHistory: () => openCustomerWebDetail(context, ref, customerId: customerId, title: '$name · 활동'),
                ),
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
              ),
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
          const SizedBox(height: 12),
          _ActivitySummary(theme: theme, customer: customer),
        ],
      ),
    );
  }

  Future<void> _openFollowUpDialog(BuildContext context, WidgetRef ref, int id) async {
    final messenger = ScaffoldMessenger.of(context);
    final ok = await showDialog<bool>(context: context, builder: (_) => CreateFollowUpDialog(customerId: id));
    if (!context.mounted) return;
    if (ok == true) {
      refreshFieldWorkData(ref, customerId: id);
      messenger.showSnackBar(const SnackBar(content: Text('후속관리를 등록했습니다.')));
    }
  }

  Future<void> _openScheduleDialog(BuildContext context, WidgetRef ref, int id, String name) async {
    final messenger = ScaffoldMessenger.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => CreateCustomerScheduleDialog(customerId: id, customerName: name),
    );
    if (!context.mounted) return;
    if (ok == true) {
      refreshFieldWorkData(ref, customerId: id);
      messenger.showSnackBar(const SnackBar(content: Text('일정을 등록했습니다.')));
    }
  }

  Future<void> _openContractCreate(BuildContext context, WidgetRef ref, int id, String name) async {
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final ok = await navigator.push<bool>(
      MaterialPageRoute<bool>(builder: (_) => ContractCreateScreen(customerId: id, customerName: name)),
    );
    if (!context.mounted) return;
    if (ok == true) {
      await refreshContractData(ref, customerId: id);
      refreshFieldWorkData(ref, customerId: id);
      if (!context.mounted) return;
      boaLightSuccessHaptic();
      messenger.showSnackBar(const SnackBar(content: Text('계약을 등록했습니다.')));
    }
  }

  Future<void> _launchPhone(BuildContext context, String phone) async {
    final ok = await launchCustomerPhone(phone);
    if (!context.mounted) return;
    if (!ok) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('전화 연결을 시작할 수 없습니다.')));
  }

  Future<void> _launchSms(BuildContext context, String phone) async {
    final ok = await launchCustomerSms(phone);
    if (!context.mounted) return;
    if (!ok) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('문자 앱을 열 수 없습니다.')));
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.theme,
    required this.name,
    required this.consultStatus,
    required this.priority,
    required this.nextAction,
    required this.tags,
    required this.phone,
    required this.lastActivity,
    required this.onEditMeta,
  });

  final ThemeData theme;
  final String name;
  final String? consultStatus;
  final String priority;
  final String? nextAction;
  final List<String> tags;
  final String? phone;
  final String? lastActivity;
  final VoidCallback onEditMeta;

  @override
  Widget build(BuildContext context) {
    final cs = theme.colorScheme;
    return Card(
      elevation: 0,
      color: cs.primaryContainer.withValues(alpha: 0.3),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 12, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(name, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                ),
                IconButton(
                  tooltip: '상태·태그 수정',
                  icon: const Icon(Icons.edit_outlined, size: 20),
                  onPressed: onEditMeta,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                if (consultStatus != null) _MetaChip(label: consultStatus!, color: cs.primary),
                _MetaChip(label: '우선순위 $priority', color: cs.secondary),
                if (phone != null) _MetaChip(label: phone!, color: cs.tertiary),
              ],
            ),
            if (tags.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: tags.take(6).map((t) => Chip(label: Text(t, style: theme.textTheme.labelSmall), visualDensity: VisualDensity.compact)).toList(),
              ),
            ],
            if (lastActivity != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  '최근 활동 $lastActivity',
                  style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                ),
              ),
            if (nextAction != null && nextAction!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  '다음 조치: $nextAction',
                  style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
    );
  }
}

class _QuickActionRow extends StatelessWidget {
  const _QuickActionRow({
    required this.onConsultation,
    required this.onFollowUp,
    required this.onSchedule,
    required this.onContract,
    required this.onPhone,
    required this.onSms,
    required this.onNotifications,
  });

  final VoidCallback onConsultation;
  final VoidCallback onFollowUp;
  final VoidCallback onSchedule;
  final VoidCallback onContract;
  final VoidCallback? onPhone;
  final VoidCallback? onSms;
  final VoidCallback onNotifications;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('빠른 등록', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _QuickBtn(icon: Icons.edit_note_outlined, label: '상담기록', onTap: onConsultation),
              const SizedBox(width: 8),
              _QuickBtn(icon: Icons.add_task_outlined, label: '후속', onTap: onFollowUp),
              const SizedBox(width: 8),
              _QuickBtn(icon: Icons.event_outlined, label: '일정', onTap: onSchedule),
              const SizedBox(width: 8),
              _QuickBtn(icon: Icons.description_outlined, label: '계약', onTap: onContract),
              if (onPhone != null) ...[
                const SizedBox(width: 8),
                _QuickBtn(icon: Icons.phone_outlined, label: '전화', onTap: onPhone!),
              ],
              if (onSms != null) ...[
                const SizedBox(width: 8),
                _QuickBtn(icon: Icons.sms_outlined, label: '문자', onTap: onSms!),
              ],
              const SizedBox(width: 8),
              _QuickBtn(icon: Icons.notifications_outlined, label: '알림함', onTap: onNotifications),
            ],
          ),
        ),
      ],
    );
  }
}

class _QuickBtn extends StatelessWidget {
  const _QuickBtn({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.55),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          width: 76,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
            child: Column(
              children: [
                Icon(icon, size: 22, color: theme.colorScheme.primary),
                const SizedBox(height: 4),
                Text(label, textAlign: TextAlign.center, style: theme.textTheme.labelSmall, maxLines: 2),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NextActionCard extends StatelessWidget {
  const _NextActionCard({required this.theme, required this.nextAction});
  final ThemeData theme;
  final String nextAction;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(Icons.flag_outlined, color: theme.colorScheme.primary),
        title: const Text('다음 액션'),
        subtitle: Text(nextAction, style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
      ),
    );
  }
}

class _FollowUpPanel extends ConsumerWidget {
  const _FollowUpPanel({
    required this.theme,
    required this.customerId,
    required this.customerName,
    required this.followUps,
  });
  final ThemeData theme;
  final int customerId;
  final String customerName;
  final List<Map<String, dynamic>> followUps;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final open = followUps.where((f) => fieldIsOpenFollowUp('${f['status'] ?? ''}')).toList();
    final overdue = open.where((f) => isFollowUpOverdue(f, now)).toList();
    final scheduled = open.where((f) => !isFollowUpOverdue(f, now)).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('후속관리', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600, color: theme.colorScheme.primary)),
        const SizedBox(height: 8),
        if (open.isEmpty)
          const BoaEmptyState(
            icon: Icons.add_task_outlined,
            title: '예정된 후속관리가 없습니다',
            message: '빠른 등록에서 후속을 등록하세요.',
          )
        else ...[
          if (overdue.isNotEmpty) ...[
            Text('연체', style: theme.textTheme.labelLarge?.copyWith(color: Colors.red.shade700)),
            const SizedBox(height: 4),
            ...overdue.map(
              (f) => FollowUpQuickActionTile(
                key: ValueKey('fu-od-${f['id']}'),
                raw: f,
                isOverdue: true,
                customerContextId: customerId,
                customerContextName: customerName,
              ),
            ),
            const SizedBox(height: 8),
          ],
          if (scheduled.isNotEmpty) ...[
            Text('예정', style: theme.textTheme.labelLarge),
            const SizedBox(height: 4),
            ...scheduled.take(6).map(
                  (f) => FollowUpQuickActionTile(
                    key: ValueKey('fu-${f['id']}'),
                    raw: f,
                    customerContextId: customerId,
                    customerContextName: customerName,
                  ),
                ),
          ],
        ],
      ],
    );
  }
}

class _SchedulePanel extends ConsumerWidget {
  const _SchedulePanel({
    required this.theme,
    required this.customerId,
    required this.customerName,
    required this.schedules,
    required this.onOpenCalendar,
  });

  final ThemeData theme;
  final int customerId;
  final String customerName;
  final List<Map<String, dynamic>> schedules;
  final VoidCallback onOpenCalendar;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final today = todayOpenSchedules(schedules, now);
    final upcoming = upcomingOpenSchedules(schedules, now).take(6).toList();
    final openCount = today.length + upcoming.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text('일정', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600, color: theme.colorScheme.primary))),
            TextButton(onPressed: onOpenCalendar, child: const Text('캘린더')),
          ],
        ),
        const SizedBox(height: 8),
        if (openCount == 0)
          const BoaEmptyState(icon: Icons.event_available_outlined, title: '연결된 일정이 없습니다', message: '일정을 등록하거나 캘린더에서 확인하세요.')
        else ...[
          if (today.isNotEmpty) ...[
            Text('오늘', style: theme.textTheme.labelLarge),
            const SizedBox(height: 4),
            ...today.map(
              (s) => ScheduleQuickActionTile(
                key: ValueKey('sch-today-${s['id']}'),
                raw: s,
                customerContextId: customerId,
                customerContextName: customerName,
                showTodayBadge: true,
              ),
            ),
            const SizedBox(height: 8),
          ],
          if (upcoming.isNotEmpty) ...[
            Text('예정', style: theme.textTheme.labelLarge),
            const SizedBox(height: 4),
            ...upcoming.map(
              (s) => ScheduleQuickActionTile(
                key: ValueKey('sch-up-${s['id']}'),
                raw: s,
                customerContextId: customerId,
                customerContextName: customerName,
              ),
            ),
          ],
        ],
      ],
    );
  }
}

class _ContractPanel extends StatelessWidget {
  const _ContractPanel({
    required this.theme,
    required this.customerId,
    required this.customerName,
    required this.contracts,
    required this.onCreate,
  });

  final ThemeData theme;
  final int customerId;
  final String customerName;
  final List<BoaContractRow> contracts;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final rows = contracts;
    final premSum = sumMonthlyPremium(rows);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text('계약', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600, color: theme.colorScheme.primary))),
            FilledButton.tonalIcon(onPressed: onCreate, icon: const Icon(Icons.add, size: 18), label: const Text('등록')),
          ],
        ),
        if (rows.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8, top: 4),
            child: Text('월납 합계 ${fieldCommaInt(premSum)}원 · ${rows.length}건', style: theme.textTheme.bodySmall),
          ),
        if (rows.isEmpty)
          const BoaEmptyState(icon: Icons.description_outlined, title: '등록된 계약이 없습니다', message: '신규 계약을 등록할 수 있습니다.')
        else
          ...rows.take(6).map(
                (r) => ContractSummaryCard(
                  key: ValueKey('cust-contract-${r.id}'),
                  row: r,
                  compact: true,
                ),
              ),
      ],
    );
  }
}

class _TimelineSection extends StatelessWidget {
  const _TimelineSection({required this.theme, required this.entries, required this.onOpenWebHistory});
  final ThemeData theme;
  final List<CustomerTimelineEntry> entries;
  final VoidCallback onOpenWebHistory;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text('활동 타임라인', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600))),
            TextButton(onPressed: onOpenWebHistory, child: const Text('상담기록·전체')),
          ],
        ),
        const SizedBox(height: 8),
        if (entries.isEmpty)
          const BoaEmptyState(icon: Icons.history, title: '표시할 활동이 없습니다', message: '후속·일정·계약 활동이 여기에 표시됩니다.')
        else
          ...entries.map((e) {
            final icon = switch (e.kind) {
              'contract' => Icons.description_outlined,
              'schedule' => Icons.event_outlined,
              _ => Icons.add_task_outlined,
            };
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                dense: true,
                leading: Icon(icon, size: 20, color: theme.colorScheme.primary),
                title: Text(e.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                subtitle: Text(
                  [if (e.occurredAt != null) fieldFmtDateTime(e.occurredAt!.toIso8601String()), e.subtitle].where((s) => s.isNotEmpty).join(' · '),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            );
          }),
      ],
    );
  }
}

class _ActivitySummary extends StatelessWidget {
  const _ActivitySummary({required this.theme, required this.customer});
  final ThemeData theme;
  final Map<String, dynamic> customer;

  @override
  Widget build(BuildContext context) {
    final region = customer['region'];
    final source = customer['source'];
    final memo = customer['memo'];
    final rows = <String>[
      if (region != null && '$region'.isNotEmpty) '지역: $region',
      if (source != null && '$source'.isNotEmpty) '유입: $source',
      if (memo != null && '$memo'.isNotEmpty) '메모: $memo',
    ];
    if (rows.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('고객 정보', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: rows.map((r) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(r, style: theme.textTheme.bodyMedium))).toList(),
            ),
          ),
        ),
      ],
    );
  }
}

class _PanelLoading extends StatelessWidget {
  const _PanelLoading({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        const LinearProgressIndicator(minHeight: 2),
      ],
    );
  }
}

class _PanelError extends StatelessWidget {
  const _PanelError({required this.title, required this.message});
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 4),
        Text(message, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.error)),
      ],
    );
  }
}
