import 'package:flutter/material.dart';

class NotificationsTab extends StatelessWidget {
  const NotificationsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('알림센터', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Text(
          '푸시 탭 시 이 탭으로 딥링크. `notifications.*` 연동 예정.',
          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        ),
        const SizedBox(height: 16),
        for (var i = 0; i < 3; i++)
          Card(
            child: ListTile(
              title: Text('알림 제목 ${i + 1}'),
              subtitle: const Text('처리 상태 · 유형'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {},
            ),
          ),
      ],
    );
  }
}
