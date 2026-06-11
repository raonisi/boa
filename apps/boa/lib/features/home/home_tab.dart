import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_pull_refresh.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:boa/features/home/field_command_center.dart';
import 'package:boa/features/home/field_recent_contracts_provider.dart';
import 'package:boa/features/more/performance_stats_provider.dart';
import 'package:boa/features/notifications/unread_count_provider.dart';
import 'package:boa/features/work/work_data_refresh.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 홈 탭 — Field Command Center (오늘 실행 업무 보드).
class HomeTab extends ConsumerWidget {
  const HomeTab({super.key});

  Future<void> _refreshDashboard(BuildContext context, WidgetRef ref) {
    return BoaPullRefresh.runFutureRefresh(context, () async {
      refreshFieldWorkData(ref);
      await Future.wait<void>([
        ref.read(dashboardTodayWorkProvider.future),
        ref.read(unreadNotificationCountProvider.future),
        ref.read(performanceStatsProvider.future),
        ref.read(fieldRecentContractsProvider.future),
      ]);
    });
  }

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
      loading: () => RefreshIndicator(
        onRefresh: () => _refreshDashboard(context, ref),
        child: boaRefreshScrollChild(
          context: context,
          child: const BoaListLoadingSkeleton(itemCount: 4),
        ),
      ),
      error: (e, _) => RefreshIndicator(
        onRefresh: () => _refreshDashboard(context, ref),
        child: boaRefreshScrollChild(
          context: context,
          child: BoaErrorState(
            title: '업무 보드를 불러오지 못했습니다',
            message: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
            onRetry: () => _refreshDashboard(context, ref),
          ),
        ),
      ),
    );
  }
}
