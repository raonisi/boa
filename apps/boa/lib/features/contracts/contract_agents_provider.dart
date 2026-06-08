import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AssignableAgent {
  const AssignableAgent({
    required this.id,
    required this.name,
    this.role,
  });

  final int id;
  final String name;
  final String? role;

  factory AssignableAgent.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    return AssignableAgent(
      id: id is int ? id : int.tryParse('$id') ?? 0,
      name: (json['name'] as String?)?.trim().isNotEmpty == true
          ? (json['name'] as String).trim()
          : '사용자',
      role: json['role'] as String?,
    );
  }
}

final assignableAgentsProvider = FutureProvider.autoDispose<List<AssignableAgent>>((ref) async {
  if (!AppConfig.hasApiBase || ref.watch(sessionProvider) == null) {
    return const [];
  }
  final dio = ref.watch(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>('/api/mobile/users/assignable-agents');
    final raw = res.data?['items'];
    if (raw is! List) return const [];
    return raw
        .map((e) => e is Map<String, dynamic> ? e : (e is Map ? Map<String, dynamic>.from(e) : null))
        .whereType<Map<String, dynamic>>()
        .map(AssignableAgent.fromJson)
        .where((a) => a.id > 0)
        .toList();
  } on DioException {
    return const [];
  }
});
