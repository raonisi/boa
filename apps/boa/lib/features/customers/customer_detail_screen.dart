import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/features/customers/customer_detail_360.dart';
import 'package:boa/features/customers/customer_detail_provider.dart';
import 'package:boa/features/customers/customers_providers.dart';
import 'package:boa/features/search/recent_customers_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CustomerDetailScreen extends ConsumerWidget {
  const CustomerDetailScreen({super.key, required this.customerId});

  final int customerId;

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

    return Scaffold(
      appBar: AppBar(title: Text(name.isEmpty ? '고객 상세' : name)),
      body: async.when(
        data: (customer) => CustomerDetail360View(customerId: customerId, customer: customer),
        loading: () => Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(),
                const SizedBox(height: 16),
                Text('고객 정보를 불러오는 중입니다…', style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
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
