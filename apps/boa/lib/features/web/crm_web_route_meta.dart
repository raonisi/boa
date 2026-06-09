/// WebView fallback 화면 분류 — Native 현장 업무 vs 관리자·대량·고위험.
enum CrmWebRouteCategory {
  fieldWeb,
  adminWork,
  bulkWork,
  highRiskWork,
  opsLog,
}

class CrmWebRouteMeta {
  const CrmWebRouteMeta({
    required this.title,
    this.subtitle,
    this.drawerSubtitle,
    this.pcRecommended = false,
    this.highRisk = false,
    this.highRiskNotice,
    this.category = CrmWebRouteCategory.adminWork,
  });

  final String title;
  final String? subtitle;
  final String? drawerSubtitle;
  final bool pcRecommended;
  final bool highRisk;
  final String? highRiskNotice;
  final CrmWebRouteCategory category;
}

const Map<String, CrmWebRouteMeta> _routeMetaByKey = {
  'pipeline': CrmWebRouteMeta(
    title: '세일즈 파이프라인',
    subtitle: '칸반·다중 필터가 포함된 웹 화면입니다.',
    drawerSubtitle: '웹 칸반 · 필터',
    category: CrmWebRouteCategory.fieldWeb,
  ),
  'sales_analytics': CrmWebRouteMeta(
    title: '영업 분석',
    subtitle: '차트·피벗 분석은 PC에서 보기 편합니다.',
    drawerSubtitle: 'PC 권장 · 웹 분석',
    pcRecommended: true,
    category: CrmWebRouteCategory.adminWork,
  ),
  'bulk_import': CrmWebRouteMeta(
    title: '고객 일괄 등록',
    subtitle: '엑셀·대량 작업은 PC 사용을 권장합니다.',
    drawerSubtitle: 'PC 권장 · CSV/XLSX',
    pcRecommended: true,
    highRisk: true,
    highRiskNotice: '업로드 파일과 컬럼 매핑을 실행 전 다시 확인해 주세요.',
    category: CrmWebRouteCategory.bulkWork,
  ),
  'db_assign': CrmWebRouteMeta(
    title: 'DB 배정 관리',
    subtitle: '대량·관리자 작업이 포함되어 PC 사용을 권장합니다.',
    drawerSubtitle: 'PC 권장 · 담당자 배정',
    pcRecommended: true,
    highRisk: true,
    highRiskNotice: '배정 대상 고객과 담당자를 실행 전 다시 확인해 주세요.',
    category: CrmWebRouteCategory.bulkWork,
  ),
  'org': CrmWebRouteMeta(
    title: '조직 관리',
    subtitle: '조직 구조 변경은 PC에서 검수하기 편합니다.',
    drawerSubtitle: 'PC 권장 · 조직 구조',
    pcRecommended: true,
    category: CrmWebRouteCategory.adminWork,
  ),
  'activity_log': CrmWebRouteMeta(
    title: '활동 로그',
    subtitle: '감사·운영 기록 조회는 PC 사용을 권장합니다.',
    drawerSubtitle: 'PC 권장 · 감사 로그',
    pcRecommended: true,
    category: CrmWebRouteCategory.opsLog,
  ),
  'upload_history': CrmWebRouteMeta(
    title: '업로드 이력 관리',
    subtitle: '일괄 등록 이력 검수는 PC에서 권장합니다.',
    drawerSubtitle: 'PC 권장 · 업로드 이력',
    pcRecommended: true,
    category: CrmWebRouteCategory.opsLog,
  ),
  'dup_customers': CrmWebRouteMeta(
    title: '중복 고객 병합',
    subtitle: '병합 대상과 기준 고객을 반드시 확인하세요.',
    drawerSubtitle: '고위험 · PC 권장',
    pcRecommended: true,
    highRisk: true,
    highRiskNotice: '병합은 되돌리기 어려울 수 있습니다. 기준 고객과 대상을 다시 확인해 주세요.',
    category: CrmWebRouteCategory.highRiskWork,
  ),
  'users': CrmWebRouteMeta(
    title: '사용자 관리',
    subtitle: '권한·계정 변경이 포함된 관리자 화면입니다.',
    drawerSubtitle: '관리자 · 권한',
    pcRecommended: true,
    category: CrmWebRouteCategory.adminWork,
  ),
  'handover': CrmWebRouteMeta(
    title: '인수인계 관리',
    subtitle: '인계자와 인수자를 확인한 뒤 실행하세요.',
    drawerSubtitle: '고위험 · PC 권장',
    pcRecommended: true,
    highRisk: true,
    highRiskNotice: '인수인계는 고객·계약 scope에 영향을 줍니다. 대상을 다시 확인해 주세요.',
    category: CrmWebRouteCategory.highRiskWork,
  ),
  'teams': CrmWebRouteMeta(
    title: '팀 관리',
    subtitle: '팀·조직 단위 관리자 화면입니다.',
    drawerSubtitle: '관리자 · 팀',
    pcRecommended: true,
    category: CrmWebRouteCategory.adminWork,
  ),
  'ops': CrmWebRouteMeta(
    title: '운영 리스크 센터',
    subtitle: '운영 로그·리스크 검수는 PC 사용을 권장합니다.',
    drawerSubtitle: 'PC 권장 · 운영 리스크',
    pcRecommended: true,
    category: CrmWebRouteCategory.opsLog,
  ),
  'push_ops': CrmWebRouteMeta(
    title: '푸시 운영 현황',
    subtitle: '발송 로그·운영 현황을 확인하는 관리자 화면입니다.',
    drawerSubtitle: '관리자 · 푸시 운영',
    pcRecommended: true,
    category: CrmWebRouteCategory.opsLog,
  ),
  'deleted': CrmWebRouteMeta(
    title: '삭제 데이터 관리',
    subtitle: '복구·완전삭제 권한이 필요한 관리자 화면입니다.',
    drawerSubtitle: '고위험 · PC 권장',
    pcRecommended: true,
    highRisk: true,
    highRiskNotice: '삭제·복구·완전삭제 작업은 실행 전 대상을 다시 확인해 주세요.',
    category: CrmWebRouteCategory.highRiskWork,
  ),
  'download': CrmWebRouteMeta(
    title: '데이터 다운로드',
    subtitle: '대량 내보내기는 PC에서 권장합니다.',
    drawerSubtitle: 'PC 권장 · 내보내기',
    pcRecommended: true,
    category: CrmWebRouteCategory.bulkWork,
  ),
  'tools': CrmWebRouteMeta(
    title: '상담 도구 관리',
    subtitle: '관리자 설정·도구 관리 화면입니다.',
    drawerSubtitle: '관리자 · 상담 도구',
    pcRecommended: true,
    category: CrmWebRouteCategory.adminWork,
  ),
  'settings_admin': CrmWebRouteMeta(
    title: '설정 관리',
    subtitle: '시스템·운영 설정은 PC에서 검수하기 편합니다.',
    drawerSubtitle: 'PC 권장 · 시스템 설정',
    pcRecommended: true,
    category: CrmWebRouteCategory.adminWork,
  ),
};

CrmWebRouteMeta? crmWebRouteMetaForKey(String routeKey) => _routeMetaByKey[routeKey];

CrmWebRouteMeta crmWebRouteMetaForPath(String path, {String? titleOverride}) {
  final normalized = path.startsWith('/') ? path : '/$path';
  if (normalized == '/customers') {
    return CrmWebRouteMeta(
      title: titleOverride ?? '고객 등록',
      subtitle: '단건 등록은 웹 화면에서 진행합니다. 대량 등록은 일괄 등록 메뉴를 이용하세요.',
      category: CrmWebRouteCategory.fieldWeb,
    );
  }
  if (normalized.startsWith('/customers/')) {
    return CrmWebRouteMeta(
      title: titleOverride ?? '고객 상세 (웹)',
      subtitle: '상담기록·상태 변경 등 웹 전용 기능입니다.',
      category: CrmWebRouteCategory.fieldWeb,
    );
  }
  return CrmWebRouteMeta(
    title: titleOverride ?? '관리자 웹 화면',
    subtitle: '웹 CRM 화면을 앱 안에서 엽니다.',
    category: CrmWebRouteCategory.adminWork,
  );
}

String crmWebCategoryLabel(CrmWebRouteCategory category) => switch (category) {
      CrmWebRouteCategory.fieldWeb => '웹 보조',
      CrmWebRouteCategory.adminWork => '관리자',
      CrmWebRouteCategory.bulkWork => '대량 작업',
      CrmWebRouteCategory.highRiskWork => '고위험',
      CrmWebRouteCategory.opsLog => '운영 로그',
    };
