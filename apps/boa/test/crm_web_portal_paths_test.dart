import 'package:boa/features/web/crm_web_portal_paths.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('crmWebPathForRouteKey maps drawer keys to web SPA paths', () {
    expect(crmWebPathForRouteKey('pipeline'), '/sales-pipeline');
    expect(crmWebPathForRouteKey('sales_analytics'), '/analytics');
    expect(crmWebPathForRouteKey('bulk_import'), '/customers/bulk-import');
    expect(crmWebPathForRouteKey('db_assign'), '/customers/assign');
    expect(crmWebPathForRouteKey('org'), '/organization');
    expect(crmWebPathForRouteKey('activity_log'), '/logs');
    expect(crmWebPathForRouteKey('upload_history'), '/customers/import-batches');
    expect(crmWebPathForRouteKey('dup_customers'), '/customers/merge');
    expect(crmWebPathForRouteKey('users'), '/users');
    expect(crmWebPathForRouteKey('handover'), '/users/handoff');
    expect(crmWebPathForRouteKey('teams'), '/teams');
    expect(crmWebPathForRouteKey('ops'), '/operation-risk?tab=logs');
    expect(crmWebPathForRouteKey('push_ops'), '/push-notifications');
    expect(crmWebPathForRouteKey('deleted'), '/deleted-data');
    expect(crmWebPathForRouteKey('download'), '/download');
    expect(crmWebPathForRouteKey('tools'), '/consultation-tools');
    expect(crmWebPathForRouteKey('settings_admin'), '/settings');
  });

  test('crmWebPathForRouteKey returns null for native-only keys', () {
    expect(crmWebPathForRouteKey('performance'), isNull);
    expect(crmWebPathForRouteKey('unknown'), isNull);
  });

  test('crmWebRedirectPathWithQuery preserves canonical route query', () {
    expect(
      crmWebRedirectPathWithQuery(
        Uri.parse('https://raonisis.kr/operation-risk?tab=logs'),
      ),
      '/operation-risk?tab=logs',
    );
    expect(
      crmWebRedirectPathWithQuery(Uri.parse('https://raonisis.kr/customers')),
      '/customers',
    );
  });
}
