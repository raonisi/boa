import 'package:boa/core/api/plain_dio.dart';
import 'package:boa/core/auth/session_models.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _kSessionTokenKey = 'boa_session_jwt';

final sessionProvider = NotifierProvider<SessionNotifier, SessionState?>(SessionNotifier.new);

class SessionNotifier extends Notifier<SessionState?> {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  @override
  SessionState? build() => null;

  /// 스플래시에서 호출: 저장된 JWT로 `/me` 검증 후 상태 복원.
  Future<void> restoreSession() async {
    if (!AppConfig.hasApiBase) {
      state = null;
      return;
    }
    final token = await _storage.read(key: _kSessionTokenKey);
    if (token == null || token.isEmpty) {
      state = null;
      return;
    }
    try {
      final dio = createPlainDio();
      final res = await dio.get<Map<String, dynamic>>(
        '/api/mobile/auth/me',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      final data = res.data;
      final userJson = data?['user'] as Map<String, dynamic>?;
      if (userJson == null) {
        throw StateError('missing user');
      }
      final user = SessionUser.fromJson(userJson);
      if (!user.isActive) {
        throw StateError('inactive');
      }
      state = SessionState(sessionToken: token, user: user);
    } catch (_) {
      await _storage.delete(key: _kSessionTokenKey);
      state = null;
    }
  }

  Future<void> signInFromServer(String sessionToken, SessionUser user) async {
    await _storage.write(key: _kSessionTokenKey, value: sessionToken);
    state = SessionState(sessionToken: sessionToken, user: user);
  }

  Future<void> signOut() async {
    state = null;
    await _storage.delete(key: _kSessionTokenKey);
  }
}
