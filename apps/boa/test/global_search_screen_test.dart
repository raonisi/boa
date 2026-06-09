import 'package:boa/features/search/global_search_screen.dart';
import 'package:boa/features/search/recent_customers_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('GlobalSearchScreen shows search field and quick actions strip', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(home: GlobalSearchScreen()),
      ),
    );
    await tester.pump();

    expect(find.text('통합 검색'), findsOneWidget);
    expect(find.text('고객명, 연락처 일부, 계약 정보를 검색하세요'), findsOneWidget);
    expect(find.text('검색어를 입력해 주세요'), findsWidgets);
    expect(find.text('빠른 실행'), findsOneWidget);
    expect(find.text('고객 등록'), findsOneWidget);
    expect(find.text('상담 기록'), findsOneWidget);
    expect(find.text('후속 등록'), findsOneWidget);
  });

  testWidgets('GlobalSearchScreen shows recent customers when idle', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          recentCustomersProvider.overrideWith((ref) => RecentCustomersNotifier()
            ..recordEntry(
              const RecentCustomerEntry(
                id: 7,
                name: '[TEST] Kim',
                consultStatus: '상담예정',
              ),
            )),
        ],
        child: const MaterialApp(home: GlobalSearchScreen()),
      ),
    );
    await tester.pump();

    expect(find.text('최근 고객'), findsOneWidget);
    expect(find.text('[TEST] Kim'), findsOneWidget);
  });

  testWidgets('GlobalSearchScreen clear button resets query', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(home: GlobalSearchScreen(initialQuery: '[TEST]')),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('[TEST]'), findsOneWidget);

    await tester.tap(find.byTooltip('지우기'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('[TEST]'), findsNothing);
  });
}
