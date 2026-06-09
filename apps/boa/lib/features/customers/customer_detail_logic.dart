/// CustomerDetail 360 — 순수 로직 (테스트 가능).
library;

import 'dart:convert';

import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:boa/features/home/field_command_helpers.dart';

List<String> parseCustomerTags(dynamic raw) {
  if (raw == null) return const [];
  if (raw is List) {
    return raw.map((e) => '$e').where((e) => e.isNotEmpty).toList();
  }
  if (raw is String) {
    final t = raw.trim();
    if (t.isEmpty) return const [];
    if (t.startsWith('[')) {
      try {
        final decoded = jsonDecode(t);
        if (decoded is List) {
          return decoded.map((e) => '$e').where((e) => e.isNotEmpty).toList();
        }
      } catch (_) {}
    }
    return t.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
  }
  return const [];
}

String priorityLabel(String? priority) {
  if (priority == null || priority.isEmpty || priority == 'unclassified') return '미분류';
  switch (priority.toUpperCase()) {
    case 'URGENT':
      return '긴급';
    case 'HIGH':
      return '높음';
    case 'MEDIUM':
    case 'NORMAL':
      return '보통';
    case 'LOW':
      return '낮음';
    case 'IMPORTANT':
      return '중요';
    default:
      return priority;
  }
}

DateTime? parseApiDateTime(dynamic v) => decodeApiDateTime(v);

bool isFollowUpOverdue(Map<String, dynamic> raw, DateTime now) {
  final status = '${raw['status'] ?? ''}';
  if (!fieldIsOpenFollowUp(status)) return false;
  final next = parseApiDateTime(raw['nextContactDate']);
  if (next == null) return false;
  final todayStart = DateTime(now.year, now.month, now.day);
  return next.isBefore(todayStart);
}

class CustomerTimelineEntry {
  const CustomerTimelineEntry({
    required this.kind,
    required this.title,
    required this.subtitle,
    this.occurredAt,
  });

  final String kind;
  final String title;
  final String subtitle;
  final DateTime? occurredAt;
}

List<CustomerTimelineEntry> buildCustomerTimeline({
  required List<Map<String, dynamic>> followUps,
  required List<BoaContractRow> contracts,
  required List<Map<String, dynamic>> schedules,
  int limit = 12,
}) {
  final entries = <CustomerTimelineEntry>[];

  for (final fu in followUps) {
    final reason = '${fu['reason'] ?? ''}'.trim();
    final status = '${fu['status'] ?? ''}';
    entries.add(
      CustomerTimelineEntry(
        kind: 'follow_up',
        title: reason.isNotEmpty ? reason : '후속관리',
        subtitle: [fieldFmtDateTime(fu['nextContactDate']), if (status.isNotEmpty) status].join(' · '),
        occurredAt: parseApiDateTime(fu['updatedAt']) ?? parseApiDateTime(fu['createdAt']) ?? parseApiDateTime(fu['nextContactDate']),
      ),
    );
  }

  for (final c in contracts) {
    final product = c.productName?.trim().isNotEmpty == true
        ? c.productName!.trim()
        : (c.company?.trim().isNotEmpty == true ? c.company!.trim() : '계약 #${c.id}');
    final prem = c.monthlyPremium;
    entries.add(
      CustomerTimelineEntry(
        kind: 'contract',
        title: product,
        subtitle: [
          if (c.contractStatus != null && c.contractStatus!.isNotEmpty) c.contractStatus!,
          if (prem != null) '월납 ${fieldCommaInt(prem)}원',
        ].join(' · '),
        occurredAt: c.contractDate ?? c.createdAt,
      ),
    );
  }

  for (final s in schedules) {
    final title = '${s['title'] ?? '일정'}';
    final typ = '${s['type'] ?? ''}';
    final status = '${s['status'] ?? ''}';
    entries.add(
      CustomerTimelineEntry(
        kind: 'schedule',
        title: title,
        subtitle: [fieldFmtDateTime(s['startTime']), if (typ.isNotEmpty) typ, if (status.isNotEmpty) status].join(' · '),
        occurredAt: parseApiDateTime(s['startTime']),
      ),
    );
  }

  entries.sort((a, b) {
    final ta = a.occurredAt ?? DateTime.fromMillisecondsSinceEpoch(0);
    final tb = b.occurredAt ?? DateTime.fromMillisecondsSinceEpoch(0);
    return tb.compareTo(ta);
  });

  return entries.take(limit).toList();
}

int sumMonthlyPremium(Iterable<BoaContractRow> rows) =>
    rows.fold<int>(0, (sum, r) => sum + (r.monthlyPremium ?? 0));
