import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/auth/session_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// OAuth 연동 전 스텁. 로그인 성공 후 FCM 등록 파이프라인을 여기서 호출하게 됩니다.
class SignInScreen extends ConsumerWidget {
  const SignInScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
              const Spacer(),
              FilledButton(
                onPressed: () {
                  // TODO: OAuth / 서버 세션으로 교체
                  ref.read(sessionProvider.notifier).signIn(
                        const SessionUser(id: 1, name: '개발 사용자', role: BoaRole.branchAdmin),
                      );
                },
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                child: const Text('로그인 (개발용 스텁)'),
              ),
              const SizedBox(height: 12),
              Text(
                '실제 배포 시 Google OAuth 등 기존 웹과 동일한 인증으로 연결합니다.',
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
