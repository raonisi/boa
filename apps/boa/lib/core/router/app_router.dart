import 'package:boa/core/auth/auth_bootstrap.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/router/go_router_refresh.dart';
import 'package:boa/features/auth/sign_in_screen.dart';
import 'package:boa/features/shell/boa_shell_screen.dart';
import 'package:boa/features/splash/splash_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final refresh = GoRouterRefresh();
  ref.listen(sessionProvider, (_, __) => refresh.ping());
  ref.listen(authBootstrapCompleteProvider, (_, __) => refresh.ping());

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final boot = ref.read(authBootstrapCompleteProvider);
      final loc = state.matchedLocation;

      if (!boot) {
        return loc == '/splash' ? null : '/splash';
      }

      final session = ref.read(sessionProvider);
      if (session == null) {
        if (loc == '/splash') return '/sign-in';
        if (loc != '/sign-in') return '/sign-in';
        return null;
      }

      if (loc == '/sign-in' || loc == '/splash') return '/';
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/sign-in',
        builder: (context, state) => const SignInScreen(),
      ),
      GoRoute(
        path: '/',
        builder: (context, state) => const BoaShellScreen(),
      ),
    ],
  );
});
