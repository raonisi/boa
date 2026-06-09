import 'package:boa/features/calendar/schedule_quick_action_tile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('ScheduleQuickActionTile renders action chips', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: ScheduleQuickActionTile(
              showTodayBadge: true,
              raw: {
                'id': 5,
                'customerId': 7,
                'customerName': '[TEST] Lee',
                'title': '[TEST] 미팅',
                'startTime': '2026-06-08T10:00:00.000',
                'status': '예정',
              },
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('[TEST] 미팅'), findsOneWidget);
    expect(find.text('오늘'), findsOneWidget);
    expect(find.text('완료'), findsOneWidget);
    expect(find.text('고객 보기'), findsOneWidget);
    expect(find.text('상담 기록'), findsOneWidget);
    expect(find.text('일정 등록'), findsOneWidget);
  });

  testWidgets('ScheduleQuickActionTile hides complete for finished schedule', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: ScheduleQuickActionTile(
              raw: {
                'id': 6,
                'title': '[TEST] Done',
                'startTime': '2026-06-08T10:00:00.000',
                'status': '완료',
              },
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('완료'), findsNothing);
    expect(find.text('일정 등록'), findsOneWidget);
  });
}
