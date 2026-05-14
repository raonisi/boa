import 'package:boa/app.dart';
import 'package:boa/core/push/firebase_bootstrap.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await FirebaseBootstrap.init();
  runApp(const ProviderScope(child: BoaApp()));
}
