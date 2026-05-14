import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 스플래시에서 `restoreSession` 완료 후 true. 라우터가 `/sign-in` 또는 `/`로 분기합니다.
final authBootstrapCompleteProvider = StateProvider<bool>((ref) => false);
