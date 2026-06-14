import 'package:boa/core/widgets/boa_user_labels.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('consultStatusLabel', () {
    test('keeps Korean consult statuses', () {
      expect(consultStatusLabel('미상담'), '미상담');
      expect(consultStatusLabel('통화완료'), '통화완료');
    });

    test('maps English enums to Korean labels', () {
      expect(consultStatusLabel('not_contacted'), '미상담');
      expect(consultStatusLabel('unknown'), '확인 필요');
      expect(consultStatusLabel('scheduled'), '예정');
    });
  });

  group('priorityLabel', () {
    test('maps English priority values to Korean labels', () {
      expect(priorityLabel('HIGH'), '높음');
      expect(priorityLabel('MEDIUM'), '보통');
      expect(priorityLabel('LOW'), '낮음');
      expect(priorityLabel('URGENT'), '긴급');
      expect(priorityLabel('unclassified'), '미분류');
    });

    test('preserves grade codes and maps unknown English enums', () {
      expect(priorityLabel('A'), 'A');
      expect(priorityLabel('B'), 'B');
      expect(priorityLabel('weird_status'), '확인 필요');
    });
  });

  group('contractStatusLabel', () {
    test('maps English contract statuses', () {
      expect(contractStatusLabel('pending'), '대기');
      expect(contractStatusLabel('completed'), '완료');
    });

    test('keeps Korean contract statuses', () {
      expect(contractStatusLabel('청약'), '청약');
      expect(contractStatusLabel('성립'), '성립');
    });
  });
}
