import 'package:boa/core/config/app_config.dart';
import 'package:boa/features/home/dashboard_provider.dart';
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

  bool _onScrollNearEnd(ScrollNotification n) {
    if (n.metrics.pixels < n.metrics.maxScrollExtent - 240) return false;
    ref.read(notificationsListNotifierProvider.notifier).loadMore();
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final listState = ref.watch(notificationsListNotifierProvider);
    final items = listState.items;
    final urgentCount = items.where((n) => classifyNotificationPriority(n) == NotificationPriority.urgent).length;
    final todayCount = items.where((n) => classifyNotificationPriority(n) == NotificationPriority.today).length;
    final generalCount = items.where((n) => classifyNotificationPriority(n) == NotificationPriority.general).length;
    final filteredItems = items
        .where((n) {
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
        padding: const EdgeInsets.all(16),
        children: [
          Text('알림센터', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(
            'BOA_API_BASE_URL 을 설정하면 알림 목록이 표시됩니다.',
            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
        ],
      );
    }

    if (listState.loadingInitial && listState.items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (listState.errorMessage != null && listState.items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(listState.errorMessage!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => ref.read(notificationsListNotifierProvider.notifier).refresh(),
                child: const Text('다시 시도'),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(dashboardTodayWorkProvider);
        ref.invalidate(unreadNotificationCountProvider);
        await ref.read(notificationsListNotifierProvider.notifier).refresh();
      },
      child: NotificationListener<ScrollNotification>(
        onNotification: _onScrollNearEnd,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            Text('알림센터', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(
              '긴급 → 오늘 처리 → 일반 순으로 정렬됩니다.',
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _PriorityChip(
                    label: '긴급',
                    count: urgentCount,
                    selected: _priorityFilter == _NotificationFilter.urgent,
                    toneColor: Colors.red,
                    onTap: () {
                      setState(() {
                        _priorityFilter = _priorityFilter == _NotificationFilter.urgent
                            ? _NotificationFilter.all
                            : _NotificationFilter.urgent;
                      });
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _PriorityChip(
                    label: '오늘 처리',
                    count: todayCount,
                    selected: _priorityFilter == _NotificationFilter.today,
                    toneColor: Colors.orange,
                    onTap: () {
                      setState(() {
                        _priorityFilter = _priorityFilter == _NotificationFilter.today
                            ? _NotificationFilter.all
                            : _NotificationFilter.today;
                      });
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _PriorityChip(
                    label: '일반',
                    count: generalCount,
                    selected: _priorityFilter == _NotificationFilter.general,
                    toneColor: Colors.blueGrey,
                    onTap: () {
                      setState(() {
                        _priorityFilter = _priorityFilter == _NotificationFilter.general
                            ? _NotificationFilter.all
                            : _NotificationFilter.general;
                      });
                    },
                  ),
                ),
              ],
            ),
            if (listState.items.isNotEmpty) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  icon: const Icon(Icons.done_all_outlined, size: 20),
                  label: const Text('모두 읽음'),
                  onPressed: () async {
                    try {
                      await markAllMobileNotificationsRead(ref);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('모든 알림을 읽음 처리했습니다.')));
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
            const SizedBox(height: 12),
            if (sortedItems.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 32),
                child: Center(
                  child: Text(
                    _priorityFilter == _NotificationFilter.all ? '알림이 없습니다.' : '선택한 우선순위 알림이 없습니다.',
                    style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                  ),
                ),
              )
            else
              ...sortedItems.map((n) => _NotificationTile(theme: theme, raw: n, priority: classifyNotificationPriority(n))),
            if (listState.loadingMore)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(child: SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))),
              ),
          ],
        ),
      ),
    );
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
    final bg = selected ? toneColor.withOpacity(0.12) : Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.45);
    final border = selected ? toneColor.withOpacity(0.45) : Theme.of(context).colorScheme.outline.withOpacity(0.3);
    final textColor = selected ? toneColor : Theme.of(context).colorScheme.onSurface;

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
            Text(label, style: TextStyle(fontSize: 11, color: textColor)),
            const SizedBox(height: 2),
            Text('$count', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: textColor)),
          ],
        ),
      ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.theme, required this.raw, required this.priority});

  final ThemeData theme;
  final Map<String, dynamic> raw;
  final NotificationPriority priority;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final idVal = raw['id'];
    final id = idVal is int ? idVal : int.tryParse('$idVal') ?? 0;
    final isRead = notificationIsRead(raw);
    final title = '${raw['title'] ?? '알림'}';
    final sub = [
      '${raw['type'] ?? ''}',
      '${raw['processStatus'] ?? ''}',
      _fmt(raw['createdAt']),
    ].where((e) => e.isNotEmpty).join(' · ');

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: isRead ? const Icon(Icons.notifications_none_outlined) : Icon(Icons.mark_email_unread_outlined, color: theme.colorScheme.primary),
        title: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: isRead ? FontWeight.normal : FontWeight.w600)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (sub.isNotEmpty) Text(sub, style: theme.textTheme.bodySmall),
            const SizedBox(height: 3),
            _PriorityBadge(priority: priority),
          ],
        ),
        trailing: const Icon(Icons.done_all_outlined, size: 20),
        onTap: id == 0
            ? null
            : () async {
                try {
                  await markMobileNotificationRead(ref, id);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('읽음 처리했습니다.')));
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                  }
                }
              },
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

class _PriorityBadge extends StatelessWidget {
  const _PriorityBadge({required this.priority});

  final NotificationPriority priority;

  @override
  Widget build(BuildContext context) {
    final (label, bg, fg) = switch (priority) {
      NotificationPriority.urgent => ('긴급', Colors.red.shade100, Colors.red.shade700),
      NotificationPriority.today => ('오늘 처리', Colors.orange.shade100, Colors.orange.shade700),
      NotificationPriority.general => ('일반', Colors.blueGrey.shade100, Colors.blueGrey.shade700),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, color: fg, fontWeight: FontWeight.w600),
      ),
    );
  }
}
