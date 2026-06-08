import 'package:boa/core/auth/session_models.dart';
import 'package:boa/features/contracts/contract_create_logic.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('contractCreateRequiresAgentSelection', () {
    test('member never requires agent picker', () {
      expect(
        contractCreateRequiresAgentSelection(role: BoaRole.member, customerAgentId: null),
        isFalse,
      );
    });

    test('manager requires agent when customer has no agent', () {
      expect(
        contractCreateRequiresAgentSelection(role: BoaRole.teamLeader, customerAgentId: null),
        isTrue,
      );
    });

    test('manager skips agent picker when customer already has agent', () {
      expect(
        contractCreateRequiresAgentSelection(role: BoaRole.subBranchAdmin, customerAgentId: 12),
        isFalse,
      );
    });
  });

  group('validateContractCreateForm', () {
    test('requires customer selection', () {
      expect(
        validateContractCreateForm(customerId: null, requiresAgent: false, selectedAgentId: null),
        '고객을 선택해 주세요.',
      );
    });

    test('requires agent when policy demands it', () {
      expect(
        validateContractCreateForm(customerId: 1, requiresAgent: true, selectedAgentId: null),
        '계약 담당 설계사를 선택해야 합니다.',
      );
    });

    test('passes with customer and optional agent', () {
      expect(
        validateContractCreateForm(customerId: 1, requiresAgent: false, selectedAgentId: null),
        isNull,
      );
    });
  });

  group('monthly premium helpers', () {
    test('parses formatted digits for API payload', () {
      expect(parseMonthlyPremiumInput('120,000'), 120000);
      expect(parseMonthlyPremiumInput(''), isNull);
    });

    test('formats display with thousand separators', () {
      expect(formatMonthlyPremiumInput('50000'), '50,000');
    });
  });
}
