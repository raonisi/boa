import 'package:boa/features/notifications/notification_action_tile.dart';
import 'package:boa/features/notifications/notification_priority.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('NotificationActionTile shows type badges and quick actions', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: NotificationActionTile(
              raw: {
                'id': 1,
                'title': '[TEST] 오늘 확인할 업무가 있습니다.',
                'message': '후속관리할 항목이 있습니다.',
                'type': 'schedule_today',
                'relatedType': 'schedule',
                'relatedId': 10,
                'processStatus': '미확인',
                'isRead': false,
                'createdAt': '2026-06-08T09:00:00.000Z',
              },
              priority: NotificationPriority.today,
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('[TEST] 오늘 확인할 업무가 있습니다.'), findsOneWidget);
    expect(find.text('후속관리할 항목이 있습니다.'), findsOneWidget);
    expect(find.text('일정'), findsOneWidget);
    expect(find.text('미확인'), findsOneWidget);
    expect(find.text('일정 보기'), findsOneWidget);
    expect(find.text('읽음'), findsOneWidget);
  });

  testWidgets('NotificationActionTile hides unread dot when read', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: NotificationActionTile(
              raw: {
                'id': 2,
                'title': '[TEST] 처리 완료 알림',
                'type': 'general',
                'processStatus': '처리완료',
                'isRead': true,
              },
              priority: NotificationPriority.general,
              compact: true,
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('처리완료'), findsOneWidget);
    expect(find.text('읽음'), findsNothing);
  });
}
