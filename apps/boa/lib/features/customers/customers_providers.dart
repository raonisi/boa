import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class BoaCustomerRow {
  const BoaCustomerRow({
    required this.id,
    required this.name,
    this.phone,
    this.consultStatus,
    this.priority,
    this.nextAction,
  });

  final int id;
  final String name;
  final String? phone;
  final String? consultStatus;
  final String? priority;
  final String? nextAction;

  factory BoaCustomerRow.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    return BoaCustomerRow(
      id: id is int ? id : int.tryParse('$id') ?? 0,
      name: (json['name'] as String?)?.trim().isNotEmpty == true ? (json['name'] as String).trim() : '(이름 없음)',
      phone: json['phone'] as String?,
      consultStatus: json['consultStatus'] as String?,
      priority: json['priority'] as String?,
      nextAction: json['nextAction'] as String?,
    );
  }
}

final customersListProvider = FutureProvider.autoDispose<List<BoaCustomerRow>>((ref) async {
  final session = ref.watch(sessionProvider);
  if (session == null) return const [];

  final dio = ref.watch(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>('/api/mobile/customers');
    final raw = res.data?['items'];
    if (raw is! List) return const [];
    return raw
        .whereType<Object?>()
        .map((e) => e is Map<String, dynamic> ? BoaCustomerRow.fromJson(e) : null)
        .whereType<BoaCustomerRow>()
        .toList();
  } on DioException catch (e) {
    final msg = e.response?.data is Map && (e.response!.data as Map)['error'] != null
        ? '${(e.response!.data as Map)['error']}'
        : e.message ?? '고객 목록을 불러오지 못했습니다.';
    throw Exception(msg);
  }
});
