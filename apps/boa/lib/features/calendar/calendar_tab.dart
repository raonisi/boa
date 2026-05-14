import 'package:flutter/material.dart';

class CalendarTab extends StatelessWidget {
  const CalendarTab({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.calendar_month, size: 56, color: theme.colorScheme.primary.withAlpha(128)),
            const SizedBox(height: 16),
            Text('일정 캘린더', style: theme.textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              '월간 뷰·등록·알림 연동은 `schedules.*` API와 캘린더 위젯으로 구현 예정입니다.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}
