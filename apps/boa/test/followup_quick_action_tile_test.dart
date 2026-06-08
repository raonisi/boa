import 'package:boa/features/followups/followup_quick_action_tile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('FollowUpQuickActionTile renders quick action labels', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: FollowUpQuickActionTile(
              raw: {
                'id': 42,
                'customerId': 7,
                'customerName': '[TEST] Park',
                'reason': '[TEST] 재연락',
                'status': 'scheduled',
                'nextContactDate': '2026-06-08',
              },
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('[TEST] Park'), findsOneWidget);
    expect(find.text('완료'), findsOneWidget);
    expect(find.text('내일로 연기'), findsOneWidget);
    expect(find.text('3일 뒤 연기'), findsOneWidget);
    expect(find.text('고객 보기'), findsOneWidget);
    expect(find.text('상담기록'), findsOneWidget);
    expect(find.text('일정 등록'), findsOneWidget);
  });

  testWidgets('FollowUpQuickActionTile shows overdue badge', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: FollowUpQuickActionTile(
              isOverdue: true,
              customerContextId: 7,
              customerContextName: '[TEST] Kim',
              raw: {
                'id': 43,
                'reason': '[TEST] 연체',
                'status': 'scheduled',
                'nextContactDate': '2026-06-01',
              },
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('연체'), findsOneWidget);
    expect(find.text('고객 보기'), findsNothing);
    expect(find.text('완료'), findsOneWidget);
  });

  testWidgets('BoaWorkActionChip loading disables complete button', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return FollowUpQuickActionTile(
                  raw: {
                    'id': 44,
                    'customerId': 9,
                    'status': 'scheduled',
                    'nextContactDate': '2026-06-08',
                  },
                );
              },
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    final completeFinder = find.widgetWithText(ActionChip, '완료');
    expect(completeFinder, findsOneWidget);
    expect(tester.widget<ActionChip>(completeFinder).onPressed, isNotNull);
  });
}
