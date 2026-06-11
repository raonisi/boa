import 'package:boa/core/widgets/boa_customer_hero.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('boaCustomerAvatarHeroTag is unique per lane and id', () {
    expect(
      boaCustomerAvatarHeroTag(7, lane: BoaCustomerHeroLane.customersList),
      'boa-cust-avatar-customers_list-7',
    );
    expect(
      boaCustomerAvatarHeroTag(7, lane: BoaCustomerHeroLane.globalSearch),
      'boa-cust-avatar-global_search-7',
    );
    expect(boaCustomerAvatarHeroTag(7, lane: BoaCustomerHeroLane.customersList), isNot(
      boaCustomerAvatarHeroTag(7, lane: BoaCustomerHeroLane.globalSearch),
    ));
  });

  test('invalid customer id returns null tag', () {
    expect(boaCustomerAvatarHeroTag(0, lane: BoaCustomerHeroLane.customersList), isNull);
    expect(boaCustomerAvatarHeroTag(-1, lane: BoaCustomerHeroLane.globalSearch), isNull);
    expect(boaCustomerNameHeroTag(null, lane: BoaCustomerHeroLane.customersList), isNull);
  });

  testWidgets('BoaCustomerAvatarHero renders without Hero when id invalid', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: BoaCustomerAvatarHero(
            customerId: 0,
            lane: BoaCustomerHeroLane.customersList,
            radius: 22,
            displayName: 'Kim',
          ),
        ),
      ),
    );

    expect(find.byType(Hero), findsNothing);
    expect(find.text('K'), findsOneWidget);
  });

  testWidgets('BoaCustomerAvatarHero wraps Hero for valid id', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: BoaCustomerAvatarHero(
            customerId: 12,
            lane: BoaCustomerHeroLane.globalSearch,
            radius: 22,
            displayName: 'Lee',
          ),
        ),
      ),
    );

    expect(find.byType(Hero), findsOneWidget);
  });
}
