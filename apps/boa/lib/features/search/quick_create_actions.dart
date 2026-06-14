import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/features/contracts/contract_create_screen.dart';
import 'package:boa/features/customers/customer_detail_dialogs.dart';
import 'package:boa/features/customers/customer_web_actions.dart';
import 'package:boa/features/customers/customers_providers.dart';
import 'package:boa/features/search/global_search_screen.dart';
import 'package:boa/features/web/crm_web_navigation.dart';
import 'package:boa/features/web/crm_web_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 빠른 실행 종류 — 고위험·관리자 작업은 포함하지 않음.
enum QuickCreateAction {
  customerRegister,
  consultation,
  followUp,
  schedule,
  contract,
}

String quickCreateActionLabel(QuickCreateAction action) => switch (action) {
      QuickCreateAction.customerRegister => '고객 등록',
      QuickCreateAction.consultation => '상담 기록',
      QuickCreateAction.followUp => '후속 등록',
      QuickCreateAction.schedule => '일정 등록',
      QuickCreateAction.contract => '계약 등록',
    };

IconData quickCreateActionIcon(QuickCreateAction action) => switch (action) {
      QuickCreateAction.customerRegister => Icons.person_add_outlined,
      QuickCreateAction.consultation => Icons.edit_note_outlined,
      QuickCreateAction.followUp => Icons.add_task_outlined,
      QuickCreateAction.schedule => Icons.event_outlined,
      QuickCreateAction.contract => Icons.description_outlined,
    };

/// 고객 등록 — mobile API 없음, WebView `/customers` fallback.
void openCustomerRegistrationWeb(BuildContext context, WidgetRef ref) {
  final session = ref.read(sessionProvider);
  if (session == null) {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('로그인이 필요합니다.')));
    return;
  }
  pushCrmWebScreen(
    context,
    CrmWebScreen.forPath(
      path: '/customers',
      sessionToken: session.sessionToken,
      title: '고객 등록',
    ),
  );
}

Future<BoaCustomerRow?> _ensureCustomer(
  BuildContext context, {
  int? customerId,
  String? customerName,
  QuickCreateAction? pickFor,
}) async {
  if (customerId != null && customerId > 0) {
    return BoaCustomerRow(
      id: customerId,
      name: customerName?.trim().isNotEmpty == true ? customerName!.trim() : '고객 #$customerId',
    );
  }
  if (!context.mounted) return null;
  return pushGlobalSearch(
    context,
    pickOnly: true,
    pendingAction: pickFor,
  );
}

Future<void> runQuickCreate(
  BuildContext context,
  WidgetRef ref,
  QuickCreateAction action, {
  int? customerId,
  String? customerName,
}) async {
  if (action == QuickCreateAction.customerRegister) {
    openCustomerRegistrationWeb(context, ref);
    return;
  }

  final customer = await _ensureCustomer(
    context,
    customerId: customerId,
    customerName: customerName,
    pickFor: action,
  );
  if (!context.mounted || customer == null) return;

  await _runWithCustomer(context, ref, action, customer);
}

Future<void> _runWithCustomer(
  BuildContext context,
  WidgetRef ref,
  QuickCreateAction action,
  BoaCustomerRow customer,
) async {
  final cid = customer.id;
  final name = customer.name;

  switch (action) {
    case QuickCreateAction.customerRegister:
      openCustomerRegistrationWeb(context, ref);
      return;
    case QuickCreateAction.consultation:
      openCustomerWebDetail(
        context,
        ref,
        customerId: cid,
        title: '$name · 상담기록',
      );
      return;
    case QuickCreateAction.followUp:
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => CreateFollowUpDialog(customerId: cid),
      );
      if (!context.mounted || ok != true) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('후속관리를 등록했습니다.')));
      return;
    case QuickCreateAction.schedule:
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => CreateCustomerScheduleDialog(customerId: cid, customerName: name),
      );
      if (!context.mounted || ok != true) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('일정을 등록했습니다.')));
      return;
    case QuickCreateAction.contract:
      final ok = await Navigator.of(context).push<bool>(
        MaterialPageRoute<bool>(
          builder: (_) => ContractCreateScreen(customerId: cid, customerName: name),
        ),
      );
      if (!context.mounted || ok != true) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('계약을 등록했습니다.')));
      return;
  }
}

/// 검색 결과에서 고객 선택 후 pending action 실행.
Future<void> runPendingQuickCreate(
  BuildContext context,
  WidgetRef ref,
  QuickCreateAction action,
  BoaCustomerRow customer,
) async {
  await _runWithCustomer(context, ref, action, customer);
}
