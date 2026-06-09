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
          _error = '서버 연결이 설정되지 않았습니다. 배포 담당자에게 문의해 주세요.';
        });
        return;
      }
      if (!AppConfig.hasGoogleServerClientId) {
        setState(() {
          _error = '로그인 설정이 완료되지 않았습니다. 배포 담당자에게 문의해 주세요.';
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
          _error = 'Google 계정 인증에 실패했습니다. 잠시 후 다시 시도해 주세요.';
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
          _error = '서버 응답이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.';
        });
        return;
      }

      final user = SessionUser.fromJson(userJson);
      if (!user.isActive) {
        setState(() {
          _error = '비활성 계정입니다. 관리자에게 문의해 주세요.';
        });
        return;
      }

      await ref.read(sessionProvider.notifier).signInFromServer(token, user);
      if (!mounted) return;
      final dio = ref.read(dioProvider);
      unawaited(registerDeviceTokenWithRetry(dio));
      bindFcmTokenRefresh(dio);
    } on DioException catch (e) {
      final body = e.response?.data;
      String msg = '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.';
      if (body is Map && body['error'] != null) {
        msg = '${body['error']}';
      } else if (e.message != null) {
        msg = e.message!;
      }
      setState(() => _error = msg);
    } catch (e) {
      setState(() => _error = '로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 56),
              Center(
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: cs.primaryContainer.withValues(alpha: 0.45),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Icon(Icons.business_center_outlined, size: 40, color: cs.primary),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'BOA 지점관리',
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700, color: cs.primary),
              ),
              const SizedBox(height: 8),
              Text(
                '보험 설계사·지점 실무용 모바일 CRM',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyLarge?.copyWith(color: cs.onSurfaceVariant),
              ),
              if (_error != null) ...[
                const SizedBox(height: 28),
                Material(
                  color: cs.errorContainer,
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.info_outline, size: 20, color: cs.onErrorContainer),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _error!,
                            style: theme.textTheme.bodyMedium?.copyWith(color: cs.onErrorContainer),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              const Spacer(),
              FilledButton.icon(
                onPressed: _busy ? null : _onGoogleSignIn,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                icon: _busy
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.login),
                label: Text(_busy ? '로그인 중…' : 'Google 계정으로 로그인'),
              ),
              const SizedBox(height: 14),
              Text(
                '사전 등록된 계정만 로그인할 수 있습니다.',
                style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 36),
            ],
          ),
        ),
      ),
    );
  }
}
