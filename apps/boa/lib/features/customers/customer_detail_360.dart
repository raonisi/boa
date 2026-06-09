import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_ui.dart';
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

/// 고객 상세 360° — 상담·후속·일정·계약 허브.
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
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 36),
        children: [
          _ProfileHeroCard(
            theme: theme,
            name: name,
            consultStatus: consultStatus,
            priority: priority,
            tags: tags,
            phone: phone,
            lastActivity: updatedAt != null ? fieldFmtDateTime(updatedAt.toIso8601String()) : null,
            onEditMeta: () => openCustomerWebDetail(context, ref, customerId: customerId, title: '$name · 관리정보'),
          ),
          const SizedBox(height: 16),
          _NextActionHubCard(
            theme: theme,
            nextAction: nextAction,
            onConsultation: () => openCustomerWebDetail(context, ref, customerId: customerId, title: '$name · 상담기록'),
            onFollowUp: () => _openFollowUpDialog(context, ref, customerId),
            onSchedule: () => _openScheduleDialog(context, ref, customerId, name),
            onContract: () => _openContractCreate(context, ref, customerId, name),
            onPhone: phone == null ? null : () => _launchPhone(context, phone),
            onSms: phone == null ? null : () => _launchSms(context, phone),
          ),
          const SizedBox(height: 22),
          contractsAsync.when(
            data: (contracts) => schedulesAsync.when(
              data: (schedules) => followUpsAsync.when(
                data: (followUps) => _ConsultationSection(
                  theme: theme,
                  entries: buildCustomerTimeline(
                    followUps: followUps,
                    contracts: contracts,
                    schedules: schedules,
                    limit: 12,
                  ),
                  onAddConsultation: () =>
                      openCustomerWebDetail(context, ref, customerId: customerId, title: '$name · 상담기록'),
                  onViewAll: () =>
                      openCustomerWebDetail(context, ref, customerId: customerId, title: '$name · 활동'),
                ),
                loading: () => const _SectionLoading(title: '상담 기록'),
                error: (_, __) => const SizedBox.shrink(),
              ),
              loading: () => const _SectionLoading(title: '상담 기록'),
              error: (_, __) => const SizedBox.shrink(),
            ),
            loading: () => const _SectionLoading(title: '상담 기록'),
            error: (_, __) => const SizedBox.shrink(),
          ),
          const SizedBox(height: 20),
          followUpsAsync.when(
            data: (rows) => _FollowUpPanel(theme: theme, customerId: customerId, customerName: name, followUps: rows),
            loading: () => const _SectionLoading(title: '후속관리'),
            error: (_, __) => const _SectionError(title: '후속관리'),
          ),
          const SizedBox(height: 20),
          schedulesAsync.when(
            data: (rows) => _SchedulePanel(
              theme: theme,
              customerId: customerId,
              customerName: name,
              schedules: rows,
              onOpenCalendar: () => ref.read(shellTabIndexProvider.notifier).state = 3,
              onAddSchedule: () => _openScheduleDialog(context, ref, customerId, name),
            ),
            loading: () => const _SectionLoading(title: '예정 일정'),
            error: (_, __) => const _SectionError(title: '예정 일정'),
          ),
          const SizedBox(height: 20),
          contractsAsync.when(
            data: (rows) => _ContractPanel(
              theme: theme,
              contracts: rows,
              onCreate: () => _openContractCreate(context, ref, customerId, name),
            ),
            loading: () => const _SectionLoading(title: '계약 요약'),
            error: (_, __) => const _SectionError(title: '계약 요약'),
          ),
          const SizedBox(height: 16),
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

class _ProfileHeroCard extends StatelessWidget {
  const _ProfileHeroCard({
    required this.theme,
    required this.name,
    required this.consultStatus,
    required this.priority,
    required this.tags,
    required this.phone,
    required this.lastActivity,
    required this.onEditMeta,
  });

  final ThemeData theme;
  final String name;
  final String? consultStatus;
  final String priority;
  final List<String> tags;
  final String? phone;
  final String? lastActivity;
  final VoidCallback onEditMeta;

  @override
  Widget build(BuildContext context) {
    final cs = theme.colorScheme;
    final initial = name.isNotEmpty ? name[0] : '?';

    return BoaSurfaceCard(
      margin: EdgeInsets.zero,
      color: cs.primary.withValues(alpha: 0.04),
      padding: const EdgeInsets.fromLTRB(18, 16, 12, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: cs.primaryContainer.withValues(alpha: 0.65),
                child: Text(
                  initial,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: cs.primary,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '고객 요약',
                      style: theme.textTheme.labelMedium?.copyWith(color: cs.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: '상태·태그 수정',
                icon: const Icon(Icons.edit_outlined, size: 20),
                onPressed: onEditMeta,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (consultStatus != null) _StatusChip(label: consultStatus!, color: cs.primary),
              _StatusChip(label: '우선순위 $priority', color: cs.secondary),
              if (phone != null) _StatusChip(label: phone!, color: cs.tertiary),
            ],
          ),
          if (tags.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: tags
                  .take(6)
                  .map(
                    (t) => Chip(
                      label: Text(t, style: theme.textTheme.labelSmall),
                      visualDensity: VisualDensity.compact,
                      side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.5)),
                    ),
                  )
                  .toList(),
            ),
          ],
          if (lastActivity != null) ...[
            const SizedBox(height: 10),
            Text(
              '최근 활동 $lastActivity',
              style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
    );
  }
}

class _NextActionHubCard extends StatelessWidget {
  const _NextActionHubCard({
    required this.theme,
    required this.nextAction,
    required this.onConsultation,
    required this.onFollowUp,
    required this.onSchedule,
    required this.onContract,
    required this.onPhone,
    required this.onSms,
  });

  final ThemeData theme;
  final String? nextAction;
  final VoidCallback onConsultation;
  final VoidCallback onFollowUp;
  final VoidCallback onSchedule;
  final VoidCallback onContract;
  final VoidCallback? onPhone;
  final VoidCallback? onSms;

  @override
  Widget build(BuildContext context) {
    final cs = theme.colorScheme;

    return BoaSurfaceCard(
      margin: EdgeInsets.zero,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.flag_outlined, size: 20, color: cs.primary),
              const SizedBox(width: 8),
              Text(
                '다음 액션',
                style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700, color: cs.primary),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (nextAction != null && nextAction!.isNotEmpty)
            Text(
              nextAction!,
              style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600, height: 1.35),
            )
          else
            Text(
              '등록된 다음 액션이 없습니다. 상담 후 후속관리를 등록해 주세요.',
              style: theme.textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant, height: 1.35),
            ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _HubActionButton(icon: Icons.edit_note_outlined, label: '상담 기록', onTap: onConsultation),
              _HubActionButton(icon: Icons.add_task_outlined, label: '후속 등록', onTap: onFollowUp),
              _HubActionButton(icon: Icons.event_outlined, label: '일정 등록', onTap: onSchedule),
              _HubActionButton(icon: Icons.description_outlined, label: '계약 등록', onTap: onContract),
              if (onPhone != null)
                _HubActionButton(icon: Icons.phone_outlined, label: '전화', onTap: onPhone!),
              if (onSms != null)
                _HubActionButton(icon: Icons.sms_outlined, label: '문자', onTap: onSms!),
            ],
          ),
        ],
      ),
    );
  }
}

class _HubActionButton extends StatelessWidget {
  const _HubActionButton({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Material(
      color: cs.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.45)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: cs.primary),
              const SizedBox(width: 6),
              Text(label, style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConsultationSection extends StatelessWidget {
  const _ConsultationSection({
    required this.theme,
    required this.entries,
    required this.onAddConsultation,
    required this.onViewAll,
  });

  final ThemeData theme;
  final List<CustomerTimelineEntry> entries;
  final VoidCallback onAddConsultation;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) {
    final preview = entries.take(3).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        BoaSectionHeader(
          title: '상담 기록',
          actionLabel: entries.isNotEmpty ? '전체 보기' : '상담 기록 추가',
          onAction: entries.isNotEmpty ? onViewAll : onAddConsultation,
        ),
        const SizedBox(height: 8),
        if (preview.isEmpty)
          BoaEmptyState(
            icon: Icons.edit_note_outlined,
            title: '아직 등록된 상담 기록이 없습니다',
            message: '상담 내용을 기록하면 여기에 표시됩니다.',
            actionLabel: '상담 기록 추가',
            onAction: onAddConsultation,
          )
        else
          ...preview.map((e) => _ActivityRecordCard(theme: theme, entry: e)),
      ],
    );
  }
}

class _ActivityRecordCard extends StatelessWidget {
  const _ActivityRecordCard({required this.theme, required this.entry});

  final ThemeData theme;
  final CustomerTimelineEntry entry;

  @override
  Widget build(BuildContext context) {
    final cs = theme.colorScheme;
    final icon = switch (entry.kind) {
      'contract' => Icons.description_outlined,
      'schedule' => Icons.event_outlined,
      _ => Icons.add_task_outlined,
    };
    final kindLabel = switch (entry.kind) {
      'contract' => '계약',
      'schedule' => '일정',
      _ => '후속',
    };

    return BoaSurfaceCard(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: cs.primaryContainer.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: cs.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(kindLabel, style: theme.textTheme.labelSmall?.copyWith(color: cs.primary, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(
                  entry.title,
                  style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (entry.subtitle.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    entry.subtitle,
                    style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
        ],
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
        const BoaSectionHeader(title: '후속관리'),
        const SizedBox(height: 8),
        if (open.isEmpty)
          const BoaEmptyState(
            icon: Icons.add_task_outlined,
            title: '처리할 후속관리가 없습니다',
            message: '다음 액션 영역에서 후속을 등록할 수 있습니다.',
          )
        else ...[
          if (overdue.isNotEmpty) ...[
            Text('연체', style: theme.textTheme.labelLarge?.copyWith(color: Colors.red.shade700, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            ...overdue.map(
              (f) => FollowUpQuickActionTile(
                key: ValueKey('fu-od-${f['id']}'),
                raw: f,
                isOverdue: true,
                customerContextId: customerId,
                customerContextName: customerName,
              ),
            ),
            const SizedBox(height: 10),
          ],
          if (scheduled.isNotEmpty) ...[
            Text('예정', style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            ...scheduled.take(5).map(
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
    required this.onAddSchedule,
  });

  final ThemeData theme;
  final int customerId;
  final String customerName;
  final List<Map<String, dynamic>> schedules;
  final VoidCallback onOpenCalendar;
  final VoidCallback onAddSchedule;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final today = todayOpenSchedules(schedules, now);
    final upcoming = upcomingOpenSchedules(schedules, now).take(5).toList();
    final openCount = today.length + upcoming.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        BoaSectionHeader(
          title: '예정 일정',
          actionLabel: openCount > 0 ? '캘린더' : '일정 등록',
          onAction: openCount > 0 ? onOpenCalendar : onAddSchedule,
        ),
        const SizedBox(height: 8),
        if (openCount == 0)
          BoaEmptyState(
            icon: Icons.event_available_outlined,
            title: '예정된 일정이 없습니다',
            message: '일정을 등록하면 여기에 표시됩니다.',
            actionLabel: '일정 등록',
            onAction: onAddSchedule,
          )
        else ...[
          if (today.isNotEmpty) ...[
            Text('오늘', style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            ...today.map(
              (s) => ScheduleQuickActionTile(
                key: ValueKey('sch-today-${s['id']}'),
                raw: s,
                customerContextId: customerId,
                customerContextName: customerName,
                showTodayBadge: true,
              ),
            ),
            const SizedBox(height: 10),
          ],
          if (upcoming.isNotEmpty) ...[
            Text('다가오는 일정', style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
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
    required this.contracts,
    required this.onCreate,
  });

  final ThemeData theme;
  final List<BoaContractRow> contracts;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final rows = contracts;
    final premSum = sumMonthlyPremium(rows);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        BoaSectionHeader(
          title: '계약 요약',
          actionLabel: rows.isEmpty ? '계약 등록' : '계약 등록',
          onAction: onCreate,
        ),
        if (rows.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8, top: 4),
            child: Text(
              '월납 합계 ${fieldCommaInt(premSum)}원 · ${rows.length}건',
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          ),
        const SizedBox(height: 4),
        if (rows.isEmpty)
          BoaEmptyState(
            icon: Icons.description_outlined,
            title: '등록된 계약이 없습니다',
            message: '계약 정보를 등록하면 여기에 표시됩니다.',
            actionLabel: '계약 등록',
            onAction: onCreate,
          )
        else
          ...rows.take(4).map(
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
        const BoaSectionHeader(title: '고객 정보'),
        const SizedBox(height: 8),
        BoaSurfaceCard(
          margin: EdgeInsets.zero,
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: rows
                .map(
                  (r) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(r, style: theme.textTheme.bodyMedium, maxLines: 3, overflow: TextOverflow.ellipsis),
                  ),
                )
                .toList(),
          ),
        ),
      ],
    );
  }
}

class _SectionLoading extends StatelessWidget {
  const _SectionLoading({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Text('불러오는 중입니다…', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        const SizedBox(height: 8),
        const LinearProgressIndicator(minHeight: 2),
      ],
    );
  }
}

class _SectionError extends StatelessWidget {
  const _SectionError({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Text(
          '잠시 후 다시 시도해 주세요.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
      ],
    );
  }
}
