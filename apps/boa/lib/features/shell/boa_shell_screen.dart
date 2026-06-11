import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/auth/session_models.dart';
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
import 'package:boa/features/web/crm_web_navigation.dart';
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
          0 => '오늘 업무',
          1 => '고객',
          2 => '계약',
          3 => '일정',
          _ => '알림',
        }),
        actions: [
          IconButton(
            tooltip: '통합 검색',
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
              openCrmWebRoute(context, ref, routeKey: routeKey);
          }
        },
        onSignOut: () {
          Navigator.of(context).pop();
          unbindFcmTokenRefresh();
          ref.read(sessionProvider.notifier).signOut();
        },
      ),
      body: IndexedStack(index: tabIndex, children: _tabs),
      bottomNavigationBar: SafeArea(
        top: false,
        child: DecoratedBox(
        decoration: const BoxDecoration(
          color: BoaColors.card,
          border: Border(top: BorderSide(color: BoaColors.border)),
        ),
        child: NavigationBar(
        selectedIndex: tabIndex,
        onDestinationSelected: (i) {
          if (i == tabIndex) return;
          boaSelectionHaptic();
          ref.read(shellTabIndexProvider.notifier).state = i;
        },
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
        ),
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
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'BOA 지점관리',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: BoaColors.navy,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '현장 업무 메뉴',
                style: theme.textTheme.bodySmall?.copyWith(color: BoaColors.textSecondary),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 8),
          child: Text('빠른 이동',
              style: theme.textTheme.titleSmall
                  ?.copyWith(color: BoaColors.deepGreen, fontWeight: FontWeight.w600)),
        ),
        ListTile(
            leading: const Icon(Icons.home_outlined),
            title: const Text('홈'),
            onTap: () => onSelectShellTab(0)),
        ListTile(
            leading: const Icon(Icons.people_outline),
            title: const Text('고객'),
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
                  ?.copyWith(color: BoaColors.deepGreen, fontWeight: FontWeight.w600)),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
          child: Text('웹 보조 · 관리자',
              style: theme.textTheme.titleSmall
                  ?.copyWith(color: BoaColors.deepGreen, fontWeight: FontWeight.w600)),
        ),
        buildCrmWebDrawerTile(
          routeKey: 'pipeline',
          onTap: () => onNavigate('pipeline', '세일즈 파이프라인'),
        ),
        if (isManager)
          buildCrmWebDrawerTile(
            routeKey: 'sales_analytics',
            onTap: () => onNavigate('sales_analytics', '영업 분석'),
          ),
        _tile(Icons.description_outlined, '계약관리', 'contracts_tab',
            () => onNavigate('contracts_tab', '계약관리')),
        _tile(Icons.bar_chart_outlined, '실적관리', 'performance',
            () => onNavigate('performance', '실적관리')),
        _tile(Icons.flag_outlined, '목표관리', 'goals',
            () => onNavigate('goals', '목표관리')),
        buildCrmWebDrawerTile(
          routeKey: 'bulk_import',
          onTap: () => onNavigate('bulk_import', '고객 일괄 등록'),
        ),
        if (isManager)
          buildCrmWebDrawerTile(
            routeKey: 'db_assign',
            onTap: () => onNavigate('db_assign', 'DB 배정'),
          ),
        if (isManager) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
            child: Text('조직 · 운영 로그',
                style: theme.textTheme.titleSmall
                    ?.copyWith(color: BoaColors.deepGreen, fontWeight: FontWeight.w600)),
          ),
          buildCrmWebDrawerTile(
            routeKey: 'org',
            onTap: () => onNavigate('org', '조직 구조'),
          ),
          buildCrmWebDrawerTile(
            routeKey: 'activity_log',
            onTap: () => onNavigate('activity_log', '활동 로그'),
          ),
        ],
        if (isAdmin) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
            child: Text('지점장 · 고위험 업무',
                style: theme.textTheme.titleSmall
                    ?.copyWith(color: BoaColors.deepGreen, fontWeight: FontWeight.w600)),
          ),
          buildCrmWebDrawerTile(
            routeKey: 'upload_history',
            onTap: () => onNavigate('upload_history', '업로드 이력 관리'),
          ),
          buildCrmWebDrawerTile(
            routeKey: 'dup_customers',
            onTap: () => onNavigate('dup_customers', '중복 고객 관리'),
          ),
          buildCrmWebDrawerTile(
            routeKey: 'users',
            onTap: () => onNavigate('users', '사용자 관리'),
          ),
          buildCrmWebDrawerTile(
            routeKey: 'handover',
            onTap: () => onNavigate('handover', '인수인계 관리'),
          ),
          buildCrmWebDrawerTile(
            routeKey: 'teams',
            onTap: () => onNavigate('teams', '팀 관리'),
          ),
          buildCrmWebDrawerTile(
            routeKey: 'ops',
            onTap: () => onNavigate('ops', '운영 리스크 센터'),
          ),
          buildCrmWebDrawerTile(
            routeKey: 'push_ops',
            onTap: () => onNavigate('push_ops', '푸시 알림 운영'),
          ),
          buildCrmWebDrawerTile(
            routeKey: 'deleted',
            onTap: () => onNavigate('deleted', '삭제 데이터 관리'),
          ),
          buildCrmWebDrawerTile(
            routeKey: 'download',
            onTap: () => onNavigate('download', '데이터 다운로드'),
          ),
          buildCrmWebDrawerTile(
            routeKey: 'tools',
            onTap: () => onNavigate('tools', '상담 도구 관리'),
          ),
          buildCrmWebDrawerTile(
            routeKey: 'settings_admin',
            onTap: () => onNavigate('settings_admin', '설정 관리'),
          ),
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
