import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_customer_hero.dart';
import 'package:boa/features/customers/customer_detail_360.dart';
import 'package:boa/features/customers/customer_detail_provider.dart';
import 'package:boa/features/customers/customers_providers.dart';
import 'package:boa/features/search/recent_customers_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Hero 전환과 함께 고객 상세로 이동한다.
void pushCustomerDetailScreen(
  BuildContext context, {
  required int customerId,
  required String heroLane,
  String? displayName,
}) {
  if (customerId <= 0) return;
  Navigator.of(context).push<void>(
    MaterialPageRoute<void>(
      builder: (_) => CustomerDetailScreen(
        customerId: customerId,
        heroLane: heroLane,
        heroDisplayName: displayName,
      ),
    ),
  );
}

class CustomerDetailScreen extends ConsumerWidget {
  const CustomerDetailScreen({
    super.key,
    required this.customerId,
    this.heroLane = BoaCustomerHeroLane.customersList,
    this.heroDisplayName,
  });

  final int customerId;
  final String heroLane;
  final String? heroDisplayName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(customerDetailProvider(customerId));
    ref.listen(customerDetailProvider(customerId), (prev, next) {
      next.whenData((c) {
        final id = c['id'];
        final parsedId = id is int ? id : int.tryParse('$id');
        if (parsedId == null) return;
        recordRecentCustomer(
          ref,
          BoaCustomerRow(
            id: parsedId,
            name: '${c['name'] ?? ''}'.trim().isNotEmpty ? '${c['name']}'.trim() : '(이름 없음)',
            phone: c['phone'] as String?,
            consultStatus: c['consultStatus'] as String?,
            priority: c['priority'] as String?,
            nextAction: c['nextAction'] as String?,
          ),
        );
      });
    });
    final name = async.maybeWhen(data: (c) => '${c['name'] ?? ''}'.trim(), orElse: () => '');
    final titleName = name.isEmpty ? (heroDisplayName?.trim().isNotEmpty == true ? heroDisplayName!.trim() : '고객 상세') : name;

    return Scaffold(
      appBar: AppBar(title: Text(titleName, maxLines: 1, overflow: TextOverflow.ellipsis)),
      body: async.when(
        data: (customer) => CustomerDetail360View(
          customerId: customerId,
          customer: customer,
          heroLane: heroLane,
        ),
        loading: () => CustomerDetailHeroPlaceholder(
          customerId: customerId,
          heroLane: heroLane,
          displayName: heroDisplayName ?? name,
        ),
        error: (e, _) => ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          children: [
            BoaErrorState(
              title: '고객 정보를 불러오지 못했습니다',
              message: '네트워크 상태를 확인한 뒤 잠시 후 다시 시도해 주세요.',
              onRetry: () => ref.invalidate(customerDetailProvider(customerId)),
            ),
          ],
        ),
      ),
    );
  }
}
