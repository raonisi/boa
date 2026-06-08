import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/features/customers/customer_detail_360.dart';
import 'package:boa/features/customers/customer_detail_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CustomerDetailScreen extends ConsumerWidget {
  const CustomerDetailScreen({super.key, required this.customerId});

  final int customerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(customerDetailProvider(customerId));
    final name = async.maybeWhen(data: (c) => '${c['name'] ?? ''}'.trim(), orElse: () => '');

    return Scaffold(
      appBar: AppBar(title: Text(name.isEmpty ? '고객 상세' : name)),
      body: async.when(
        data: (customer) => CustomerDetail360View(customerId: customerId, customer: customer),
        loading: () => const BoaListLoadingSkeleton(itemCount: 4),
        error: (e, _) => ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          children: [
            BoaErrorState(
              title: '고객 정보를 불러오지 못했습니다',
              message: '$e',
              onRetry: () => ref.invalidate(customerDetailProvider(customerId)),
            ),
          ],
        ),
      ),
    );
  }
}
