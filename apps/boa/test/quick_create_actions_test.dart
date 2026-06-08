import 'package:boa/features/search/quick_create_actions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('quick create labels match spec', () {
    expect(quickCreateActionLabel(QuickCreateAction.customerRegister), '고객 등록');
    expect(quickCreateActionLabel(QuickCreateAction.consultation), '상담 기록');
    expect(quickCreateActionLabel(QuickCreateAction.followUp), '후속 등록');
    expect(quickCreateActionLabel(QuickCreateAction.schedule), '일정 등록');
    expect(quickCreateActionLabel(QuickCreateAction.contract), '계약 등록');
  });

  test('quick create icons are defined', () {
    for (final action in QuickCreateAction.values) {
      expect(quickCreateActionIcon(action), isA<IconData>());
    }
  });
}
