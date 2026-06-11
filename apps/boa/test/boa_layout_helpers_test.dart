import 'package:boa/core/widgets/boa_layout_helpers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('BoaLayout adapts horizontal padding on compact width', (tester) async {
    await tester.binding.setSurfaceSize(const Size(320, 640));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    late double padding;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            padding = BoaLayout.horizontalPadding(context);
            return const SizedBox();
          },
        ),
      ),
    );

    expect(padding, 16);
  });

  testWidgets('boaForceLightSurfaces keeps bright canvas background', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.dark(),
        home: boaForceLightSurfaces(
          child: const Scaffold(body: Text('밝은 톤')),
        ),
      ),
    );

    expect(find.text('밝은 톤'), findsOneWidget);
    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
    expect(scaffold.backgroundColor, isNotNull);
  });
}
