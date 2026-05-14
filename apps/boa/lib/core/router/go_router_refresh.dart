import 'package:flutter/foundation.dart';

/// go_router가 세션 변경 시 redirect를 다시 타도록 합니다.
class GoRouterRefresh extends ChangeNotifier {
  void ping() => notifyListeners();
}
