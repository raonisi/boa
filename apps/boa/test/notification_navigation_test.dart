import 'package:boa/features/notifications/notification_navigation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('resolveNotificationNavTarget', () {
    test('customer relatedType opens customer detail', () {
      final target = resolveNotificationNavTarget({
        'type': 'long_unmanaged_90',
        'relatedType': 'customer',
        'relatedId': 42,
      });
      expect(target.kind, NotificationNavKind.customerDetail);
      expect(target.customerId, 42);
      expect(target.actionLabel, '고객 보기');
    });

    test('schedule relatedType opens calendar tab', () {
      final target = resolveNotificationNavTarget({
        'type': 'schedule_today',
        'relatedType': 'schedule',
        'relatedId': 10,
      });
      expect(target.kind, NotificationNavKind.shellTab);
      expect(target.shellTabIndex, kShellCalendarTabIndex);
      expect(target.actionLabel, '일정 보기');
    });

    test('follow_up relatedType opens calendar tab', () {
      final target = resolveNotificationNavTarget({
        'type': 'general',
        'relatedType': 'follow_up',
        'relatedId': 5,
      });
      expect(target.kind, NotificationNavKind.shellTab);
      expect(target.shellTabIndex, kShellCalendarTabIndex);
      expect(target.actionLabel, '후속관리 보기');
    });

    test('contract type opens contracts tab', () {
      final target = resolveNotificationNavTarget({
        'type': 'contract_90',
        'relatedType': 'contract',
        'relatedId': 3,
      });
      expect(target.kind, NotificationNavKind.shellTab);
      expect(target.shellTabIndex, kShellContractsTabIndex);
      expect(target.actionLabel, '계약 보기');
    });

    test('missing target returns none', () {
      final target = resolveNotificationNavTarget({'type': 'general'});
      expect(target.kind, NotificationNavKind.none);
      expect(target.canNavigate, isFalse);
    });
  });
}
