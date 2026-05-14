import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// `google-services.json` + 네이티브 설정 전에는 초기화를 건너뜁니다.
/// `flutterfire configure` 후 `firebase_options.dart`를 연결하세요.
abstract final class FirebaseBootstrap {
  static Future<void> init() async {
    try {
      await Firebase.initializeApp();
    } catch (e, st) {
      if (kDebugMode) {
        debugPrint('[Firebase] init skipped or failed: $e');
        debugPrintStack(stackTrace: st);
      }
    }
  }
}
