import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('BoaEmptyState shows title and optional action', (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BoaEmptyState(
            title: '아직 등록된 고객이 없습니다.',
            message: '검색어를 바꿔 보세요.',
            actionLabel: '새로고침',
            onAction: () => tapped = true,
          ),
        ),
      ),
    );

    expect(find.text('아직 등록된 고객이 없습니다.'), findsOneWidget);
    await tester.tap(find.text('새로고침'));
    await tester.pump();
    expect(tapped, isTrue);
  });

  testWidgets('BoaListLoadingSkeleton renders placeholder cards', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: BoaListLoadingSkeleton(itemCount: 2)),
      ),
    );
    expect(find.byType(Card), findsNWidgets(2));
  });
}
