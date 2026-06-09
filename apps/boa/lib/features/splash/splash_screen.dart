import 'dart:async';

import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/auth_bootstrap.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/push/device_token_registration.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 부트 시 세션 복원 후 라우터가 `/` 또는 `/sign-in`으로 보냅니다.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  Future<void> _bootstrap() async {
    try {
      await ref.read(sessionProvider.notifier).restoreSession();
      if (!mounted) return;
      final session = ref.read(sessionProvider);
      if (session != null) {
        final dio = ref.read(dioProvider);
        unawaited(registerDeviceTokenWithRetry(dio));
        bindFcmTokenRefresh(dio);
      }
    } finally {
      if (mounted) {
        ref.read(authBootstrapCompleteProvider.notifier).state = true;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: cs.primaryContainer.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Icon(Icons.business_center_outlined, size: 36, color: cs.primary),
                ),
                const SizedBox(height: 20),
                Text(
                  'BOA 지점관리',
                  style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700, color: cs.primary),
                ),
                const SizedBox(height: 6),
                Text(
                  '보험 설계사 현장 업무 CRM',
                  style: theme.textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
                ),
                const SizedBox(height: 36),
                SizedBox(
                  width: 28,
                  height: 28,
                  child: CircularProgressIndicator(strokeWidth: 2.5, color: cs.primary),
                ),
                const SizedBox(height: 12),
                Text(
                  '불러오는 중입니다…',
                  style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
