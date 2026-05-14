import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final customerDetailProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, customerId) async {
  if (!AppConfig.hasApiBase) {
    throw Exception('BOA_API_BASE_URL 미설정');
  }
  if (ref.watch(sessionProvider) == null) {
    throw Exception('세션 없음');
  }
  final dio = ref.watch(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>('/api/mobile/customers/$customerId');
    final c = res.data?['customer'];
    if (c is! Map<String, dynamic>) {
      throw Exception('고객 데이터 형식 오류');
    }
    return c;
  } on DioException catch (e) {
    final body = e.response?.data;
    String msg = '고객 정보를 불러오지 못했습니다.';
    if (body is Map && body['error'] != null) {
      msg = '${body['error']}';
    } else if (e.message != null) {
      msg = e.message!;
    }
    throw Exception(msg);
  }
});

String? _str(dynamic v) {
  if (v == null) return null;
  if (v is String) return v.isEmpty ? null : v;
  return '$v';
}

class CustomerDetailScreen extends ConsumerWidget {
  const CustomerDetailScreen({super.key, required this.customerId});

  final int customerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final async = ref.watch(customerDetailProvider(customerId));

    return Scaffold(
      appBar: AppBar(title: const Text('고객 상세')),
      body: async.when(
        data: (c) {
          final name = _str(c['name']) ?? '고객';
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(name, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 16),
              _detailRow(theme, '연락처', _str(c['phone'])),
              _detailRow(theme, '상담상태', _str(c['consultStatus'])),
              _detailRow(theme, '우선순위', _str(c['priority'])),
              _detailRow(theme, '다음 조치', _str(c['nextAction'])),
              _detailRow(theme, '지역', _str(c['region'])),
              _detailRow(theme, '유입', _str(c['source'])),
              _detailRow(theme, '메모', _str(c['memo'])),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('$e', textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton.tonal(
                  onPressed: () => ref.invalidate(customerDetailProvider(customerId)),
                  child: const Text('다시 시도'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

Widget _detailRow(ThemeData theme, String label, String? value) {
  if (value == null) return const SizedBox.shrink();
  return Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: theme.textTheme.labelLarge?.copyWith(color: theme.colorScheme.primary)),
        const SizedBox(height: 4),
        Text(value, style: theme.textTheme.bodyLarge),
      ],
    ),
  );
}
