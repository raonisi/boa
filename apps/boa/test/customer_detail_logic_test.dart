import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:boa/features/customers/customer_detail_logic.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('parseCustomerTags', () {
    test('parses JSON array string', () {
      expect(parseCustomerTags('["가격민감형","보장불안형"]'), ['가격민감형', '보장불안형']);
    });

    test('parses comma-separated fallback', () {
      expect(parseCustomerTags('A, B'), ['A', 'B']);
    });
  });

  group('buildCustomerTimeline', () {
    test('sorts entries by occurredAt descending', () {
      final entries = buildCustomerTimeline(
        followUps: [
          {
            'reason': '[TEST] Old follow-up',
            'status': 'completed',
            'createdAt': '2026-06-01T10:00:00.000Z',
          },
        ],
        contracts: [
          BoaContractRow(
            id: 1,
            productName: '[TEST] Contract',
            contractDate: DateTime.parse('2026-06-08T09:00:00.000Z'),
            monthlyPremium: 100000,
          ),
        ],
        schedules: [
          {
            'title': '[TEST] Meeting',
            'startTime': '2026-06-05T11:00:00.000Z',
            'status': '예정',
          },
        ],
      );

      expect(entries.length, 3);
      expect(entries.first.kind, 'contract');
    });
  });

  group('priorityLabel', () {
    test('maps English priority values to Korean labels', () {
      expect(priorityLabel('HIGH'), '높음');
      expect(priorityLabel('MEDIUM'), '보통');
      expect(priorityLabel('LOW'), '낮음');
      expect(priorityLabel('URGENT'), '긴급');
      expect(priorityLabel('NORMAL'), '보통');
      expect(priorityLabel('IMPORTANT'), '중요');
      expect(priorityLabel('unclassified'), '미분류');
    });

    test('preserves internal grade codes and API payload values', () {
      expect(priorityLabel('A'), 'A');
      expect(priorityLabel('B'), 'B');
    });
  });

  group('isFollowUpOverdue', () {
    test('detects overdue open follow-up', () {
      final now = DateTime(2026, 6, 8);
      expect(
        isFollowUpOverdue({
          'status': 'scheduled',
          'nextContactDate': '2026-06-01',
        }, now),
        isTrue,
      );
    });
  });
}
