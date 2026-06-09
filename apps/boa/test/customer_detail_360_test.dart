import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:boa/features/customers/customer_contracts_provider.dart';
import 'package:boa/features/customers/customer_detail_360.dart';
import 'package:boa/features/customers/customer_followups_provider.dart';
import 'package:boa/features/customers/customer_schedules_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _testCustomer() => {
      'id': 7,
      'name': '[TEST] Kim',
      'consultStatus': '상담예정',
      'priority': 'A',
      'nextAction': '재연락',
      'phone': '01012345678',
      'customerTags': '["가격민감형"]',
      'updatedAt': '2026-06-08T10:00:00.000Z',
    };

List<Override> _overrides() => [
      customerContractsProvider(7).overrideWith((ref) async => [
            const BoaContractRow(id: 1, productName: '[TEST] Product', monthlyPremium: 50000),
          ]),
      customerFollowUpsProvider(7).overrideWith((ref) async => [
            {
              'id': 10,
              'reason': '[TEST] Follow',
              'status': 'scheduled',
              'nextContactDate': '2026-06-08',
            },
          ]),
      customerSchedulesProvider(7).overrideWith((ref) async => []),
    ];

void main() {
  testWidgets('CustomerDetail360View renders hero and quick actions', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: _overrides(),
        child: MaterialApp(
          home: Scaffold(
            body: CustomerDetail360View(customerId: 7, customer: _testCustomer()),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('[TEST] Kim'), findsOneWidget);
    expect(find.text('빠른 등록'), findsOneWidget);
    expect(find.text('상담기록'), findsOneWidget);
    expect(find.text('후속관리'), findsOneWidget);
    expect(find.text('완료'), findsOneWidget);
    expect(find.text('다음 액션'), findsOneWidget);
  });

  testWidgets('CustomerDetail360View shows empty schedule state', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: _overrides(),
        child: MaterialApp(
          home: Scaffold(
            body: CustomerDetail360View(customerId: 7, customer: _testCustomer()),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('연결된 일정이 없습니다'), findsOneWidget);
  });
}
