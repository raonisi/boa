import 'package:boa/features/contracts/contract_display_logic.dart';
import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const row = BoaContractRow(
    id: 1,
    productName: '[TEST] Product',
    company: '[TEST] Company',
    productGroup: '종신',
    monthlyPremium: 120000,
    contractStatus: '청약',
    paymentStatus: '정상',
    contractDate: null,
  );

  test('contractDisplayTitle prefers product name', () {
    expect(contractDisplayTitle(row), '[TEST] Product');
  });

  test('formatContractPremiumLabel uses thousand separators', () {
    expect(formatContractPremiumLabel(120000), '120,000원');
    expect(formatContractPremiumLabel(null), '-');
  });

  test('contractDisplaySubtitle joins company and product group', () {
    expect(contractDisplaySubtitle(row), '[TEST] Company · 종신');
  });
}
