import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/auth/session_models.dart';
import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/features/calendar/calendar_agenda_provider.dart';
import 'package:boa/features/calendar/calendar_schedule_scope.dart';
import 'package:boa/features/calendar/calendar_scope_provider.dart';
import 'package:boa/features/contracts/contract_agents_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CalendarScopeSelector extends ConsumerWidget {
  const CalendarScopeSelector({
    super.key,
    required this.agenda,
  });

  final CalendarAgenda agenda;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final session = ref.watch(sessionProvider);
    final role = session?.user.role ?? BoaRole.member;
    final options = scheduleScopeOptionsForRole(role);
    if (options.length <= 1) return const SizedBox.shrink();

    final scope = ref.watch(calendarScopeProvider);
    final summary = scheduleScopeSummaryLabel(
      scope: scope,
      role: role,
      ownerName: _ownerName(scope, agenda, ref),
      teamName: _teamName(scope, agenda),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Icon(Icons.filter_list_outlined, size: 18, color: BoaColors.deepGreen),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '조회 범위 · $summary',
                style: theme.textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: BoaColors.navy,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (scope.viewMode == ScheduleViewMode.user || scope.viewMode == ScheduleViewMode.team)
              TextButton(
                onPressed: () => _openScopeSheet(context, ref, role, agenda),
                child: const Text('변경'),
              ),
          ],
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final opt in options) ...[
                _ScopeChip(
                  label: opt.label,
                  selected: scope.viewMode == opt.viewMode,
                  onTap: () => _onSelectMode(context, ref, role, opt.viewMode, agenda),
                ),
                const SizedBox(width: 8),
              ],
            ],
          ),
        ),
        if (agenda.organizationViewWarning != null && agenda.organizationViewWarning!.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            agenda.organizationViewWarning!,
            style: theme.textTheme.labelSmall?.copyWith(color: cs.onSurfaceVariant),
          ),
        ],
      ],
    );
  }

  String? _ownerName(CalendarScheduleScope scope, CalendarAgenda agenda, WidgetRef ref) {
    if (scope.ownerUserId == null) return null;
    for (final u in agenda.viewUsers) {
      if (u.userId == scope.ownerUserId) return u.name;
    }
    final agents = ref.read(assignableAgentsProvider).maybeWhen(
          data: (list) => list,
          orElse: () => const <AssignableAgent>[],
        );
    for (final a in agents) {
      if (a.id == scope.ownerUserId) return a.name;
    }
    return null;
  }

  String? _teamName(CalendarScheduleScope scope, CalendarAgenda agenda) {
    if (scope.teamId == null) return null;
    for (final t in agenda.viewTeams) {
      if (t.teamId == scope.teamId) return t.name;
    }
    return null;
  }

  Future<void> _onSelectMode(
    BuildContext context,
    WidgetRef ref,
    BoaRole role,
    ScheduleViewMode mode,
    CalendarAgenda agenda,
  ) async {
    if (mode == ScheduleViewMode.user) {
      ref.read(calendarScopeProvider.notifier).setViewMode(mode);
      await _openScopeSheet(context, ref, role, agenda);
      return;
    }
    if (mode == ScheduleViewMode.team) {
      final teams = _teamsForRole(role, agenda, ref);
      if (teams.length == 1) {
        ref.read(calendarScopeProvider.notifier).selectTeam(teams.first.teamId);
        ref.invalidate(calendarAgendaProvider);
        return;
      }
      ref.read(calendarScopeProvider.notifier).setViewMode(mode);
      await _openScopeSheet(context, ref, role, agenda);
      return;
    }
    ref.read(calendarScopeProvider.notifier).setViewMode(mode);
    ref.invalidate(calendarAgendaProvider);
  }

  List<ScheduleViewTeam> _teamsForRole(BoaRole role, CalendarAgenda agenda, WidgetRef ref) {
    if (role == BoaRole.teamLeader) {
      final session = ref.read(sessionProvider);
      final selfTeam = agenda.viewUsers
          .where((u) => u.userId == session?.user.id)
          .map((u) => u.teamId)
          .whereType<int>()
          .toList();
      if (selfTeam.isNotEmpty) {
        return agenda.viewTeams.where((t) => selfTeam.contains(t.teamId)).toList();
      }
      if (agenda.viewTeams.length == 1) return agenda.viewTeams;
    }
    if (role == BoaRole.subBranchAdmin) {
      final users = _usersForRole(role, agenda, ref);
      final teamIds = users.map((u) => u.teamId).whereType<int>().toSet();
      return agenda.viewTeams.where((t) => teamIds.contains(t.teamId)).toList();
    }
    return agenda.viewTeams;
  }

  List<ScheduleViewUser> _usersForRole(BoaRole role, CalendarAgenda agenda, WidgetRef ref) {
    if (role == BoaRole.branchAdmin) {
      return agenda.viewUsers;
    }
    final agents = ref.read(assignableAgentsProvider).maybeWhen(
          data: (list) => list,
          orElse: () => const <AssignableAgent>[],
        );
    if (agents.isEmpty) return const [];
    final allowed = agents.map((a) => a.id).toSet();
    final fromAgenda = agenda.viewUsers.where((u) => allowed.contains(u.userId)).toList();
    if (fromAgenda.isNotEmpty) return fromAgenda;
    return agents.map((a) => ScheduleViewUser(userId: a.id, name: a.name)).toList();
  }

  Future<void> _openScopeSheet(
    BuildContext context,
    WidgetRef ref,
    BoaRole role,
    CalendarAgenda agenda,
  ) async {
    final scope = ref.read(calendarScopeProvider);
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) {
        return _ScopePickerSheet(
          role: role,
          scope: scope,
          agenda: agenda,
          teams: _teamsForRole(role, agenda, ref),
          users: _usersForRole(role, agenda, ref),
          onPickUser: (id) {
            ref.read(calendarScopeProvider.notifier).selectOwner(id);
            ref.invalidate(calendarAgendaProvider);
            Navigator.pop(ctx);
          },
          onPickTeam: (id) {
            ref.read(calendarScopeProvider.notifier).selectTeam(id);
            ref.invalidate(calendarAgendaProvider);
            Navigator.pop(ctx);
          },
        );
      },
    );
  }
}

class _ScopeChip extends StatelessWidget {
  const _ScopeChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      showCheckmark: false,
      labelStyle: TextStyle(
        fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
        color: selected ? BoaColors.navy : BoaColors.textPrimary,
      ),
      selectedColor: BoaColors.deepGreen.withValues(alpha: 0.12),
      backgroundColor: BoaColors.card,
      side: BorderSide(color: selected ? BoaColors.deepGreen.withValues(alpha: 0.35) : BoaColors.border),
    );
  }
}

class _ScopePickerSheet extends StatelessWidget {
  const _ScopePickerSheet({
    required this.role,
    required this.scope,
    required this.agenda,
    required this.teams,
    required this.users,
    required this.onPickUser,
    required this.onPickTeam,
  });

  final BoaRole role;
  final CalendarScheduleScope scope;
  final CalendarAgenda agenda;
  final List<ScheduleViewTeam> teams;
  final List<ScheduleViewUser> users;
  final ValueChanged<int> onPickUser;
  final ValueChanged<int> onPickTeam;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottom = MediaQuery.viewInsetsOf(context).bottom;

    if (scope.viewMode == ScheduleViewMode.team) {
      return Padding(
        padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('팀 선택', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            if (teams.isEmpty)
              Text('선택 가능한 팀이 없습니다.', style: theme.textTheme.bodyMedium)
            else
              ...teams.map(
                (t) => ListTile(
                  title: Text(t.name),
                  trailing: scope.teamId == t.teamId ? const Icon(Icons.check, color: BoaColors.deepGreen) : null,
                  onTap: () => onPickTeam(t.teamId),
                ),
              ),
          ],
        ),
      );
    }

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            role == BoaRole.teamLeader ? '팀원 선택' : '사용자 선택',
            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          if (users.isEmpty)
            Text('선택 가능한 사용자가 없습니다.', style: theme.textTheme.bodyMedium)
          else
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: users.length,
                itemBuilder: (context, i) {
                  final u = users[i];
                  return ListTile(
                    title: Text(u.name),
                    subtitle: u.teamName != null ? Text(u.teamName!) : null,
                    trailing: scope.ownerUserId == u.userId
                        ? const Icon(Icons.check, color: BoaColors.deepGreen)
                        : null,
                    onTap: () => onPickUser(u.userId),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
