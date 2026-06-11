import 'package:flutter/material.dart';

/// Pull-to-Refresh 중복 실행 방지 및 실패 시 한국어 안내.
class BoaPullRefresh {
  BoaPullRefresh._();

  static bool _active = false;

  static const _failureMessage = '새로고침에 실패했습니다. 잠시 후 다시 시도해 주세요.';

  /// [RefreshIndicator.onRefresh]용 — 중복 요청을 무시하고 실패 시 Snackbar 표시.
  static Future<void> run(BuildContext context, Future<void> Function() action) async {
    if (_active) return;
    _active = true;
    try {
      await action();
    } catch (_) {
      if (context.mounted) {
        _showFailure(context);
      }
    } finally {
      _active = false;
    }
  }

  /// API 오류를 state.errorMessage로만 반환하는 목록 refresh용.
  static Future<void> runListRefresh(
    BuildContext context,
    Future<void> Function() refresh,
    bool Function() hasError,
  ) {
    return run(context, () async {
      await refresh();
      if (hasError()) throw _BoaPullRefreshFailed();
    });
  }

  /// [FutureProvider] 등 future가 throw할 때 사용.
  static Future<void> runFutureRefresh(
    BuildContext context,
    Future<void> Function() refresh,
  ) {
    return run(context, refresh);
  }

  static void _showFailure(BuildContext context) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text(_failureMessage)),
    );
  }
}

class _BoaPullRefreshFailed implements Exception {}

/// RefreshIndicator가 빈/짧은 콘텐츠에서도 동작하도록 최소 높이 ListView child.
Widget boaRefreshScrollChild({
  required BuildContext context,
  required Widget child,
  double minHeightFactor = 0.65,
}) {
  return LayoutBuilder(
    builder: (context, constraints) {
      final minHeight = constraints.maxHeight.isFinite
          ? constraints.maxHeight
          : MediaQuery.sizeOf(context).height * minHeightFactor;
      return SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: minHeight),
          child: child,
        ),
      );
    },
  );
}
