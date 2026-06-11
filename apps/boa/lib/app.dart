import 'package:boa/core/router/app_router.dart';
import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/core/widgets/boa_layout_helpers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class BoaApp extends ConsumerWidget {
  const BoaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'BOA 지점관리',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.light,
      builder: (context, child) => boaForceLightSurfaces(
        child: child ?? const SizedBox.shrink(),
      ),
      routerConfig: router,
    );
  }
}
