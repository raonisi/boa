import 'package:boa/features/home/dashboard_provider.dart';
import 'package:boa/features/home/field_command_center.dart';
import 'package:boa/features/home/field_recent_contracts_provider.dart';
import 'package:boa/features/more/performance_stats_provider.dart';
import 'package:boa/features/notifications/unread_count_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

List<Override> _fieldCommandOverrides() => [
      unreadNotificationCountProvider.overrideWith((ref) async => 0),
      fieldRecentContractsProvider.overrideWith((ref) async => []),
      performanceStatsProvider.overrideWith((ref) async => null),
    ];

DashboardTodayPayload _emptyPayload() => DashboardTodayPayload.fromJson({
      'scope': 'member',
      'cards': {
        'todayScheduleCount': 0,
        'incompleteScheduleCount': 0,
        'pendingNotificationCount': 0,
        'longUnmanagedCustomerCount': 0,
        'monthlyContractCount': 0,
        'monthlyPremiumSum': 0,
        'todayFollowUpCount': 0,
        'overdueFollowUpCount': 0,
      },
      'todaySchedules': [],
      'incompleteSchedules': [],
      'pendingNotifications': [],
      'todayFollowUps': [],
      'overdueFollowUps': [],
      'longUnmanagedCustomers': [],
    });

DashboardTodayPayload _busyPayload() => DashboardTodayPayload.fromJson({
      'scope': 'member',
      'cards': {
        'todayScheduleCount': 2,
        'incompleteScheduleCount': 1,
        'pendingNotificationCount': 1,
        'longUnmanagedCustomerCount': 0,
        'monthlyContractCount': 5,
        'monthlyPremiumSum': 250000,
        'todayFollowUpCount': 1,
        'overdueFollowUpCount': 1,
      },
      'todaySchedules': [
        {'id': 1, 'title': '[TEST] 미팅', 'startTime': '2026-06-08T10:00:00.000Z', 'status': '예정'},
      ],
      'incompleteSchedules': [],
      'pendingNotifications': [
        {'id': 99, 'title': '[TEST] 알림', 'type': 'follow_up'},
      ],
      'todayFollowUps': [
        {
          'id': 20,
          'customerId': 7,
          'customerName': '[TEST] Park',
          'reason': '재연락',
          'status': 'scheduled',
          'nextContactDate': '2026-06-08',
        },
      ],
      'overdueFollowUps': [
        {
          'id': 21,
          'customerId': 8,
          'customerName': '[TEST] Choi',
          'reason': '연체',
          'status': 'scheduled',
          'nextContactDate': '2026-06-01',
        },
      ],
      'longUnmanagedCustomers': [],
    });

void main() {
  testWidgets('FieldCommandCenterView empty state shows hero and empty sections', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: _fieldCommandOverrides(),
        child: MaterialApp(
          home: Scaffold(
            body: FieldCommandCenterView(
              payload: _emptyPayload(),
              userName: '[TEST] Agent',
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('[TEST] Agent님, 오늘의 업무 보드'), findsOneWidget);
    expect(find.text('오늘 예정된 업무가 없습니다'), findsOneWidget);
    expect(find.text('오늘 연락할 고객'), findsOneWidget);
    expect(find.text('오늘 예정된 일정이 없습니다'), findsOneWidget);
    expect(find.text('빠른 등록'), findsOneWidget);
  });

  testWidgets('FieldCommandCenterView shows contact queue and schedule', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: _fieldCommandOverrides(),
        child: MaterialApp(
          home: Scaffold(
            body: FieldCommandCenterView(
              payload: _busyPayload(),
              userName: '[TEST] Agent',
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.textContaining('오늘 처리할 업무'), findsOneWidget);
    expect(find.text('[TEST] Choi'), findsOneWidget);
    expect(find.text('[TEST] Park'), findsOneWidget);
    expect(find.text('[TEST] 미팅'), findsOneWidget);
    expect(find.text('완료'), findsWidgets);
  });
}
