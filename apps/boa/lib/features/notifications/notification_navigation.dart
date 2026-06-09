import 'package:boa/features/customers/customer_detail_screen.dart';
import 'package:boa/features/more/push_preferences_screen.dart';
import 'package:boa/features/notifications/notification_display_logic.dart';
import 'package:boa/features/shell/shell_tab_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Shell tab indices — `BoaShellScreen._tabs` 와 동일.
const int kShellContractsTabIndex = 2;
const int kShellCalendarTabIndex = 3;
const int kShellNotificationsTabIndex = 4;

enum NotificationNavKind { customerDetail, shellTab, pushPreferences, none }

class NotificationNavTarget {
  const NotificationNavTarget({
    required this.kind,
    this.customerId,
    this.shellTabIndex,
    this.actionLabel,
  });

  final NotificationNavKind kind;
  final int? customerId;
  final int? shellTabIndex;
  final String? actionLabel;

  bool get canNavigate => kind != NotificationNavKind.none;
}

NotificationNavTarget resolveNotificationNavTarget(Map<String, dynamic> raw) {
  final relatedType = notificationRelatedType(raw);
  final relatedId = notificationRelatedId(raw);
  final type = '${raw['type'] ?? ''}';
  final category = notificationCategory(raw);

  if (relatedType == 'customer' && relatedId != null) {
    return NotificationNavTarget(
      kind: NotificationNavKind.customerDetail,
      customerId: relatedId,
      actionLabel: '고객 보기',
    );
  }
  if (relatedType == 'schedule' || type.startsWith('schedule_')) {
    return const NotificationNavTarget(
      kind: NotificationNavKind.shellTab,
      shellTabIndex: kShellCalendarTabIndex,
      actionLabel: '일정 보기',
    );
  }
  if (relatedType == 'follow_up' || category == NotificationCategory.followUp) {
    return const NotificationNavTarget(
      kind: NotificationNavKind.shellTab,
      shellTabIndex: kShellCalendarTabIndex,
      actionLabel: '후속관리 보기',
    );
  }
  if (relatedType == 'contract' || type.startsWith('contract_') || type == 'unpaid_lapse') {
    if (relatedType == 'customer' && relatedId != null) {
      return NotificationNavTarget(
        kind: NotificationNavKind.customerDetail,
        customerId: relatedId,
        actionLabel: '고객 보기',
      );
    }
    return const NotificationNavTarget(
      kind: NotificationNavKind.shellTab,
      shellTabIndex: kShellContractsTabIndex,
      actionLabel: '계약 보기',
    );
  }
  if (relatedType == 'delete_request') {
    return const NotificationNavTarget(
      kind: NotificationNavKind.shellTab,
      shellTabIndex: kShellContractsTabIndex,
      actionLabel: '요청 보기',
    );
  }
  return const NotificationNavTarget(kind: NotificationNavKind.none);
}

Future<void> navigateFromNotification(
  BuildContext context,
  WidgetRef ref,
  Map<String, dynamic> raw,
) async {
  final target = resolveNotificationNavTarget(raw);
  if (!context.mounted) return;

  switch (target.kind) {
    case NotificationNavKind.customerDetail:
      final id = target.customerId;
      if (id == null) {
        _showFallback(context, '연결된 고객 정보가 없습니다.');
        return;
      }
      await Navigator.of(context).push<void>(
        MaterialPageRoute<void>(builder: (_) => CustomerDetailScreen(customerId: id)),
      );
    case NotificationNavKind.shellTab:
      final tab = target.shellTabIndex;
      if (tab == null) return;
      ref.read(shellTabIndexProvider.notifier).state = tab;
    case NotificationNavKind.pushPreferences:
      await Navigator.of(context).push<void>(
        MaterialPageRoute<void>(builder: (_) => const PushPreferencesScreen()),
      );
    case NotificationNavKind.none:
      break;
  }
}

void _showFallback(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}
