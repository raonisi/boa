import 'package:boa/core/api/dio_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<void> mobileCompleteFollowUp(WidgetRef ref, int id) async {
  await ref.read(dioProvider).post<void>('/api/mobile/follow-ups/$id/complete');
}

Future<void> mobilePostponeFollowUp(
  WidgetRef ref,
  int id, {
  required String nextContactDate,
  String? reason,
}) async {
  await ref.read(dioProvider).post<void>(
        '/api/mobile/follow-ups/$id/postpone',
        data: {
          'nextContactDate': nextContactDate,
          if (reason != null && reason.isNotEmpty) 'reason': reason,
        },
      );
}

Future<void> mobileCompleteSchedule(WidgetRef ref, int id) async {
  await ref.read(dioProvider).post<void>('/api/mobile/schedules/$id/complete');
}

Future<void> mobileCancelFollowUp(WidgetRef ref, int id) async {
  await ref.read(dioProvider).post<void>('/api/mobile/follow-ups/$id/cancel');
}

Future<void> mobileCreateSchedule(
  WidgetRef ref, {
  required String title,
  required String type,
  required String startTime,
  String? endTime,
  String? memo,
  String? description,
}) async {
  await ref.read(dioProvider).post<void>(
        '/api/mobile/schedules',
        data: {
          'title': title,
          'type': type,
          'startTime': startTime,
          if (endTime != null && endTime.isNotEmpty) 'endTime': endTime,
          if (memo != null && memo.isNotEmpty) 'memo': memo,
          if (description != null && description.isNotEmpty) 'description': description,
        },
      );
}

Future<void> mobileCreateFollowUp(
  WidgetRef ref, {
  required int customerId,
  required String nextContactDate,
  required String reason,
  String nextAction = '전화',
  String? memo,
}) async {
  await ref.read(dioProvider).post<void>(
        '/api/mobile/customers/$customerId/follow-ups',
        data: {
          'nextContactDate': nextContactDate,
          'reason': reason,
          'nextAction': nextAction,
          if (memo != null && memo.isNotEmpty) 'memo': memo,
        },
      );
}
