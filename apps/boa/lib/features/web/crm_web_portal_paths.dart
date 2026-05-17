/// [BoaShellScreen] `routeKey` → 웹 SPA 경로 (`client` DashboardLayout / MobileNav 와 동일).
String? crmWebPathForRouteKey(String routeKey) {
  switch (routeKey) {
    case 'pipeline':
      return '/sales-pipeline';
    case 'sales_analytics':
      return '/analytics';
    case 'bulk_import':
      return '/customers/bulk-import';
    case 'db_assign':
      return '/customers/assign';
    case 'org':
      return '/organization';
    case 'activity_log':
      return '/logs';
    case 'upload_history':
      return '/customers/import-batches';
    case 'dup_customers':
      return '/customers/merge';
    case 'users':
      return '/users';
    case 'handover':
      return '/users/handoff';
    case 'teams':
      return '/teams';
    case 'ops':
      return '/operation-risk?tab=logs';
    case 'push_ops':
      return '/push-notifications';
    case 'deleted':
      return '/deleted-data';
    case 'download':
      return '/download';
    case 'tools':
      return '/consultation-tools';
    case 'settings_admin':
      return '/settings';
    default:
      return null;
  }
}
