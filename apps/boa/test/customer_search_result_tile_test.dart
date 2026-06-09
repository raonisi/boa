import 'package:boa/features/customers/customers_providers.dart';
import 'package:boa/features/search/customer_search_result_tile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('CustomerSearchResultTile renders customer fields and quick actions', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CustomerSearchResultTile(
            customer: const BoaCustomerRow(
              id: 7,
              name: '[TEST] Lee',
              consultStatus: '상담예정',
              priority: 'A',
              nextAction: '재연락',
              phone: '01012345678',
            ),
            onOpenDetail: () {},
            onQuickAction: (_) {},
          ),
        ),
      ),
    );

    expect(find.text('[TEST] Lee'), findsOneWidget);
    expect(find.textContaining('상담예정'), findsOneWidget);
    expect(find.text('상담 기록'), findsOneWidget);
    expect(find.text('후속 등록'), findsOneWidget);
    expect(find.text('일정 등록'), findsOneWidget);
    expect(find.text('계약 등록'), findsOneWidget);
  });
}
