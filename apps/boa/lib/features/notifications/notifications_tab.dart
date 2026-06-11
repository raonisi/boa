import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_layout_helpers.dart';
import 'package:boa/core/widgets/boa_pull_refresh.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:boa/features/more/push_preferences_screen.dart';
import 'package:boa/features/notifications/notification_action_tile.dart';
import 'package:boa/features/notifications/notification_display_logic.dart';
import 'package:boa/features/notifications/notification_priority.dart';
import 'package:boa/features/notifications/notifications_providers.dart';
import 'package:boa/features/notifications/unread_count_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum _NotificationFilter { all, urgent, today, general }

class NotificationsTab extends ConsumerStatefulWidget {
  const NotificationsTab({super.key});

  @override
  ConsumerState<NotificationsTab> createState() => _NotificationsTabState();
}

class _NotificationsTabState extends ConsumerState<NotificationsTab> {
  _NotificationFilter _priorityFilter = _NotificationFilter.all;
  NotificationReadFilter _readFilter = NotificationReadFilter.all;

  bool _onScrollNearEnd(ScrollNotification n) {
    if (n.metrics.pixels < n.metrics.maxScrollExtent - 240) return false;
    ref.read(notificationsListNotifierProvider.notifier).loadMore();
    return false;
  }

  Future<void> _refreshNotifications(BuildContext context) {
    return BoaPullRefresh.runListRefresh(
      context,
      () async {
        ref.invalidate(dashboardTodayWorkProvider);
        ref.invalidate(unreadNotificationCountProvider);
        await ref.read(notificationsListNotifierProvider.notifier).refresh();
      },
      () => ref.read(notificationsListNotifierProvider).errorMessage != null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final listState = ref.watch(notificationsListNotifierProvider);
    final unreadAsync = ref.watch(unreadNotificationCountProvider);
    final items = listState.items;
    final unreadInList = items.where((n) => !notificationIsRead(n)).length;
    final urgentCount = items.where((n) => classifyNotificationPriority(n) == NotificationPriority.urgent).length;
    final todayCount = items.where((n) => classifyNotificationPriority(n) == NotificationPriority.today).length;
    final generalCount = items.where((n) => classifyNotificationPriority(n) == NotificationPriority.general).length;
    final filteredItems = items
        .where((n) {
          if (!notificationMatchesReadFilter(n, _readFilter)) return false;
          final priority = classifyNotificationPriority(n);
          if (_priorityFilter == _NotificationFilter.all) return true;
          if (_priorityFilter == _NotificationFilter.urgent) return priority == NotificationPriority.urgent;
          if (_priorityFilter == _NotificationFilter.today) return priority == NotificationPriority.today;
          return priority == NotificationPriority.general;
        })
        .toList();
    final sortedItems = sortNotificationsForQueue(filteredItems);

    if (!AppConfig.hasApiBase) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [BoaServerConfigHint(title: '서버 연결이 설정되지 않았습니다', message: '알림을 받으려면 앱 서버 연결이 필요합니다. 배포 담당자에게 문의해 주세요.')],
      );
    }

    if (listState.loadingInitial && listState.items.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => _refreshNotifications(context),
        child: boaRefreshScrollChild(
          context: context,
          child: const Column(
            children: [
              SizedBox(height: 8),
              Center(child: Text('알림을 불러오는 중입니다…')),
              SizedBox(height: 16),
              BoaListLoadingSkeleton(itemCount: 3),
            ],
          ),
        ),
      );
    }

    if (listState.errorMessage != null && listState.items.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => _refreshNotifications(context),
        child: boaRefreshScrollChild(
          context: context,
          child: BoaErrorState(
            title: '알림을 불러오지 못했습니다',
            message: '잠시 후 다시 시도해 주세요.',
            onRetry: () => _refreshNotifications(context),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _refreshNotifications(context),
      child: NotificationListener<ScrollNotification>(
        onNotification: _onScrollNearEnd,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: BoaLayout.listPadding(context, horizontal: 16, top: 16, extraBottom: 8),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('알림함', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      unreadAsync.when(
                        data: (count) => Text(
                          count > 0 ? '미확인 알림 $count건 · 긴급 → 오늘 → 일반 순' : '아직 처리할 알림이 없습니다.',
                          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        loading: () => Text(
                          '미확인 알림을 불러오는 중…',
                          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                        ),
                        error: (_, __) => Text(
                          unreadInList > 0 ? '미확인 $unreadInList건 (목록 기준)' : '새 알림이 없습니다.',
                          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: '알림 설정',
                  icon: const Icon(Icons.settings_outlined),
                  onPressed: () {
                    Navigator.of(context).push<void>(
                      MaterialPageRoute<void>(builder: (_) => const PushPreferencesScreen()),
                    );
                  },
                ),
              ],
            ),
            const SizedBox(height: 10),
            LayoutBuilder(
              builder: (context, constraints) {
                final maxW = constraints.maxWidth;
                final threeCol = maxW >= 360 && !BoaLayout.isLargeText(context);
                final itemWidth = threeCol ? (maxW - 16) / 3 : (maxW - 8) / 2;
                Widget chipBox(Widget chip) => SizedBox(width: threeCol ? itemWidth : itemWidth, child: chip);
                return Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    chipBox(_PriorityChip(
                      label: '긴급',
                      count: urgentCount,
                      selected: _priorityFilter == _NotificationFilter.urgent,
                      toneColor: BoaColors.urgent,
                      onTap: () {
                        boaSelectionHaptic();
                        setState(() {
                          _priorityFilter = _priorityFilter == _NotificationFilter.urgent
                              ? _NotificationFilter.all
                              : _NotificationFilter.urgent;
                        });
                      },
                    )),
                    chipBox(_PriorityChip(
                      label: '오늘 처리',
                      count: todayCount,
                      selected: _priorityFilter == _NotificationFilter.today,
                      toneColor: BoaColors.todayAccent,
                      onTap: () {
                        boaSelectionHaptic();
                        setState(() {
                          _priorityFilter = _priorityFilter == _NotificationFilter.today
                              ? _NotificationFilter.all
                              : _NotificationFilter.today;
                        });
                      },
                    )),
                    SizedBox(
                      width: threeCol ? itemWidth : maxW,
                      child: _PriorityChip(
                        label: '일반',
                        count: generalCount,
                        selected: _priorityFilter == _NotificationFilter.general,
                        toneColor: BoaColors.deepGreen,
                        onTap: () {
                          boaSelectionHaptic();
                          setState(() {
                            _priorityFilter = _priorityFilter == _NotificationFilter.general
                                ? _NotificationFilter.all
                                : _NotificationFilter.general;
                          });
                        },
                      ),
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('전체'),
                  selected: _readFilter == NotificationReadFilter.all,
                  onSelected: (_) {
                    if (_readFilter == NotificationReadFilter.all) return;
                    boaSelectionHaptic();
                    setState(() => _readFilter = NotificationReadFilter.all);
                  },
                ),
                ChoiceChip(
                  label: Text('미확인${unreadInList > 0 ? ' ($unreadInList)' : ''}'),
                  selected: _readFilter == NotificationReadFilter.unread,
                  onSelected: (_) {
                    if (_readFilter == NotificationReadFilter.unread) return;
                    boaSelectionHaptic();
                    setState(() => _readFilter = NotificationReadFilter.unread);
                  },
                ),
                ChoiceChip(
                  label: const Text('읽음'),
                  selected: _readFilter == NotificationReadFilter.read,
                  onSelected: (_) {
                    if (_readFilter == NotificationReadFilter.read) return;
                    boaSelectionHaptic();
                    setState(() => _readFilter = NotificationReadFilter.read);
                  },
                ),
              ],
            ),
            if (listState.items.isNotEmpty) ...[
              const SizedBox(height: 4),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  icon: const Icon(Icons.done_all_outlined, size: 20),
                  label: const Text('모두 읽음'),
                  onPressed: () async {
                    try {
                      await markAllMobileNotificationsRead(ref);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('모든 알림을 읽음 처리했습니다.')),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                      }
                    }
                  },
                ),
              ),
            ],
            const SizedBox(height: 8),
            if (sortedItems.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: BoaEmptyState(
                  icon: Icons.notifications_none_outlined,
                  title: _emptyTitle(),
                  message: _emptyMessage(),
                ),
              )
            else
              ...sortedItems.map(
                (n) => NotificationActionTile(
                  key: ValueKey('notif-${n['id']}'),
                  raw: n,
                  priority: classifyNotificationPriority(n),
                ),
              ),
            if (listState.loadingMore)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(child: SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))),
              ),
            if (listState.errorMessage != null && listState.items.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  '일부 알림을 갱신하지 못했습니다.',
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _emptyTitle() {
    if (_readFilter == NotificationReadFilter.unread) {
      return _priorityFilter == _NotificationFilter.all ? '새 알림이 없습니다.' : '미확인 알림이 없습니다.';
    }
    if (_readFilter == NotificationReadFilter.read) return '읽은 알림이 없습니다.';
    if (_priorityFilter != _NotificationFilter.all) return '선택한 우선순위 알림이 없습니다.';
    return '아직 처리할 알림이 없습니다';
  }

  String _emptyMessage() {
    if (_readFilter == NotificationReadFilter.unread && _priorityFilter == _NotificationFilter.all) {
      return '업무 알림이 도착하면 이곳에 표시됩니다.';
    }
    if (_priorityFilter != _NotificationFilter.all || _readFilter != NotificationReadFilter.all) {
      return '다른 필터를 선택해 보세요.';
    }
    return '오늘 처리할 알림이 없습니다.';
  }
}

class _PriorityChip extends StatelessWidget {
  const _PriorityChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.toneColor,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final Color toneColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bg = selected ? toneColor.withValues(alpha: 0.1) : BoaColors.card;
    final border = selected ? toneColor.withValues(alpha: 0.35) : BoaColors.border;
    final textColor = selected ? toneColor : BoaColors.textPrimary;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Ink(
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: border),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(fontSize: 11, color: textColor), maxLines: 1, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 2),
            Text('$count', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: textColor)),
          ],
        ),
      ),
    );
  }
}
