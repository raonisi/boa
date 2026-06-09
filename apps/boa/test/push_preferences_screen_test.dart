import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/auth/session_models.dart';
import 'package:boa/features/more/push_preferences_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _NoSessionNotifier extends SessionNotifier {
  @override
  SessionState? build() => null;
}

void main() {
  testWidgets('PushPreferencesScreen shows retry when session is missing', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(_NoSessionNotifier.new),
        ],
        child: const MaterialApp(home: PushPreferencesScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.textContaining('불러오지 못했습니다'), findsOneWidget);
    expect(find.text('다시 시도'), findsOneWidget);
    expect(find.text('업무 푸시 알림 전체'), findsNothing);
  });
}
