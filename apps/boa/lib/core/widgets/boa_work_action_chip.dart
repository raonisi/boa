import 'package:flutter/material.dart';

/// 후속·일정 quick action용 공통 칩 (loading / disable 지원).
class BoaWorkActionChip extends StatelessWidget {
  const BoaWorkActionChip({
    super.key,
    required this.label,
    required this.icon,
    required this.onPressed,
    this.loading = false,
    this.compact = true,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool loading;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const SizedBox(
        width: 88,
        height: 34,
        child: Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))),
      );
    }
    return ActionChip(
      avatar: Icon(icon, size: compact ? 16 : 18),
      label: Text(label),
      onPressed: onPressed,
      visualDensity: compact ? VisualDensity.compact : VisualDensity.standard,
    );
  }
}
