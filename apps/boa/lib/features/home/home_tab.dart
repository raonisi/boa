import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:boa/features/home/field_command_center.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 홈 탭 — Field Command Center (오늘 실행 업무 보드).
class HomeTab extends ConsumerWidget {
  const HomeTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);

    if (!AppConfig.hasApiBase) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [BoaServerConfigHint()],
      );
    }

    final async = ref.watch(dashboardTodayWorkProvider);

    return async.when(
      data: (payload) => FieldCommandCenterView(
        payload: payload,
        userName: session?.user.name,
      ),
      loading: () => const BoaListLoadingSkeleton(itemCount: 4),
      error: (e, _) => ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          BoaErrorState(
            title: '업무 보드를 불러오지 못했습니다',
            message: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
            onRetry: () => invalidateFieldCommandData(ref),
          ),
        ],
      ),
    );
  }
}
