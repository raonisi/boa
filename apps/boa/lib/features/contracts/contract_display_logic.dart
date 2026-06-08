import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:intl/intl.dart';

final _dateFormat = DateFormat('yyyy.MM.dd');
final _premiumFormat = NumberFormat('#,###');

/// 목록·카드용 계약 제목 (상품명 → 보험사 → ID).
String contractDisplayTitle(BoaContractRow row) {
  final product = row.productName?.trim();
  if (product != null && product.isNotEmpty) return product;
  final company = row.company?.trim();
  if (company != null && company.isNotEmpty) return company;
  return '계약 #${row.id}';
}

String contractDisplaySubtitle(BoaContractRow row) {
  final parts = <String>[
    if (row.company?.trim().isNotEmpty == true) row.company!.trim(),
    if (row.productGroup?.trim().isNotEmpty == true) row.productGroup!.trim(),
  ];
  return parts.isEmpty ? '' : parts.join(' · ');
}

String formatContractDateLabel(DateTime? date) {
  if (date == null) return '-';
  return _dateFormat.format(date);
}

String formatContractPremiumLabel(int? premium) {
  if (premium == null) return '-';
  return '${_premiumFormat.format(premium)}원';
}

/// 계약 상태별 배지 색상 힌트 (Material color scheme 보조).
({int background, int foreground}) contractStatusColors(String? status) {
  switch (status) {
    case '성립':
    case '유지':
      return (background: 0xFFE8F5E9, foreground: 0xFF2E7D32);
    case '청약':
      return (background: 0xFFE3F2FD, foreground: 0xFF1565C0);
    case '철회':
    case '해지':
      return (background: 0xFFFFEBEE, foreground: 0xFFC62828);
    case '미납':
    case '실효':
      return (background: 0xFFFFF3E0, foreground: 0xFFE65100);
    default:
      return (background: 0xFFF5F5F5, foreground: 0xFF616161);
  }
}

({int background, int foreground}) paymentStatusColors(String? status) {
  switch (status) {
    case '정상':
      return (background: 0xFFE8F5E9, foreground: 0xFF2E7D32);
    case '미납':
      return (background: 0xFFFFF3E0, foreground: 0xFFE65100);
    case '실효':
    case '해지':
      return (background: 0xFFFFEBEE, foreground: 0xFFC62828);
    default:
      return (background: 0xFFF5F5F5, foreground: 0xFF616161);
  }
}
