import 'dart:async';

import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/api/plain_dio.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/auth/session_models.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/push/device_token_registration.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _onGoogleSignIn() async {
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      if (!AppConfig.hasApiBase) {
        setState(() {
          _error = 'BOA_API_BASE_URL 이 비어 있습니다. --dart-define 으로 API 베이스 URL을 지정하세요.';
        });
        return;
      }
      if (!AppConfig.hasGoogleServerClientId) {
        setState(() {
          _error = 'BOA_GOOGLE_SERVER_CLIENT_ID 가 필요합니다. (서버 GOOGLE_CLIENT_ID 와 동일한 웹 클라이언트 ID)';
        });
        return;
      }

      final google = GoogleSignIn(
        scopes: const ['email', 'profile'],
        serverClientId: AppConfig.googleServerClientId,
      );

      final account = await google.signIn();
      if (account == null) {
        return;
      }

      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null || idToken.isEmpty) {
        setState(() {
          _error = 'Google id_token 을 받지 못했습니다. serverClientId 설정을 확인하세요.';
        });
        return;
      }

      final plain = createPlainDio();
      final res = await plain.post<Map<String, dynamic>>(
        '/api/mobile/auth/google',
        data: <String, dynamic>{'idToken': idToken},
      );

      final data = res.data;
      final token = data?['sessionToken'] as String?;
      final userJson = data?['user'] as Map<String, dynamic>?;
      if (token == null || token.isEmpty || userJson == null) {
        setState(() {
          _error = '서버 응답이 올바르지 않습니다.';
        });
        return;
      }

      final user = SessionUser.fromJson(userJson);
      if (!user.isActive) {
        setState(() {
          _error = '비활성 계정입니다.';
        });
        return;
      }

      await ref.read(sessionProvider.notifier).signInFromServer(token, user);
      if (!mounted) return;
      unawaited(registerDeviceTokenWithRetry(ref.read(dioProvider)));
    } on DioException catch (e) {
      final body = e.response?.data;
      String msg = '로그인에 실패했습니다.';
      if (body is Map && body['error'] != null) {
        msg = '${body['error']}';
      } else if (e.message != null) {
        msg = e.message!;
      }
      setState(() => _error = msg);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 48),
              Text('BOA 지점관리', style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text(
                'Android 전용 앱',
                style: theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              if (_error != null) ...[
                const SizedBox(height: 24),
                Material(
                  color: theme.colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(_error!, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onErrorContainer)),
                  ),
                ),
              ],
              const Spacer(),
              FilledButton(
                onPressed: _busy ? null : _onGoogleSignIn,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                child: _busy
                    ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Google로 로그인'),
              ),
              const SizedBox(height: 12),
              Text(
                '웹 CRM과 동일하게 사전 등록된 계정만 로그인할 수 있습니다.',
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}
