import 'package:boa/core/config/app_config.dart';
import 'package:boa/features/customers/customer_detail_screen.dart';
import 'package:boa/features/customers/customers_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CustomersTab extends ConsumerWidget {
  const CustomersTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final async = ref.watch(customersListProvider);

    if (!AppConfig.hasApiBase) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            'API 주소가 설정되지 않았습니다.',
            style: theme.textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(
            '실행 시 --dart-define=BOA_API_BASE_URL=... 를 지정하세요. (에뮬레이터: http://10.0.2.2:포트)',
            style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
        ],
      );
    }

    return async.when(
      data: (rows) {
        if (rows.isEmpty) {
          return Center(
            child: Text(
              '등록된 고객이 없거나 목록이 비어 있습니다.',
              style: theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(customersListProvider);
            await ref.read(customersListProvider.future);
          },
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: rows.length,
            itemBuilder: (context, i) {
              final c = rows[i];
              final subtitle = [
                if (c.consultStatus != null) c.consultStatus,
                if (c.phone != null && c.phone!.isNotEmpty) c.phone,
                if (c.priority != null && c.priority!.isNotEmpty) '우선순위 ${c.priority}',
              ].join(' · ');
              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  title: Text(c.name, style: theme.textTheme.titleSmall),
                  subtitle: Text(
                    subtitle.isEmpty ? '상세 (준비 중)' : subtitle,
                    style: theme.textTheme.bodySmall,
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.of(context).push<void>(
                      MaterialPageRoute<void>(
                        builder: (context) => CustomerDetailScreen(customerId: c.id),
                      ),
                    );
                  },
                ),
              );
            },
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text('목록을 불러오지 못했습니다', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          Text('$e', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error)),
          const SizedBox(height: 16),
          FilledButton.tonal(
            onPressed: () => ref.invalidate(customersListProvider),
            child: const Text('다시 시도'),
          ),
        ],
      ),
    );
  }
}
