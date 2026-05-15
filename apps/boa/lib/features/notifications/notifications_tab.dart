import 'package:boa/core/config/app_config.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:boa/features/notifications/notifications_providers.dart';
import 'package:boa/features/notifications/unread_count_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class NotificationsTab extends ConsumerStatefulWidget {
  const NotificationsTab({super.key});

  @override
  ConsumerState<NotificationsTab> createState() => _NotificationsTabState();
}

class _NotificationsTabState extends ConsumerState<NotificationsTab> {
  bool _onScrollNearEnd(ScrollNotification n) {
    if (n.metrics.pixels < n.metrics.maxScrollExtent - 240) return false;
    ref.read(notificationsListNotifierProvider.notifier).loadMore();
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final listState = ref.watch(notificationsListNotifierProvider);

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
              '탭하면 읽음 처리 · 목록 끝까지 스크롤하면 이전 알림을 더 불러옵니다.',
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
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
            if (listState.items.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 32),
                child: Center(
                  child: Text('알림이 없습니다.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                ),
              )
            else
              ...listState.items.map((n) => _NotificationTile(theme: theme, raw: n)),
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

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.theme, required this.raw});

  final ThemeData theme;
  final Map<String, dynamic> raw;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final idVal = raw['id'];
    final id = idVal is int ? idVal : int.tryParse('$idVal') ?? 0;
    final isRead = raw['isRead'] == true || raw['isRead'] == 1;
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
        subtitle: sub.isEmpty ? null : Text(sub, style: theme.textTheme.bodySmall),
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
