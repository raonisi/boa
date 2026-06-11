import 'package:boa/core/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// 가벼운 progress track — 차트 라이브러리 없이 Dashboard micro viz용.
class BoaMicroTrack extends StatelessWidget {
  const BoaMicroTrack({
    super.key,
    required this.progress,
    this.height = 4,
    this.fillColor,
    this.backgroundColor,
  });

  final double progress;
  final double height;
  final Color? fillColor;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    final clamped = progress.isNaN || progress.isInfinite ? 0.0 : progress.clamp(0.0, 1.0);
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: LinearProgressIndicator(
        value: clamped <= 0 ? null : clamped,
        minHeight: height,
        backgroundColor: backgroundColor ?? BoaColors.borderLight,
        color: fillColor ?? BoaColors.deepGreen,
      ),
    );
  }
}

/// Dashboard 한 줄 지표 — 라벨, 값, 선택적 progress.
class BoaMicroPulseRow extends StatelessWidget {
  const BoaMicroPulseRow({
    super.key,
    required this.label,
    required this.valueText,
    this.hint,
    this.progress,
    this.progressLabel,
    this.accentColor,
  });

  final String label;
  final String valueText;
  final String? hint;
  final double? progress;
  final String? progressLabel;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final fill = accentColor ?? BoaColors.deepGreen;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  label,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: cs.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  valueText,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: BoaColors.navy,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.end,
                ),
              ),
            ],
          ),
          if (hint != null && hint!.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              hint!,
              style: theme.textTheme.labelSmall?.copyWith(color: cs.onSurfaceVariant),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (progress != null) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: BoaMicroTrack(
                    progress: progress!,
                    fillColor: fill,
                  ),
                ),
                if (progressLabel != null && progressLabel!.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  Text(
                    progressLabel!,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: cs.onSurfaceVariant,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}
