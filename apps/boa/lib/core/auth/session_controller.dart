import 'package:boa/core/auth/session_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final sessionProvider = NotifierProvider<SessionNotifier, SessionUser?>(SessionNotifier.new);

class SessionNotifier extends Notifier<SessionUser?> {
  @override
  SessionUser? build() => null;

  /// TODO: OAuth / 쿠키 세션 완료 시 호출
  void signIn(SessionUser user) => state = user;

  void signOut() => state = null;
}
