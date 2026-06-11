import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/features/notifications/notification_display_logic.dart';
import 'package:boa/features/notifications/notification_navigation.dart';
import 'package:boa/features/notifications/notification_priority.dart';
import 'package:boa/features/notifications/notifications_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 알림함·홈 요약에서 공유하는 알림 카드.
class NotificationActionTile extends ConsumerStatefulWidget {
  const NotificationActionTile({
    super.key,
    required this.raw,
    required this.priority,
    this.compact = false,
    this.showQuickActions = true,
    this.onAfterRead,
  });

  final Map<String, dynamic> raw;
  final NotificationPriority priority;
  final bool compact;
  final bool showQuickActions;
  final VoidCallback? onAfterRead;

  @override
  ConsumerState<NotificationActionTile> createState() => _NotificationActionTileState();
}

class _NotificationActionTileState extends ConsumerState<NotificationActionTile> {
  bool _markingRead = false;

  Future<void> _markRead({bool navigateAfter = false}) async {
    final id = notificationId(widget.raw);
    if (id == 0 || _markingRead) return;
    setState(() => _markingRead = true);
    try {
      await markMobileNotificationRead(ref, id);
      boaLightSuccessHaptic();
      widget.onAfterRead?.call();
      if (!mounted) return;
      if (navigateAfter) {
        await navigateFromNotification(context, ref, widget.raw);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _markingRead = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final raw = widget.raw;
    final isRead = notificationIsRead(raw);
    final processStatus = notificationProcessStatus(raw);
    final category = notificationCategory(raw);
    final nav = resolveNotificationNavTarget(raw);
    final title = '${raw['title'] ?? '알림'}';
    final body = notificationBodyText(raw);
    final createdAt = formatNotificationDateTime(raw['createdAt']);
    final priorityAccent = switch (widget.priority) {
      NotificationPriority.urgent => BoaColors.urgent,
      NotificationPriority.today => BoaColors.todayAccent,
      NotificationPriority.general => BoaColors.deepGreen,
    };
    final statusAccent = processStatusAccentColor(processStatus);
    final leftAccent = isRead ? statusAccent.withValues(alpha: 0.55) : priorityAccent;
    final (statusBg, statusFg) = processStatusChipColors(processStatus);
    final categoryColor = notificationCategoryColor(category, cs);

    return BoaSurfaceCard(
      margin: EdgeInsets.only(bottom: widget.compact ? 8 : 10),
      color: BoaColors.card,
      padding: EdgeInsets.fromLTRB(10, widget.compact ? 10 : 12, 10, widget.compact ? 10 : 12),
      onTap: _markingRead
          ? null
          : () async {
              boaSelectionHaptic();
              if (!isRead) {
                await _markRead(navigateAfter: nav.canNavigate);
              } else if (nav.canNavigate) {
                await navigateFromNotification(context, ref, raw);
              }
            },
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
              Container(
                width: 4,
                height: widget.compact ? 40 : 52,
                margin: const EdgeInsets.only(top: 2, right: 10),
                decoration: BoxDecoration(
                  color: leftAccent,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          notificationCategoryIcon(category),
                          size: 18,
                          color: categoryColor,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: isRead ? FontWeight.w500 : FontWeight.w700,
                            ),
                          ),
                        ),
                        if (!isRead)
                          Padding(
                            padding: const EdgeInsets.only(left: 6),
                            child: Icon(Icons.fiber_manual_record, size: 10, color: cs.primary),
                          ),
                      ],
                    ),
                    if (!widget.compact && body.isNotEmpty && body != title)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          body,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                        ),
                      ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        _MetaChip(
                          label: notificationCategoryLabel(category),
                          fg: categoryColor,
                          bg: categoryColor.withValues(alpha: 0.1),
                        ),
                        _MetaChip(
                          label: notificationTypeLabel(raw),
                          fg: cs.onSurfaceVariant,
                          bg: BoaColors.ivory,
                        ),
                        _MetaChip(label: processStatus, fg: statusFg, bg: statusBg),
                        _PriorityBadge(priority: widget.priority),
                        if (createdAt.isNotEmpty)
                          Text(
                            createdAt,
                            style: theme.textTheme.labelSmall?.copyWith(color: cs.onSurfaceVariant),
                          ),
                      ],
                    ),
                    if (widget.showQuickActions && (!widget.compact || nav.canNavigate)) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          if (nav.canNavigate)
                            TextButton.icon(
                              onPressed: _markingRead
                                  ? null
                                  : () async {
                                      boaSelectionHaptic();
                                      if (!isRead) {
                                        await _markRead(navigateAfter: true);
                                      } else {
                                        await navigateFromNotification(context, ref, raw);
                                      }
                                    },
                              icon: const Icon(Icons.open_in_new, size: 16),
                              label: Text(nav.actionLabel ?? '업무 보기'),
                            ),
                          if (!isRead)
                            TextButton(
                              onPressed: _markingRead
                                  ? null
                                  : () {
                                      boaSelectionHaptic();
                                      _markRead();
                                    },
                              child: _markingRead
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : const Text('읽음'),
                            ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label, required this.fg, required this.bg});

  final String label;
  final Color fg;
  final Color bg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, color: fg, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _PriorityBadge extends StatelessWidget {
  const _PriorityBadge({required this.priority});

  final NotificationPriority priority;

  @override
  Widget build(BuildContext context) {
    final (label, bg, fg) = switch (priority) {
      NotificationPriority.urgent => ('긴급', BoaColors.urgentBg, BoaColors.urgent),
      NotificationPriority.today => ('오늘 처리', BoaColors.todayBg, BoaColors.todayAccent),
      NotificationPriority.general => ('일반', const Color(0xFFF3F4F6), BoaColors.deepGreen),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, color: fg, fontWeight: FontWeight.w600),
      ),
    );
  }
}
