import 'package:flutter/material.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('오늘의 브리핑', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Text(
                  'KPI·우선 연락·일정 요약이 여기에 표시됩니다. (서버 `dashboard.*` 연동 예정)',
                  style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.tonalIcon(
          onPressed: () {},
          icon: const Icon(Icons.refresh),
          label: const Text('당겨서 새로고침 연동 예정'),
        ),
      ],
    );
  }
}
