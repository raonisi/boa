import 'package:boa/features/web/crm_web_route_meta.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('crmWebRouteMetaForKey', () {
    test('marks bulk import as PC recommended and high risk', () {
      final meta = crmWebRouteMetaForKey('bulk_import');
      expect(meta, isNotNull);
      expect(meta!.pcRecommended, isTrue);
      expect(meta.highRisk, isTrue);
      expect(meta.title, '고객 일괄 등록');
    });

    test('marks handover as high risk', () {
      final meta = crmWebRouteMetaForKey('handover');
      expect(meta!.highRisk, isTrue);
      expect(meta.highRiskNotice, isNotNull);
    });

    test('push ops is ops log category', () {
      final meta = crmWebRouteMetaForKey('push_ops');
      expect(meta!.category, CrmWebRouteCategory.opsLog);
      expect(meta.title, '푸시 운영 현황');
    });
  });

  group('crmWebRouteMetaForPath', () {
    test('customer register path', () {
      final meta = crmWebRouteMetaForPath('/customers');
      expect(meta.title, '고객 등록');
      expect(meta.category, CrmWebRouteCategory.fieldWeb);
    });

    test('customer detail path', () {
      final meta = crmWebRouteMetaForPath('/customers/42', titleOverride: '고객 상세 (웹)');
      expect(meta.title, '고객 상세 (웹)');
    });
  });
}
