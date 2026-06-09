import 'package:boa/features/contracts/contract_summary_card.dart';
import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('ContractSummaryCard renders premium and status', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: ContractSummaryCard(
            row: BoaContractRow(
              id: 9,
              customerId: 7,
              productName: '[TEST] 종신보험',
              company: '[TEST] Insurer',
              monthlyPremium: 85000,
              contractStatus: '청약',
              paymentStatus: '정상',
              contractDate: null,
            ),
          ),
        ),
      ),
    );

    expect(find.text('[TEST] 종신보험'), findsOneWidget);
    expect(find.text('85,000원'), findsOneWidget);
    expect(find.text('청약'), findsOneWidget);
    expect(find.text('정상'), findsOneWidget);
  });
}
