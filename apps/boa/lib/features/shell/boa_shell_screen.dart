import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/auth/session_models.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/push/device_token_registration.dart';
import 'package:boa/features/calendar/calendar_tab.dart';
import 'package:boa/features/contracts/contracts_tab.dart';
import 'package:boa/features/customers/customers_tab.dart';
import 'package:boa/features/home/home_tab.dart';
import 'package:boa/features/more/goals_screen.dart';
import 'package:boa/features/more/performance_screen.dart';
import 'package:boa/features/more/push_preferences_screen.dart';
import 'package:boa/features/notifications/notifications_tab.dart';
import 'package:boa/features/search/global_search_screen.dart';
import 'package:boa/features/shell/shell_tab_provider.dart';
import 'package:boa/features/web/crm_web_portal_paths.dart';
import 'package:boa/features/web/crm_web_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 하단 내비 + `NavigationDrawer` — 모바일 업무 패턴.
class BoaShellScreen extends ConsumerStatefulWidget {
  const BoaShellScreen({super.key});

  @override
  ConsumerState<BoaShellScreen> createState() => _BoaShellScreenState();
}

class _BoaShellScreenState extends ConsumerState<BoaShellScreen> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  static const _tabs = <Widget>[
    HomeTab(),
    CustomersTab(),
    ContractsTab(),
    CalendarTab(),
    NotificationsTab(),
  ];

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final role = session?.user.role;
    final tabIndex = ref.watch(shellTabIndexProvider);

    return Scaffold(
      key: _scaffoldKey,
      appBar: AppBar(
        title: Text(switch (tabIndex) {
          0 => '대시보드',
          1 => '고객 DB',
          2 => '계약',
          3 => '일정',
          _ => '알림',
        }),
        actions: [
          IconButton(
            tooltip: '고객 검색',
            icon: const Icon(Icons.search),
            onPressed: () => openGlobalSearch(context),
          ),
          IconButton(
            tooltip: '더보기 메뉴',
            icon: const Icon(Icons.menu),
            onPressed: () => _scaffoldKey.currentState?.openEndDrawer(),
          ),
        ],
      ),
      endDrawer: _MoreDrawer(
        role: role,
        onSelectShellTab: (i) {
          Navigator.of(context).pop();
          ref.read(shellTabIndexProvider.notifier).state = i;
        },
        onNavigate: (routeKey, title) {
          Navigator.of(context).pop();
          switch (routeKey) {
            case 'performance':
              Navigator.of(context).push<void>(MaterialPageRoute<void>(
                  builder: (_) => const PerformanceScreen()));
              return;
            case 'goals':
              Navigator.of(context).push<void>(
                  MaterialPageRoute<void>(builder: (_) => const GoalsScreen()));
              return;
            case 'push_settings':
              Navigator.of(context).push<void>(MaterialPageRoute<void>(
                  builder: (_) => const PushPreferencesScreen()));
              return;
            case 'contracts_tab':
              ref.read(shellTabIndexProvider.notifier).state = 2;
              return;
            default:
              final webPath = crmWebPathForRouteKey(routeKey);
              if (webPath == null) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('$title — 앱에서 아직 연결되지 않은 메뉴입니다.')),
                );
                return;
              }
              if (!AppConfig.hasWebPortalBase) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                      content: Text(
                          '웹 주소를 알 수 없습니다. BOA_API_BASE_URL 또는 BOA_WEB_BASE_URL 을 설정하세요.')),
                );
                return;
              }
              if (session == null) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('로그인이 필요합니다. 다시 로그인해 주세요.')),
                );
                return;
              }
              Navigator.of(context).push<void>(
                MaterialPageRoute<void>(
                  builder: (_) => CrmWebScreen(
                    title: title,
                    path: webPath,
                    sessionToken: session.sessionToken,
                  ),
                ),
              );
          }
        },
        onSignOut: () {
          Navigator.of(context).pop();
          unbindFcmTokenRefresh();
          ref.read(sessionProvider.notifier).signOut();
        },
      ),
      body: IndexedStack(index: tabIndex, children: _tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tabIndex,
        onDestinationSelected: (i) =>
            ref.read(shellTabIndexProvider.notifier).state = i,
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home),
              label: '홈'),
          NavigationDestination(
              icon: Icon(Icons.people_outline),
              selectedIcon: Icon(Icons.people),
              label: '고객'),
          NavigationDestination(
              icon: Icon(Icons.description_outlined),
              selectedIcon: Icon(Icons.description),
              label: '계약'),
          NavigationDestination(
              icon: Icon(Icons.calendar_today_outlined),
              selectedIcon: Icon(Icons.calendar_today),
              label: '일정'),
          NavigationDestination(
              icon: Icon(Icons.notifications_outlined),
              selectedIcon: Icon(Icons.notifications),
              label: '알림'),
        ],
      ),
    );
  }
}

class _MoreDrawer extends StatelessWidget {
  const _MoreDrawer({
    required this.role,
    required this.onNavigate,
    required this.onSelectShellTab,
    required this.onSignOut,
  });

  final BoaRole? role;
  final void Function(String routeKey, String title) onNavigate;
  final void Function(int tabIndex) onSelectShellTab;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isAdmin = role?.isAdmin ?? false;
    final isManager = role?.isManager ?? false;

    return NavigationDrawer(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
          child: Text('빠른 이동',
              style: theme.textTheme.titleSmall
                  ?.copyWith(color: theme.colorScheme.primary)),
        ),
        ListTile(
            leading: const Icon(Icons.home_outlined),
            title: const Text('홈'),
            onTap: () => onSelectShellTab(0)),
        ListTile(
            leading: const Icon(Icons.people_outline),
            title: const Text('고객 DB'),
            onTap: () => onSelectShellTab(1)),
        ListTile(
            leading: const Icon(Icons.calendar_today_outlined),
            title: const Text('일정'),
            onTap: () => onSelectShellTab(3)),
        ListTile(
            leading: const Icon(Icons.notifications_outlined),
            title: const Text('알림'),
            onTap: () => onSelectShellTab(4)),
        const Divider(),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
          child: Text('업무',
              style: theme.textTheme.titleSmall
                  ?.copyWith(color: theme.colorScheme.primary)),
        ),
        _tile(Icons.view_kanban_outlined, '세일즈 파이프라인', 'pipeline',
            () => onNavigate('pipeline', '세일즈 파이프라인')),
        if (isManager)
          _tile(Icons.analytics_outlined, '영업 분석', 'sales_analytics',
              () => onNavigate('sales_analytics', '영업 분석')),
        _tile(Icons.description_outlined, '계약관리', 'contracts_tab',
            () => onNavigate('contracts_tab', '계약관리')),
        _tile(Icons.bar_chart_outlined, '실적관리', 'performance',
            () => onNavigate('performance', '실적관리')),
        _tile(Icons.flag_outlined, '목표관리', 'goals',
            () => onNavigate('goals', '목표관리')),
        _tile(Icons.cloud_upload_outlined, '고객 일괄 등록', 'bulk_import',
            () => onNavigate('bulk_import', '고객 일괄 등록')),
        if (isManager)
          _tile(Icons.assignment_ind_outlined, 'DB 배정', 'db_assign',
              () => onNavigate('db_assign', 'DB 배정')),
        if (isManager) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
            child: Text('조직·기록',
                style: theme.textTheme.titleSmall
                    ?.copyWith(color: theme.colorScheme.primary)),
          ),
          _tile(Icons.account_tree_outlined, '조직 구조', 'org',
              () => onNavigate('org', '조직 구조')),
          _tile(Icons.history_edu_outlined, '활동 로그', 'activity_log',
              () => onNavigate('activity_log', '활동 로그')),
        ],
        if (isAdmin) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
            child: Text('지점장 전용',
                style: theme.textTheme.titleSmall
                    ?.copyWith(color: theme.colorScheme.primary)),
          ),
          _tile(Icons.history, '업로드 이력 관리', 'upload_history',
              () => onNavigate('upload_history', '업로드 이력 관리')),
          _tile(Icons.merge_type_outlined, '중복 고객 관리', 'dup_customers',
              () => onNavigate('dup_customers', '중복 고객 관리')),
          _tile(Icons.manage_accounts_outlined, '사용자 관리', 'users',
              () => onNavigate('users', '사용자 관리')),
          _tile(Icons.swap_horiz, '인수인계 관리', 'handover',
              () => onNavigate('handover', '인수인계 관리')),
          _tile(Icons.groups_outlined, '팀 관리', 'teams',
              () => onNavigate('teams', '팀 관리')),
          _tile(Icons.shield_outlined, '운영 리스크 센터', 'ops',
              () => onNavigate('ops', '운영 리스크 센터')),
          _tile(Icons.campaign_outlined, '푸시 알림 운영', 'push_ops',
              () => onNavigate('push_ops', '푸시 알림 운영')),
          _tile(Icons.restore_from_trash_outlined, '삭제 데이터 관리', 'deleted',
              () => onNavigate('deleted', '삭제 데이터 관리')),
          _tile(Icons.download_outlined, '데이터 다운로드', 'download',
              () => onNavigate('download', '데이터 다운로드')),
          _tile(Icons.build_outlined, '상담 도구 관리', 'tools',
              () => onNavigate('tools', '상담 도구 관리')),
          _tile(Icons.settings_outlined, '설정 관리', 'settings_admin',
              () => onNavigate('settings_admin', '설정 관리')),
        ],
        const Divider(),
        ListTile(
          leading: const Icon(Icons.notifications_active_outlined),
          title: const Text('앱 알림 설정'),
          onTap: () => onNavigate('push_settings', '앱 알림 설정'),
        ),
        ListTile(
          leading: const Icon(Icons.logout),
          title: const Text('로그아웃'),
          onTap: onSignOut,
        ),
      ],
    );
  }

  Widget _tile(
      IconData icon, String title, String routeKey, VoidCallback onTap) {
    return ListTile(leading: Icon(icon), title: Text(title), onTap: onTap);
  }
}
