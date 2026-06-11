import 'dart:async';

import 'package:boa/core/widgets/boa_pull_refresh.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('BoaPullRefresh.run shows Korean snackbar on failure', (tester) async {
    var calls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: RefreshIndicator(
              onRefresh: () => BoaPullRefresh.run(context, () async {
                calls++;
                throw Exception('network');
              }),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [SizedBox(height: 800)],
              ),
            ),
          ),
        ),
      ),
    );

    await tester.drag(find.byType(ListView), const Offset(0, 300));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(calls, 1);
    expect(find.text('새로고침에 실패했습니다. 잠시 후 다시 시도해 주세요.'), findsOneWidget);
  });

  testWidgets('BoaPullRefresh.run ignores duplicate refresh while active', (tester) async {
    var calls = 0;
    final completer = Completer<void>();

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: RefreshIndicator(
              onRefresh: () => BoaPullRefresh.run(context, () async {
                calls++;
                await completer.future;
              }),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [SizedBox(height: 800)],
              ),
            ),
          ),
        ),
      ),
    );

    final refresh = BoaPullRefresh.run(
      tester.element(find.byType(RefreshIndicator)),
      () async {
        calls++;
        await completer.future;
      },
    );
    final duplicate = BoaPullRefresh.run(
      tester.element(find.byType(RefreshIndicator)),
      () async {
        calls++;
      },
    );
    await Future<void>.delayed(Duration.zero);
    expect(calls, 1);
    completer.complete();
    await refresh;
    await duplicate;
    expect(calls, 1);
  });

  testWidgets('BoaPullRefresh.runListRefresh throws when hasError is true', (tester) async {
    var failed = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: RefreshIndicator(
              onRefresh: () => BoaPullRefresh.runListRefresh(
                context,
                () async {},
                () => true,
              ).catchError((_) => failed = true),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [SizedBox(height: 800)],
              ),
            ),
          ),
        ),
      ),
    );

    await tester.drag(find.byType(ListView), const Offset(0, 300));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(failed, isFalse);
    expect(find.text('새로고침에 실패했습니다. 잠시 후 다시 시도해 주세요.'), findsOneWidget);
  });

  testWidgets('boaRefreshScrollChild allows pull on short content', (tester) async {
    var refreshed = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: RefreshIndicator(
              onRefresh: () async => refreshed = true,
              child: boaRefreshScrollChild(
                context: context,
                child: const Text('짧은 콘텐츠'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.drag(find.byType(SingleChildScrollView), const Offset(0, 200));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(refreshed, isTrue);
  });
}
