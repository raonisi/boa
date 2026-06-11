import 'package:boa/features/calendar/calendar_agenda_provider.dart';
import 'package:boa/features/customers/customer_contracts_provider.dart';
import 'package:boa/features/customers/customer_detail_provider.dart';
import 'package:boa/features/customers/customer_followups_provider.dart';
import 'package:boa/features/customers/customer_schedules_provider.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:boa/features/home/field_recent_contracts_provider.dart';
import 'package:boa/features/more/goals_dashboard_provider.dart';
import 'package:boa/features/more/performance_stats_provider.dart';
import 'package:boa/features/notifications/unread_count_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 후속·일정 quick action 후 관련 provider 일괄 갱신.
void refreshFieldWorkData(WidgetRef ref, {int? customerId}) {
  ref.invalidate(dashboardTodayWorkProvider);
  ref.invalidate(calendarAgendaProvider);
  ref.invalidate(performanceStatsProvider);
  ref.invalidate(goalsDashboardProvider);
  ref.invalidate(fieldRecentContractsProvider);
  ref.invalidate(unreadNotificationCountProvider);
  if (customerId != null) {
    ref.invalidate(customerDetailProvider(customerId));
    ref.invalidate(customerFollowUpsProvider(customerId));
    ref.invalidate(customerContractsProvider(customerId));
    ref.invalidate(customerSchedulesProvider(customerId));
  }
}
