import 'package:flutter/material.dart';

/// Material 3 — 웹 레이아웃이 아닌 모바일 터치·가독성 우선.
abstract final class AppTheme {
  static ThemeData light() {
    const seed = Color(0xFF1A237E);
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: seed,
        brightness: Brightness.light,
        primary: const Color(0xFF1A237E),
        surface: const Color(0xFFF9F9F7),
      ),
      appBarTheme: const AppBarTheme(centerTitle: false, scrolledUnderElevation: 0),
      navigationBarTheme: NavigationBarThemeData(
        height: 72,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(size: 26);
          }
          return const IconThemeData(size: 24);
        }),
      ),
      listTileTheme: const ListTileThemeData(
        contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 4),
        minVerticalPadding: 12,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  static ThemeData dark() {
    const seed = Color(0xFF5C6BC0);
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: seed, brightness: Brightness.dark),
      appBarTheme: const AppBarTheme(centerTitle: false, scrolledUnderElevation: 0),
      navigationBarTheme: const NavigationBarThemeData(height: 72),
    );
  }
}
