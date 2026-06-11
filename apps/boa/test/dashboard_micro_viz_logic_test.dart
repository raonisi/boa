import 'package:boa/features/home/dashboard_micro_viz_logic.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('boaSoftPulseProgress', () {
    test('returns 0 for zero or negative', () {
      expect(boaSoftPulseProgress(0), 0);
      expect(boaSoftPulseProgress(-1), 0);
    });

    test('clamps to cap', () {
      expect(boaSoftPulseProgress(4, cap: 8), 0.5);
      expect(boaSoftPulseProgress(16, cap: 8), 1.0);
    });
  });

  group('boaPremiumPulseProgress', () {
    test('returns 0 for zero premium', () {
      expect(boaPremiumPulseProgress(0), 0);
    });

    test('scales against cap', () {
      expect(boaPremiumPulseProgress(2500000), 0.5);
      expect(boaPremiumPulseProgress(10000000), 1.0);
    });
  });

  group('boaPercentProgress', () {
    test('handles null and invalid', () {
      expect(boaPercentProgress(null), isNull);
      expect(boaPercentProgress(double.nan), isNull);
    });

    test('converts percent to fraction', () {
      expect(boaPercentProgress(75), 0.75);
      expect(boaPercentProgress(120), 1.0);
    });
  });

  group('parseGoalPulseRates', () {
    test('returns nulls when dash is null', () {
      final r = parseGoalPulseRates(null);
      expect(r.contractRate, isNull);
      expect(r.premiumRate, isNull);
      expect(r.goalCompletion, isNull);
    });

    test('parses summary fields', () {
      final r = parseGoalPulseRates({
        'summary': {
          'totalGoals': 4,
          'achievedGoals': 2,
          'averageContractRate': 80,
          'averagePremiumRate': 50,
        },
      });
      expect(r.goalCompletion, 0.5);
      expect(r.contractRate, 0.8);
      expect(r.premiumRate, 0.5);
    });
  });

  group('buildDashboardPulseMetrics', () {
    test('includes six core metrics with Korean empty hints', () {
      final metrics = buildDashboardPulseMetrics(
        monthlyContractCount: 0,
        monthlyPremiumSum: 0,
        todayContactCount: 0,
        pendingFollowUpCount: 0,
        overdueFollowUpCount: 0,
        unreadNotificationCount: 0,
      );
      expect(metrics.length, 5);
      expect(metrics[0].label, '신규 계약');
      expect(metrics[0].hint, contains('없습니다'));
      expect(metrics[1].label, '월납보험료 실적');
    });

    test('adds goal completion when goals present', () {
      final metrics = buildDashboardPulseMetrics(
        monthlyContractCount: 3,
        monthlyPremiumSum: 100000,
        todayContactCount: 1,
        pendingFollowUpCount: 2,
        overdueFollowUpCount: 0,
        unreadNotificationCount: 1,
        goalsDash: {
          'summary': {
            'totalGoals': 2,
            'achievedGoals': 1,
            'averageContractRate': 60,
            'averagePremiumRate': 40,
          },
        },
      );
      expect(metrics.any((m) => m.label == '목표 달성률'), isTrue);
    });
  });

  group('resolveUnreadCount', () {
    test('prefers provider value', () {
      expect(resolveUnreadCount(unreadFromProvider: 3, pendingNotificationCount: 1), 3);
    });

    test('falls back to pending count', () {
      expect(resolveUnreadCount(unreadFromProvider: null, pendingNotificationCount: 2), 2);
    });

    test('never returns negative', () {
      expect(resolveUnreadCount(unreadFromProvider: -1, pendingNotificationCount: 0), 0);
    });
  });
}
