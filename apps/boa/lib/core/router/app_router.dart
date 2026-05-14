import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/router/go_router_refresh.dart';
import 'package:boa/features/auth/sign_in_screen.dart';
import 'package:boa/features/shell/boa_shell_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final refresh = GoRouterRefresh();
  ref.listen(sessionProvider, (_, __) => refresh.ping());

  return GoRouter(
    initialLocation: '/sign-in',
    refreshListenable: refresh,
    redirect: (context, state) {
      final session = ref.read(sessionProvider);
      final atSignIn = state.matchedLocation == '/sign-in';
      if (session == null && !atSignIn) return '/sign-in';
      if (session != null && atSignIn) return '/';
      return null;
    },
    routes: [
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
