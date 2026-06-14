import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:boa/features/web/crm_web_portal_paths.dart';
import 'package:boa/features/web/crm_web_route_meta.dart';
import 'package:boa/features/web/crm_web_screen.dart';
import 'package:boa/features/web/crm_web_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Drawer·Shell에서 WebView fallback 화면을 연다.
void openCrmWebRoute(
  BuildContext context,
  WidgetRef ref, {
  required String routeKey,
}) {
  final session = ref.read(sessionProvider);
  final meta = crmWebRouteMetaForKey(routeKey);
  final title = meta?.title ?? routeKey;

  if (crmWebPathForRouteKey(routeKey) == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$title — 앱에서 아직 연결되지 않은 메뉴입니다.')),
    );
    return;
  }
  if (!AppConfig.hasWebPortalBase) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('웹 주소를 알 수 없습니다. 앱 설정을 확인하거나 배포 담당자에게 문의해 주세요.'),
      ),
    );
    return;
  }
  if (session == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('로그인이 필요합니다. 다시 로그인해 주세요.')),
    );
    return;
  }

  if (meta?.pcRecommended == true || meta?.highRisk == true) {
    final hint = meta!.highRisk
        ? '${meta.title} — 처리 전 내용을 확인해 주세요.'
        : '${meta.title} — 넓은 화면에서 더 편한 업무입니다.';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(hint), duration: const Duration(seconds: 2)),
    );
  }

  pushCrmWebScreen(
    context,
    CrmWebScreen.fromRouteKey(
      routeKey: routeKey,
      sessionToken: session.sessionToken,
    ),
  );
}

/// Native shell과 자연스럽게 이어지도록 fade 전환으로 WebView 화면을 연다.
Future<void> pushCrmWebScreen(BuildContext context, CrmWebScreen screen) {
  return Navigator.of(context).push<void>(
    PageRouteBuilder<void>(
      pageBuilder: (_, __, ___) => screen,
      transitionsBuilder: (_, animation, __, child) {
        return FadeTransition(
          opacity: CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
          child: child,
        );
      },
      transitionDuration: const Duration(milliseconds: 220),
    ),
  );
}

IconData crmWebDrawerIconForRouteKey(String routeKey) => switch (routeKey) {
      'pipeline' => Icons.view_kanban_outlined,
      'sales_analytics' => Icons.analytics_outlined,
      'bulk_import' => Icons.cloud_upload_outlined,
      'db_assign' => Icons.assignment_ind_outlined,
      'org' => Icons.account_tree_outlined,
      'activity_log' => Icons.history_edu_outlined,
      'upload_history' => Icons.history,
      'dup_customers' => Icons.merge_type_outlined,
      'users' => Icons.manage_accounts_outlined,
      'handover' => Icons.swap_horiz,
      'teams' => Icons.groups_outlined,
      'ops' => Icons.shield_outlined,
      'push_ops' => Icons.campaign_outlined,
      'deleted' => Icons.restore_from_trash_outlined,
      'download' => Icons.download_outlined,
      'tools' => Icons.build_outlined,
      'settings_admin' => Icons.settings_outlined,
      _ => Icons.language_outlined,
    };

Widget buildCrmWebDrawerTile({
  required String routeKey,
  required VoidCallback onTap,
}) {
  final meta = crmWebRouteMetaForKey(routeKey);
  return CrmWebDrawerTile(
    icon: crmWebDrawerIconForRouteKey(routeKey),
    title: meta?.title ?? routeKey,
    subtitle: meta?.drawerSubtitle ?? meta?.subtitle,
    category: meta?.category,
    onTap: onTap,
  );
}
