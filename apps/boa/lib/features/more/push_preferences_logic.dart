/// Server `push_notification_preferences` fields used by Flutter native UI.
class PushPreferenceFields {
  const PushPreferenceFields({
    this.followUpTodayEnabled = true,
    this.scheduleReminderEnabled = true,
    this.deleteRequestEnabled = true,
    this.testNotificationEnabled = true,
    this.quietHoursEnabled = true,
    this.quietHoursStart = '21:00',
    this.quietHoursEnd = '08:00',
    this.timezone = 'Asia/Seoul',
  });

  final bool followUpTodayEnabled;
  final bool scheduleReminderEnabled;
  final bool deleteRequestEnabled;
  final bool testNotificationEnabled;
  final bool quietHoursEnabled;
  final String quietHoursStart;
  final String quietHoursEnd;
  final String timezone;

  factory PushPreferenceFields.fromJson(Map<String, dynamic> json) {
    return PushPreferenceFields(
      followUpTodayEnabled: _bool(json['followUpTodayEnabled'], true),
      scheduleReminderEnabled: _bool(json['scheduleReminderEnabled'], true),
      deleteRequestEnabled: _bool(json['deleteRequestEnabled'], true),
      testNotificationEnabled: _bool(json['testNotificationEnabled'], true),
      quietHoursEnabled: _bool(json['quietHoursEnabled'], true),
      quietHoursStart: _str(json['quietHoursStart'], '21:00'),
      quietHoursEnd: _str(json['quietHoursEnd'], '08:00'),
      timezone: _str(json['timezone'], 'Asia/Seoul'),
    );
  }

  Map<String, dynamic> toPatchJson() => {
        'followUpTodayEnabled': followUpTodayEnabled,
        'scheduleReminderEnabled': scheduleReminderEnabled,
        'deleteRequestEnabled': deleteRequestEnabled,
        'testNotificationEnabled': testNotificationEnabled,
        'quietHoursEnabled': quietHoursEnabled,
        'quietHoursStart': quietHoursStart,
        'quietHoursEnd': quietHoursEnd,
        'timezone': timezone,
      };

  PushPreferenceFields copyWith({
    bool? followUpTodayEnabled,
    bool? scheduleReminderEnabled,
    bool? deleteRequestEnabled,
    bool? testNotificationEnabled,
    bool? quietHoursEnabled,
    String? quietHoursStart,
    String? quietHoursEnd,
    String? timezone,
  }) {
    return PushPreferenceFields(
      followUpTodayEnabled: followUpTodayEnabled ?? this.followUpTodayEnabled,
      scheduleReminderEnabled: scheduleReminderEnabled ?? this.scheduleReminderEnabled,
      deleteRequestEnabled: deleteRequestEnabled ?? this.deleteRequestEnabled,
      testNotificationEnabled: testNotificationEnabled ?? this.testNotificationEnabled,
      quietHoursEnabled: quietHoursEnabled ?? this.quietHoursEnabled,
      quietHoursStart: quietHoursStart ?? this.quietHoursStart,
      quietHoursEnd: quietHoursEnd ?? this.quietHoursEnd,
      timezone: timezone ?? this.timezone,
    );
  }

  /// Master ON when every work-notification type is enabled (schema has no single global flag).
  bool get allWorkNotificationsEnabled =>
      followUpTodayEnabled &&
      scheduleReminderEnabled &&
      deleteRequestEnabled &&
      testNotificationEnabled;

  PushPreferenceFields withAllWorkNotifications(bool enabled) => copyWith(
        followUpTodayEnabled: enabled,
        scheduleReminderEnabled: enabled,
        deleteRequestEnabled: enabled,
        testNotificationEnabled: enabled,
      );
}

bool _bool(dynamic v, bool def) => v is bool ? v : def;

String _str(dynamic v, String def) {
  if (v is String && v.isNotEmpty) return v;
  return def;
}

String formatTimeForApi(int hour, int minute) =>
    '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
