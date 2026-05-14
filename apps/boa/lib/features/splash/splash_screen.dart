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
        unawaited(registerDeviceTokenWithRetry(ref.read(dioProvider)));
      }
    } finally {
      if (mounted) {
        ref.read(authBootstrapCompleteProvider.notifier).state = true;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
