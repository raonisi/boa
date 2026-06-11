import 'package:boa/core/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// 작은 화면·큰 글꼴·시스템 내비게이션 inset 대응.
abstract final class BoaLayout {
  BoaLayout._();

  static bool isCompactWidth(BuildContext context) => MediaQuery.sizeOf(context).width < 360;

  static bool isCompactHeight(BuildContext context) => MediaQuery.sizeOf(context).height < 640;

  static bool isCompact(BuildContext context) => isCompactWidth(context) || isCompactHeight(context);

  static bool isLargeText(BuildContext context) => MediaQuery.textScalerOf(context).scale(14) > 16;

  static double horizontalPadding(BuildContext context) => isCompact(context) ? 16 : 20;

  static EdgeInsets screenHorizontalPadding(BuildContext context) =>
      EdgeInsets.symmetric(horizontal: horizontalPadding(context));

  static double bottomSafeInset(BuildContext context, {double extra = 0}) =>
      MediaQuery.paddingOf(context).bottom + extra;

  static EdgeInsets listPadding(
    BuildContext context, {
    double horizontal = 0,
    double top = 0,
    double extraBottom = 16,
  }) =>
      EdgeInsets.fromLTRB(horizontal, top, horizontal, bottomSafeInset(context, extra: extraBottom));
}

/// Android 시스템 다크모드에서도 밝은 BOA 톤을 유지한다.
Widget boaForceLightSurfaces({required Widget child}) {
  return Theme(
    data: AppTheme.light(),
    child: ColoredBox(
      color: BoaColors.canvas,
      child: child,
    ),
  );
}

/// 가로 overflow 방지용 스크롤 child.
Widget boaHorizontalSafeChild({required Widget child}) {
  return LayoutBuilder(
    builder: (context, constraints) {
      return SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const ClampingScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minWidth: constraints.maxWidth),
          child: child,
        ),
      );
    },
  );
}
