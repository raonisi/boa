import 'package:flutter/material.dart';

/// BOA 모바일 — 밝은 프리미엄 SaaS 팔레트.
abstract final class BoaColors {
  static const canvas = Color(0xFFF7F8FA);
  static const ivory = Color(0xFFFAF7F0);
  static const card = Color(0xFFFFFFFF);
  static const navy = Color(0xFF0A2540);
  static const deepGreen = Color(0xFF12372A);
  static const gold = Color(0xFFB08D57);
  static const textPrimary = Color(0xFF111827);
  static const textSecondary = Color(0xFF6B7280);
  static const border = Color(0xFFE5E7EB);
  static const borderLight = Color(0xFFF0F1F3);
  static const urgent = Color(0xFFC62828);
  static const urgentBg = Color(0xFFFFEBEE);
  static const todayAccent = Color(0xFFE65100);
  static const todayBg = Color(0xFFFFF3E0);
}

/// 사용자 화면용 시간대 표시.
String boaTimezoneLabelKo(String? timezone) {
  final value = (timezone ?? '').trim();
  if (value.isEmpty || value == 'Asia/Seoul') return '한국 표준시';
  return value;
}

/// Material 3 — 보험 지점관리 CRM 모바일. 밝고 세련된 프리미엄 SaaS 톤.
abstract final class AppTheme {
  static ThemeData light() {
    const scheme = ColorScheme(
      brightness: Brightness.light,
      primary: BoaColors.navy,
      onPrimary: Colors.white,
      primaryContainer: Color(0xFFE8EEF4),
      onPrimaryContainer: BoaColors.navy,
      secondary: BoaColors.deepGreen,
      onSecondary: Colors.white,
      secondaryContainer: Color(0xFFE8F0EC),
      onSecondaryContainer: BoaColors.deepGreen,
      tertiary: BoaColors.gold,
      onTertiary: Colors.white,
      tertiaryContainer: Color(0xFFF5EFE6),
      onTertiaryContainer: Color(0xFF6B5A3E),
      error: Color(0xFFB3261E),
      onError: Colors.white,
      errorContainer: Color(0xFFFCE8E6),
      onErrorContainer: Color(0xFF8C1D18),
      surface: BoaColors.card,
      onSurface: BoaColors.textPrimary,
      onSurfaceVariant: BoaColors.textSecondary,
      outline: BoaColors.border,
      outlineVariant: BoaColors.borderLight,
      shadow: Color(0x140A2540),
      surfaceTint: BoaColors.navy,
      inverseSurface: BoaColors.navy,
      onInverseSurface: Colors.white,
      inversePrimary: Color(0xFF9BB4D0),
      surfaceContainerHighest: Color(0xFFF0F2F5),
      surfaceContainerHigh: Color(0xFFF4F5F7),
      surfaceContainer: Color(0xFFF7F8FA),
      surfaceContainerLow: Color(0xFFFAFBFC),
      surfaceContainerLowest: BoaColors.card,
      surfaceBright: BoaColors.card,
      surfaceDim: Color(0xFFF0F2F5),
    );

    return _base(scheme).copyWith(
      scaffoldBackgroundColor: BoaColors.canvas,
      cardTheme: CardThemeData(
        elevation: 0,
        color: BoaColors.card,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: BoaColors.border),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: BoaColors.navy,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: BoaColors.navy,
          minimumSize: const Size.fromHeight(44),
          side: const BorderSide(color: BoaColors.border),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: BoaColors.deepGreen,
        foregroundColor: Colors.white,
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: BoaColors.navy,
        contentTextStyle: const TextStyle(color: Colors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: BoaColors.ivory,
        side: const BorderSide(color: BoaColors.border),
        labelStyle: const TextStyle(color: BoaColors.textPrimary, fontSize: 13),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  /// 시스템 다크 모드에서도 밝은 톤을 유지합니다.
  static ThemeData dark() => light();

  static ThemeData _base(ColorScheme scheme) {
    final textTheme = TextTheme(
      headlineMedium: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: BoaColors.textPrimary, height: 1.2),
      headlineSmall: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: BoaColors.textPrimary, height: 1.25),
      titleLarge: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: BoaColors.textPrimary, height: 1.3),
      titleMedium: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: BoaColors.textPrimary, height: 1.35),
      titleSmall: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: BoaColors.textPrimary, height: 1.35),
      bodyLarge: const TextStyle(fontSize: 16, fontWeight: FontWeight.w400, color: BoaColors.textPrimary, height: 1.45),
      bodyMedium: const TextStyle(fontSize: 14, fontWeight: FontWeight.w400, color: BoaColors.textPrimary, height: 1.45),
      bodySmall: const TextStyle(fontSize: 13, fontWeight: FontWeight.w400, color: BoaColors.textSecondary, height: 1.4),
      labelLarge: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: BoaColors.textPrimary),
      labelMedium: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: BoaColors.textSecondary),
      labelSmall: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: BoaColors.textSecondary),
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        scrolledUnderElevation: 0,
        elevation: 0,
        backgroundColor: BoaColors.card,
        foregroundColor: BoaColors.textPrimary,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: textTheme.titleMedium,
        iconTheme: const IconThemeData(color: BoaColors.navy),
        actionsIconTheme: const IconThemeData(color: BoaColors.navy),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 68,
        elevation: 0,
        backgroundColor: BoaColors.card,
        surfaceTintColor: Colors.transparent,
        indicatorColor: scheme.primaryContainer,
        shadowColor: scheme.shadow,
        overlayColor: WidgetStateProperty.all(Colors.transparent),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 11,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? BoaColors.navy : BoaColors.textSecondary,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(size: 24, color: BoaColors.navy);
          }
          return const IconThemeData(size: 22, color: BoaColors.textSecondary);
        }),
      ),
      navigationDrawerTheme: const NavigationDrawerThemeData(
        backgroundColor: BoaColors.card,
        surfaceTintColor: Colors.transparent,
        indicatorColor: Color(0xFFE8EEF4),
      ),
      listTileTheme: const ListTileThemeData(
        contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 2),
        minVerticalPadding: 10,
        iconColor: BoaColors.navy,
        textColor: BoaColors.textPrimary,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: BoaColors.card,
        hintStyle: const TextStyle(color: BoaColors.textSecondary),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: BoaColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: BoaColors.navy, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
      dividerTheme: const DividerThemeData(
        color: BoaColors.border,
        space: 1,
        thickness: 1,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: BoaColors.navy),
    );
  }
}
