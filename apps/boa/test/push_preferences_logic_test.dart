import 'package:boa/features/more/push_preferences_logic.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PushPreferenceFields', () {
    test('parses server JSON with defaults', () {
      final prefs = PushPreferenceFields.fromJson({
        'followUpTodayEnabled': false,
        'quietHoursStart': '22:30',
      });
      expect(prefs.followUpTodayEnabled, isFalse);
      expect(prefs.scheduleReminderEnabled, isTrue);
      expect(prefs.quietHoursStart, '22:30');
    });

    test('master work toggle reflects all work notification flags', () {
      const allOn = PushPreferenceFields();
      expect(allOn.allWorkNotificationsEnabled, isTrue);

      final allOff = allOn.withAllWorkNotifications(false);
      expect(allOff.allWorkNotificationsEnabled, isFalse);
      expect(allOff.followUpTodayEnabled, isFalse);
      expect(allOff.testNotificationEnabled, isFalse);
    });

    test('toPatchJson matches mobile API body', () {
      const prefs = PushPreferenceFields(
        followUpTodayEnabled: false,
        quietHoursEnabled: false,
        quietHoursStart: '20:00',
        quietHoursEnd: '07:00',
      );
      expect(prefs.toPatchJson(), {
        'followUpTodayEnabled': false,
        'scheduleReminderEnabled': true,
        'deleteRequestEnabled': true,
        'testNotificationEnabled': true,
        'quietHoursEnabled': false,
        'quietHoursStart': '20:00',
        'quietHoursEnd': '07:00',
        'timezone': 'Asia/Seoul',
      });
    });
  });

  test('formatTimeForApi pads hours and minutes', () {
    expect(formatTimeForApi(8, 5), '08:05');
    expect(formatTimeForApi(21, 0), '21:00');
  });
}
