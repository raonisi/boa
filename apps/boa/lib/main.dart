import 'package:boa/app.dart';
import 'package:boa/firebase_options.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e, st) {
    if (kDebugMode) {
      debugPrint('[Firebase] init failed: $e');
      debugPrintStack(stackTrace: st);
    }
  }

  runApp(const ProviderScope(child: BoaApp()));
}
