import 'dart:math' as math;

import 'package:boa/features/home/field_command_helpers.dart';

/// Dashboard micro viz 한 줄.
class DashboardPulseMetric {
  const DashboardPulseMetric({
    required this.label,
    required this.valueText,
    this.hint,
    this.progress,
    this.progressLabel,
    this.hasData = true,
  });

  final String label;
  final String valueText;
  final String? hint;
  final double? progress;
  final String? progressLabel;
  final bool hasData;
}

double boaPremiumPulseProgress(int premiumSum) {
  if (premiumSum <= 0) return 0;
  const cap = 5000000;
  return (premiumSum / cap).clamp(0.0, 1.0);
}

double boaSoftPulseProgress(int value, {int cap = 8}) {
  if (value <= 0) return 0;
  return (value / cap).clamp(0.0, 1.0);
}

double? boaPercentProgress(num? percent) {
  if (percent == null) return null;
  final v = percent.toDouble();
  if (v.isNaN || v.isInfinite) return null;
  return (v / 100).clamp(0.0, 1.0);
}

int? _readInt(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.round();
  return int.tryParse('$v');
}

num? _readNum(dynamic v) {
  if (v == null) return null;
  if (v is num) return v;
  return num.tryParse('$v');
}

Map<String, dynamic>? _goalsSummary(Map<String, dynamic>? dash) {
  if (dash == null) return null;
  final summary = dash['summary'];
  if (summary is Map<String, dynamic>) return summary;
  if (summary is Map) return Map<String, dynamic>.from(summary);
  return null;
}

/// 목표 대시보드에서 달성률(%) 추출 — 없으면 null.
({double? contractRate, double? premiumRate, double? goalCompletion}) parseGoalPulseRates(
  Map<String, dynamic>? goalsDash,
) {
  final sum = _goalsSummary(goalsDash);
  if (sum == null) return (contractRate: null, premiumRate: null, goalCompletion: null);

  final totalGoals = _readInt(sum['totalGoals']) ?? 0;
  final achievedGoals = _readInt(sum['achievedGoals']) ?? 0;
  final goalCompletion = totalGoals > 0 ? achievedGoals / totalGoals : null;

  return (
    contractRate: boaPercentProgress(_readNum(sum['averageContractRate'])),
    premiumRate: boaPercentProgress(_readNum(sum['averagePremiumRate'])),
    goalCompletion: goalCompletion,
  );
}

String _formatPremium(dynamic prem) {
  if (prem == null) return '—';
  if (prem is int) return '${fieldCommaInt(prem)}원';
  if (prem is num) return '${fieldCommaInt(prem.round())}원';
  return '—';
}

List<DashboardPulseMetric> buildDashboardPulseMetrics({
  required int monthlyContractCount,
  required int monthlyPremiumSum,
  required int todayContactCount,
  required int pendingFollowUpCount,
  required int overdueFollowUpCount,
  required int unreadNotificationCount,
  Map<String, dynamic>? goalsDash,
  Map<String, dynamic>? performanceStats,
}) {
  final goals = parseGoalPulseRates(goalsDash);
  final statsContracts = performanceStats?['newContractCount'] ?? performanceStats?['contractCount'];
  final statsPremium = performanceStats?['monthlyPremiumSum'] ?? performanceStats?['monthlyPremiumTotal'];
  final contractCount = _readInt(statsContracts) ?? monthlyContractCount;
  final premiumValue = _readInt(statsPremium) ?? monthlyPremiumSum;

  final contractProgress = goals.contractRate ?? boaSoftPulseProgress(contractCount, cap: 10);
  final premiumProgress = goals.premiumRate ?? boaPremiumPulseProgress(premiumValue);
  final contactProgress = boaSoftPulseProgress(todayContactCount, cap: 6);
  final followUpProgress = boaSoftPulseProgress(pendingFollowUpCount, cap: 8);
  final notificationProgress = boaSoftPulseProgress(unreadNotificationCount, cap: 10);

  String contractProgressLabel() {
    if (goals.contractRate != null) {
      final pct = (goals.contractRate! * 100).round();
      return '목표 $pct%';
    }
    if (contractCount <= 0) return '이번 달 실적 없음';
    return '이번 달 $contractCount건';
  }

  String premiumProgressLabel() {
    if (goals.premiumRate != null) {
      final pct = (goals.premiumRate! * 100).round();
      return '목표 $pct%';
    }
    if (premiumValue <= 0) return '이번 달 실적 없음';
    return '월납 합계';
  }

  final metrics = <DashboardPulseMetric>[
    DashboardPulseMetric(
      label: '신규 계약',
      valueText: contractCount > 0 ? '$contractCount건' : '0건',
      hint: contractCount > 0 ? '이번 달 신규 계약' : '아직 등록된 신규 계약이 없습니다',
      progress: contractProgress,
      progressLabel: contractProgressLabel(),
      hasData: contractCount > 0 || goals.contractRate != null,
    ),
    DashboardPulseMetric(
      label: '월납보험료 실적',
      valueText: premiumValue > 0 ? _formatPremium(premiumValue) : '—',
      hint: premiumValue > 0 ? '이번 달 월납 합계' : '이번 달 월납 실적이 없습니다',
      progress: premiumProgress,
      progressLabel: premiumProgressLabel(),
      hasData: premiumValue > 0 || goals.premiumRate != null,
    ),
    DashboardPulseMetric(
      label: '오늘 연락 대상',
      valueText: todayContactCount > 0 ? '$todayContactCount건' : '0건',
      hint: todayContactCount > 0 ? '오늘 확인할 후속·연락' : '오늘 연락할 대상이 없습니다',
      progress: contactProgress,
      progressLabel: todayContactCount > 0 ? '오늘 $todayContactCount건' : null,
      hasData: todayContactCount > 0,
    ),
    DashboardPulseMetric(
      label: '미처리 후속관리',
      valueText: pendingFollowUpCount > 0 ? '$pendingFollowUpCount건' : '0건',
      hint: overdueFollowUpCount > 0 ? '연체 $overdueFollowUpCount건 포함' : '미완료 후속관리',
      progress: followUpProgress,
      progressLabel: pendingFollowUpCount > 0 ? '미완료 $pendingFollowUpCount건' : null,
      hasData: pendingFollowUpCount > 0,
    ),
    DashboardPulseMetric(
      label: '읽지 않은 알림',
      valueText: unreadNotificationCount > 0 ? '$unreadNotificationCount건' : '0건',
      hint: unreadNotificationCount > 0 ? '확인이 필요한 알림' : '새 알림이 없습니다',
      progress: notificationProgress,
      progressLabel: unreadNotificationCount > 0 ? '읽지 않은 알림 $unreadNotificationCount건' : null,
      hasData: unreadNotificationCount > 0,
    ),
  ];

  if (goals.goalCompletion != null) {
    final pct = (goals.goalCompletion! * 100).round();
    final sum = _goalsSummary(goalsDash);
    final achieved = _readInt(sum?['achievedGoals']) ?? 0;
    final total = _readInt(sum?['totalGoals']) ?? 0;
    metrics.add(
      DashboardPulseMetric(
        label: '목표 달성률',
        valueText: total > 0 ? '$achieved / $total건' : '$pct%',
        hint: '이번 달 목표 대비 진행',
        progress: goals.goalCompletion!.clamp(0.0, 1.0),
        progressLabel: '$pct%',
        hasData: total > 0,
      ),
    );
  } else if (goals.contractRate != null || goals.premiumRate != null) {
    final avg = [
      if (goals.contractRate != null) goals.contractRate!,
      if (goals.premiumRate != null) goals.premiumRate!,
    ];
    final blended = avg.isEmpty ? 0.0 : avg.reduce((a, b) => a + b) / avg.length;
    final pct = (blended * 100).round();
    metrics.add(
      DashboardPulseMetric(
        label: '목표 달성률',
        valueText: '$pct%',
        hint: '계약·월납 목표 평균',
        progress: blended.clamp(0.0, 1.0),
        progressLabel: '$pct%',
        hasData: true,
      ),
    );
  }

  return metrics;
}

/// KPI 카드용 얕은 progress — 과장 없이 상대 강도만 표시.
double kpiCardPulseProgress({
  required int value,
  required String kind,
  double? goalRate,
}) {
  if (goalRate != null && goalRate > 0) {
    return goalRate.clamp(0.0, 1.0);
  }
  final cap = switch (kind) {
    'schedule' => 6,
    'followup' => 8,
    'notification' => 10,
    'contract' => 10,
    _ => 8,
  };
  return boaSoftPulseProgress(value, cap: cap);
}

int resolveUnreadCount({
  required int? unreadFromProvider,
  required int pendingNotificationCount,
}) {
  if (unreadFromProvider != null) return math.max(0, unreadFromProvider);
  return math.max(0, pendingNotificationCount);
}
