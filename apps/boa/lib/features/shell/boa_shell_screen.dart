import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/auth/session_models.dart';
import 'package:boa/features/calendar/calendar_tab.dart';
import 'package:boa/features/customers/customers_tab.dart';
import 'package:boa/features/home/home_tab.dart';
import 'package:boa/features/notifications/notifications_tab.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 하단 내비 + `NavigationDrawer` — 모바일 업무 패턴.
class BoaShellScreen extends ConsumerStatefulWidget {
  const BoaShellScreen({super.key});

  @override
  ConsumerState<BoaShellScreen> createState() => _BoaShellScreenState();
}

class _BoaShellScreenState extends ConsumerState<BoaShellScreen> {
  int _index = 0;
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  static const _tabs = <Widget>[
    HomeTab(),
    CustomersTab(),
    CalendarTab(),
    NotificationsTab(),
  ];

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final role = session?.role;

    return Scaffold(
      key: _scaffoldKey,
      appBar: AppBar(
        title: Text(switch (_index) {
          0 => '대시보드',
          1 => '고객 DB',
          2 => '일정',
          _ => '알림',
        }),
        actions: [
          IconButton(
            tooltip: '더보기 메뉴',
            icon: const Icon(Icons.menu),
            onPressed: () => _scaffoldKey.currentState?.openEndDrawer(),
          ),
        ],
      ),
      endDrawer: _MoreDrawer(
        role: role,
        onNavigate: (title) {
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('$title — 준비 중 (웹 기능 이식 예정)')),
          );
        },
        onSignOut: () {
          Navigator.of(context).pop();
          ref.read(sessionProvider.notifier).signOut();
        },
      ),
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: '홈'),
          NavigationDestination(icon: Icon(Icons.people_outline), selectedIcon: Icon(Icons.people), label: '고객'),
          NavigationDestination(icon: Icon(Icons.calendar_today_outlined), selectedIcon: Icon(Icons.calendar_today), label: '일정'),
          NavigationDestination(icon: Icon(Icons.notifications_outlined), selectedIcon: Icon(Icons.notifications), label: '알림'),
        ],
      ),
    );
  }
}

class _MoreDrawer extends StatelessWidget {
  const _MoreDrawer({
    required this.role,
    required this.onNavigate,
    required this.onSignOut,
  });

  final BoaRole? role;
  final void Function(String title) onNavigate;
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
          child: Text('업무', style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary)),
        ),
        _tile(Icons.view_kanban_outlined, '세일즈 파이프라인', () => onNavigate('세일즈 파이프라인')),
        if (isManager) _tile(Icons.analytics_outlined, '영업 분석', () => onNavigate('영업 분석')),
        _tile(Icons.description_outlined, '계약관리', () => onNavigate('계약관리')),
        _tile(Icons.bar_chart_outlined, '실적관리', () => onNavigate('실적관리')),
        _tile(Icons.flag_outlined, '목표관리', () => onNavigate('목표관리')),
        _tile(Icons.cloud_upload_outlined, '고객 일괄 등록', () => onNavigate('고객 일괄 등록')),
        if (isManager) _tile(Icons.assignment_ind_outlined, 'DB 배정', () => onNavigate('DB 배정')),
        if (isManager) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
            child: Text('조직·기록', style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary)),
          ),
          _tile(Icons.account_tree_outlined, '조직 구조', () => onNavigate('조직 구조')),
          _tile(Icons.history_edu_outlined, '활동 로그', () => onNavigate('활동 로그')),
        ],
        if (isAdmin) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
            child: Text('지점장 전용', style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary)),
          ),
          _tile(Icons.history, '업로드 이력 관리', () => onNavigate('업로드 이력 관리')),
          _tile(Icons.merge_type_outlined, '중복 고객 관리', () => onNavigate('중복 고객 관리')),
          _tile(Icons.manage_accounts_outlined, '사용자 관리', () => onNavigate('사용자 관리')),
          _tile(Icons.swap_horiz, '인수인계 관리', () => onNavigate('인수인계 관리')),
          _tile(Icons.groups_outlined, '팀 관리', () => onNavigate('팀 관리')),
          _tile(Icons.shield_outlined, '운영 점검', () => onNavigate('운영 점검')),
          _tile(Icons.campaign_outlined, '푸시 알림 운영', () => onNavigate('푸시 알림 운영')),
          _tile(Icons.restore_from_trash_outlined, '삭제 데이터 관리', () => onNavigate('삭제 데이터 관리')),
          _tile(Icons.download_outlined, '데이터 다운로드', () => onNavigate('데이터 다운로드')),
          _tile(Icons.build_outlined, '상담 도구 관리', () => onNavigate('상담 도구 관리')),
          _tile(Icons.settings_outlined, '설정 관리', () => onNavigate('설정 관리')),
        ],
        const Divider(),
        ListTile(
          leading: const Icon(Icons.notifications_active_outlined),
          title: const Text('앱 알림 설정'),
          onTap: () => onNavigate('앱 알림 설정'),
        ),
        ListTile(
          leading: const Icon(Icons.logout),
          title: const Text('로그아웃'),
          onTap: onSignOut,
        ),
      ],
    );
  }

  Widget _tile(IconData icon, String title, VoidCallback onTap) {
    return ListTile(leading: Icon(icon), title: Text(title), onTap: onTap);
  }
}
