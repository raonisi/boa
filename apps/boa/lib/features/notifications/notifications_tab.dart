import 'package:boa/core/config/app_config.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class NotificationsTab extends ConsumerWidget {
  const NotificationsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);

    if (!AppConfig.hasApiBase) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('알림센터', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(
            'API 설정 후 미처리 알림 요약이 표시됩니다.',
            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
        ],
      );
    }

    final async = ref.watch(dashboardTodayWorkProvider);

    return async.when(
      data: (d) {
        final list = d.pendingNotifications;
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(dashboardTodayWorkProvider);
            await ref.read(dashboardTodayWorkProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text('알림센터', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(
                '미처리 알림 ${d.cards.pendingNotificationCount}건 (상위 ${list.length}건)',
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 12),
              if (list.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 24),
                  child: Center(
                    child: Text('표시할 미처리 알림이 없습니다.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  ),
                )
              else
                ...list.map((n) => _NotificationCard(theme, n)),
            ],
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Text('$e', textAlign: TextAlign.center))),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard(this.theme, this.raw);

  final ThemeData theme;
  final Map<String, dynamic> raw;

  @override
  Widget build(BuildContext context) {
    final title = '${raw['title'] ?? '알림'}';
    final customer = raw['customerName'];
    final sub = [
      if (customer != null && '$customer'.isNotEmpty) '$customer',
      '${raw['processStatus'] ?? ''}',
      _fmt(raw['createdAt']),
    ].where((e) => e.isNotEmpty).join(' · ');
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: sub.isEmpty ? null : Text(sub, style: theme.textTheme.bodySmall),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {},
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
