import 'package:boa/features/contracts/contract_agents_provider.dart';
import 'package:boa/features/contracts/contract_create_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('ContractCreateScreen shows customer context and form labels', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          assignableAgentsProvider.overrideWith((ref) async => []),
        ],
        child: const MaterialApp(
          home: ContractCreateScreen(customerId: 7, customerName: '[TEST] Kim'),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('신규 계약 등록'), findsOneWidget);
    expect(find.text('[TEST] Kim'), findsOneWidget);
    expect(find.text('보험사'), findsOneWidget);
    expect(find.text('상품명'), findsOneWidget);
    expect(find.text('월납보험료'), findsOneWidget);
    expect(find.text('저장'), findsOneWidget);
  });

  testWidgets('ContractCreateScreen save disabled while saving', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          assignableAgentsProvider.overrideWith((ref) async => []),
        ],
        child: const MaterialApp(
          home: ContractCreateScreen(customerId: 7, customerName: '[TEST] Kim'),
        ),
      ),
    );
    await tester.pump();

    final saveButton = find.widgetWithText(FilledButton, '저장');
    expect(saveButton, findsOneWidget);
    expect(tester.widget<FilledButton>(saveButton).onPressed, isNotNull);
  });

  testWidgets('ContractCreateScreen validation shows snackbar without customer product', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          assignableAgentsProvider.overrideWith((ref) async => []),
        ],
        child: const MaterialApp(
          home: ContractCreateScreen(customerId: 7, customerName: '[TEST] Kim'),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.widgetWithText(FilledButton, '저장'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('보험사 또는 상품명을 입력해 주세요.'), findsOneWidget);
  });
}
