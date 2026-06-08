import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/features/web/crm_web_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 상담기록·상태/태그 수정 등 mobile API 미제공 기능의 WebView fallback.
void openCustomerWebDetail(
  BuildContext context,
  WidgetRef ref, {
  required int customerId,
  String title = '고객 상세 (웹)',
}) {
  final session = ref.read(sessionProvider);
  if (session == null) {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('로그인이 필요합니다.')));
    return;
  }
  Navigator.of(context).push<void>(
    MaterialPageRoute<void>(
      builder: (_) => CrmWebScreen(
        title: title,
        path: '/customers/$customerId',
        sessionToken: session.sessionToken,
      ),
    ),
  );
}
