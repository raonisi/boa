import 'package:boa/features/notifications/notification_display_logic.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('notificationTypeLabel', () {
    test('maps known types', () {
      expect(notificationTypeLabel({'type': 'schedule_today'}), '일정 당일');
      expect(notificationTypeLabel({'type': 'unknown_type'}), '기타 알림');
    });
  });

  group('notificationCategory', () {
    test('classifies schedule notifications', () {
      expect(
        notificationCategory({'type': 'schedule_1hour', 'relatedType': 'schedule'}),
        NotificationCategory.schedule,
      );
    });

    test('classifies follow-up notifications', () {
      expect(
        notificationCategory({'type': 'general', 'relatedType': 'follow_up'}),
        NotificationCategory.followUp,
      );
    });

    test('classifies contract notifications', () {
      expect(
        notificationCategory({'type': 'contract_90', 'relatedType': 'contract'}),
        NotificationCategory.contractWork,
      );
    });
  });

  group('notificationProcessStatus', () {
    test('defaults to 미확인', () {
      expect(notificationProcessStatus({}), '미확인');
      expect(notificationProcessStatus({'processStatus': '처리완료'}), '처리완료');
    });
  });

  group('notificationMatchesReadFilter', () {
    test('filters unread and read', () {
      const unread = {'isRead': false};
      const read = {'isRead': true};
      expect(notificationMatchesReadFilter(unread, NotificationReadFilter.unread), isTrue);
      expect(notificationMatchesReadFilter(read, NotificationReadFilter.unread), isFalse);
      expect(notificationMatchesReadFilter(read, NotificationReadFilter.read), isTrue);
    });
  });

  group('formatNotificationDateTime', () {
    test('formats ISO timestamps', () {
      final formatted = formatNotificationDateTime('2026-06-08T10:30:00.000Z');
      expect(formatted.contains('2026-06-08'), isTrue);
    });
  });

  group('notificationBodyText', () {
    test('prefers message over type label', () {
      expect(
        notificationBodyText({'type': 'general', 'message': '예정된 일정이 있습니다.'}),
        '예정된 일정이 있습니다.',
      );
    });
  });
}
