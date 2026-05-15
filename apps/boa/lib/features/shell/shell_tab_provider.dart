import 'package:flutter_riverpod/flutter_riverpod.dart';

/// `BoaShellScreen` 하단 `NavigationBar` 선택 인덱스 (0 홈 · 1 고객 · 2 계약 · 3 일정 · 4 알림).
final shellTabIndexProvider = StateProvider<int>((ref) => 0);
