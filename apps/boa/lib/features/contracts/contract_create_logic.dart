import 'package:boa/core/auth/session_models.dart';
import 'package:intl/intl.dart';

const kContractPaymentStatuses = ['정상', '미납', '실효', '해지'];
const kContractStatuses = ['청약', '성립', '철회', '유지', '해지'];

final _premiumFormat = NumberFormat('#,###');

/// Web 계약 등록과 동일: 고객 담당자가 없고 member가 아니면 설계사 선택 필수.
bool contractCreateRequiresAgentSelection({
  required BoaRole? role,
  int? customerAgentId,
}) {
  if (role == BoaRole.member) return false;
  return customerAgentId == null;
}

String? validateContractCreateForm({
  required int? customerId,
  required bool requiresAgent,
  required int? selectedAgentId,
}) {
  if (customerId == null || customerId <= 0) {
    return '고객을 선택해 주세요.';
  }
  if (requiresAgent && selectedAgentId == null) {
    return '계약 담당 설계사를 선택해야 합니다.';
  }
  return null;
}

int? parseMonthlyPremiumInput(String raw) {
  final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.isEmpty) return null;
  return int.tryParse(digits);
}

String formatMonthlyPremiumInput(String raw) {
  final parsed = parseMonthlyPremiumInput(raw);
  if (parsed == null) return '';
  return _premiumFormat.format(parsed);
}

String dateOnlyApi(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

int? coerceAgentId(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse('$value');
}
