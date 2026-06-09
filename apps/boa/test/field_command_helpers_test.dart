import 'package:boa/features/home/dashboard_provider.dart';
import 'package:boa/features/home/field_command_helpers.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('field_command_helpers', () {
    test('fieldIsOpenFollowUp recognizes open statuses', () {
      expect(fieldIsOpenFollowUp('scheduled'), isTrue);
      expect(fieldIsOpenFollowUp('postponed'), isTrue);
      expect(fieldIsOpenFollowUp('completed'), isFalse);
    });

    test('fieldKoreanDateHeader formats Korean weekday', () {
      expect(
        fieldKoreanDateHeader(DateTime(2026, 6, 8)),
        '2026년 6월 8일 (월)',
      );
    });

    test('fieldMergeContactQueue prioritizes overdue and dedupes', () {
      final merged = fieldMergeContactQueue(
        overdue: [
          {'id': 1, 'customerName': 'A'},
          {'id': 2, 'customerName': 'B'},
        ],
        today: [
          {'id': 2, 'customerName': 'B-dup'},
          {'id': 3, 'customerName': 'C'},
        ],
        limit: 5,
      );
      expect(merged.length, 3);
      expect(merged[0]['id'], 1);
      expect(merged[1]['id'], 2);
      expect(merged[1]['customerName'], 'B');
      expect(merged[2]['id'], 3);
    });

    test('fieldTodayActionCount sums follow-up schedule and notifications', () {
      expect(
        fieldTodayActionCount(
          todayFollowUpCount: 2,
          todayScheduleCount: 3,
          pendingNotificationCount: 1,
        ),
        6,
      );
    });
  });

  group('DashboardTodayPayload', () {
    test('parses follow-up and long-unmanaged fields from API shape', () {
      final payload = DashboardTodayPayload.fromJson({
        'scope': 'member',
        'cards': {
          'todayScheduleCount': 1,
          'incompleteScheduleCount': 0,
          'pendingNotificationCount': 2,
          'longUnmanagedCustomerCount': 1,
          'monthlyContractCount': 3,
          'monthlyPremiumSum': 120000,
          'todayFollowUpCount': 4,
          'overdueFollowUpCount': 1,
        },
        'todaySchedules': [],
        'incompleteSchedules': [],
        'pendingNotifications': [],
        'todayFollowUps': [
          {'id': 10, 'customerId': 5, 'customerName': '[TEST] Kim'},
        ],
        'overdueFollowUps': [
          {'id': 11, 'customerId': 6, 'customerName': '[TEST] Lee'},
        ],
        'longUnmanagedCustomers': [
          {'id': 6, 'name': '[TEST] Lee', 'consultStatus': '상담중'},
        ],
      });

      expect(payload.todayFollowUps.length, 1);
      expect(payload.overdueFollowUps.length, 1);
      expect(payload.longUnmanagedCustomers.length, 1);
      expect(payload.cards.monthlyPremiumSum, 120000);
    });
  });
}
