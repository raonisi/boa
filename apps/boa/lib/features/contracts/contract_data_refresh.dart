import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:boa/features/customers/customer_contracts_provider.dart';
import 'package:boa/features/customers/customer_detail_provider.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:boa/features/home/field_recent_contracts_provider.dart';
import 'package:boa/features/more/performance_stats_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 계약 등록·수정 후 관련 provider 일괄 갱신 (성과 계산 로직은 변경하지 않음).
Future<void> refreshContractData(WidgetRef ref, {int? customerId}) async {
  ref.invalidate(dashboardTodayWorkProvider);
  ref.invalidate(fieldRecentContractsProvider);
  ref.invalidate(performanceStatsProvider);
  ref.invalidate(contractsListNotifierProvider);
  if (customerId != null) {
    ref.invalidate(customerDetailProvider(customerId));
    ref.invalidate(customerContractsProvider(customerId));
  }
  await ref.read(contractsListNotifierProvider.notifier).refresh();
}
