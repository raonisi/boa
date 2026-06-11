import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:flutter/material.dart';

/// 고객 목록·검색 → 상세 Hero lane — 동시 노출 시 tag 충돌 방지.
abstract final class BoaCustomerHeroLane {
  static const customersList = 'customers_list';
  static const globalSearch = 'global_search';
}

String? boaCustomerAvatarHeroTag(int? customerId, {required String lane}) {
  if (customerId == null || customerId <= 0) return null;
  final safeLane = lane.replaceAll(RegExp(r'[^a-z0-9_]'), '');
  if (safeLane.isEmpty) return null;
  return 'boa-cust-avatar-$safeLane-$customerId';
}

String? boaCustomerNameHeroTag(int? customerId, {required String lane}) {
  if (customerId == null || customerId <= 0) return null;
  final safeLane = lane.replaceAll(RegExp(r'[^a-z0-9_]'), '');
  if (safeLane.isEmpty) return null;
  return 'boa-cust-name-$safeLane-$customerId';
}

/// 고객 이니셜 아바타 — 목록·검색·상세 공통 Hero 소스/대상.
class BoaCustomerAvatarHero extends StatelessWidget {
  const BoaCustomerAvatarHero({
    super.key,
    required this.customerId,
    required this.lane,
    required this.radius,
    required this.displayName,
    this.textStyle,
  });

  final int? customerId;
  final String lane;
  final double radius;
  final String displayName;
  final TextStyle? textStyle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final initial = displayName.trim().isNotEmpty ? displayName.trim()[0] : '?';
    final avatar = CircleAvatar(
      radius: radius,
      backgroundColor: const Color(0xFFE8EEF4),
      child: Text(
        initial,
        style: textStyle ??
            theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: BoaColors.navy,
            ),
      ),
    );

    final tag = boaCustomerAvatarHeroTag(customerId, lane: lane);
    if (tag == null) return avatar;

    return Hero(
      tag: tag,
      transitionOnUserGestures: true,
      child: Material(
        type: MaterialType.transparency,
        child: avatar,
      ),
    );
  }
}

/// 고객명 — 절제된 Hero (아바타와 별도 tag).
class BoaCustomerNameHero extends StatelessWidget {
  const BoaCustomerNameHero({
    super.key,
    required this.customerId,
    required this.lane,
    required this.name,
    required this.style,
    this.maxLines = 1,
  });

  final int? customerId;
  final String lane;
  final String name;
  final TextStyle? style;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final text = Text(
      name,
      style: style ?? theme.textTheme.titleSmall,
      maxLines: maxLines,
      overflow: TextOverflow.ellipsis,
    );

    final tag = boaCustomerNameHeroTag(customerId, lane: lane);
    if (tag == null) return text;

    return Hero(
      tag: tag,
      transitionOnUserGestures: true,
      child: Material(
        type: MaterialType.transparency,
        child: text,
      ),
    );
  }
}

/// 상세 로딩 중 Hero 대상 유지 — 전환 끊김 방지.
class CustomerDetailHeroPlaceholder extends StatelessWidget {
  const CustomerDetailHeroPlaceholder({
    super.key,
    required this.customerId,
    required this.heroLane,
    required this.displayName,
  });

  final int customerId;
  final String heroLane;
  final String displayName;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final name = displayName.trim().isEmpty ? '고객' : displayName.trim();

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      children: [
        BoaSurfaceCard(
          margin: EdgeInsets.zero,
          highlight: true,
          padding: const EdgeInsets.fromLTRB(18, 16, 12, 16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              BoaCustomerAvatarHero(
                customerId: customerId,
                lane: heroLane,
                radius: 28,
                displayName: name,
                textStyle: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: BoaColors.navy,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    BoaCustomerNameHero(
                      customerId: customerId,
                      lane: heroLane,
                      name: name,
                      maxLines: 2,
                      style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '고객 요약',
                      style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const Center(child: CircularProgressIndicator()),
        const SizedBox(height: 12),
        Center(
          child: Text(
            '고객 정보를 불러오는 중입니다…',
            style: theme.textTheme.bodyMedium,
          ),
        ),
      ],
    );
  }
}
