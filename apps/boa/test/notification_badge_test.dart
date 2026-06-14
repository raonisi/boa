import 'package:boa/features/notifications/notification_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('formatUnreadBadgeLabel', () {
    test('returns empty for zero', () {
      expect(formatUnreadBadgeLabel(0), '');
    });

    test('caps at 99+', () {
      expect(formatUnreadBadgeLabel(100), '99+');
      expect(formatUnreadBadgeLabel(12), '12');
    });
  });

  testWidgets('NotificationBadgeIcon hides badge when count is zero', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: NotificationBadgeIcon(
            unreadCount: 0,
            icon: Icon(Icons.notifications_outlined),
          ),
        ),
      ),
    );
    expect(find.byType(Badge), findsNothing);
  });

  testWidgets('NotificationBadgeIcon shows count badge', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: NotificationBadgeIcon(
            unreadCount: 3,
            icon: Icon(Icons.notifications_outlined),
          ),
        ),
      ),
    );
    expect(find.text('3'), findsOneWidget);
  });
}
