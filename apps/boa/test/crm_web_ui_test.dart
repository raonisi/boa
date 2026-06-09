import 'package:boa/features/web/crm_web_route_meta.dart';
import 'package:boa/features/web/crm_web_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('CrmWebPcRecommendedBanner shows PC guidance', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: CrmWebPcRecommendedBanner()),
      ),
    );
    expect(find.textContaining('PC 사용을 권장'), findsOneWidget);
  });

  testWidgets('CrmWebHighRiskBanner shows custom message', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: CrmWebHighRiskBanner(message: '[TEST] 병합 전 확인'),
        ),
      ),
    );
    expect(find.text('[TEST] 병합 전 확인'), findsOneWidget);
  });

  testWidgets('CrmWebLoadingOverlay shows loading copy', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: CrmWebLoadingOverlay()),
      ),
    );
    expect(find.text('관리자 화면을 불러오는 중입니다.'), findsOneWidget);
  });

  testWidgets('CrmWebErrorPanel hides raw technical details', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CrmWebErrorPanel(
            message: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
            onRetry: () {},
          ),
        ),
      ),
    );
    expect(find.text('화면을 불러오지 못했습니다.'), findsOneWidget);
    expect(find.text('다시 시도'), findsOneWidget);
  });

  testWidgets('CrmWebDrawerTile shows subtitle and category', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CrmWebDrawerTile(
            icon: Icons.cloud_upload_outlined,
            title: '고객 일괄 등록',
            subtitle: 'PC 권장 · 엑셀 일괄',
            category: CrmWebRouteCategory.bulkWork,
            onTap: () {},
          ),
        ),
      ),
    );
    expect(find.text('고객 일괄 등록'), findsOneWidget);
    expect(find.text('PC 권장 · 엑셀 일괄'), findsOneWidget);
    expect(find.text('대량 작업'), findsOneWidget);
  });
}
