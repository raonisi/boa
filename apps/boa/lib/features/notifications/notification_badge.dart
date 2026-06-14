import 'package:boa/core/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// unread count를 Navigation badge 라벨로 변환한다.
String formatUnreadBadgeLabel(int count) {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return '$count';
}

/// Navigation/Drawer용 unread badge 아이콘.
class NotificationBadgeIcon extends StatelessWidget {
  const NotificationBadgeIcon({
    super.key,
    required this.icon,
    required this.unreadCount,
    this.semanticsLabel,
  });

  final Icon icon;
  final int? unreadCount;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final count = unreadCount;
    if (count == null || count <= 0) {
      return icon;
    }

    final label = formatUnreadBadgeLabel(count);
    final badge = Badge(
      backgroundColor: BoaColors.deepGreen,
      textColor: Colors.white,
      label: Text(
        label,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
      child: icon,
    );

    if (semanticsLabel == null) return badge;
    return Semantics(
      label: semanticsLabel,
      child: badge,
    );
  }
}

/// Drawer trailing unread 표시.
class NotificationUnreadTrailing extends StatelessWidget {
  const NotificationUnreadTrailing({super.key, required this.unreadCount});

  final int? unreadCount;

  @override
  Widget build(BuildContext context) {
    final count = unreadCount;
    if (count == null || count <= 0) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: BoaColors.deepGreen.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: BoaColors.deepGreen.withValues(alpha: 0.25)),
      ),
      child: Text(
        formatUnreadBadgeLabel(count),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: BoaColors.deepGreen,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}
