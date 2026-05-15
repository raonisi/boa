import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class PushPreferencesScreen extends ConsumerStatefulWidget {
  const PushPreferencesScreen({super.key});

  @override
  ConsumerState<PushPreferencesScreen> createState() => _PushPreferencesScreenState();
}

class _PushPreferencesScreenState extends ConsumerState<PushPreferencesScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic> _prefs = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (!AppConfig.hasApiBase) {
      setState(() {
        _loading = false;
        _error = 'BOA_API_BASE_URL 미설정';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get<Map<String, dynamic>>('/api/mobile/push-preferences');
      final data = res.data;
      setState(() {
        _prefs = data != null ? Map<String, dynamic>.from(data) : {};
        _loading = false;
      });
    } on DioException catch (e) {
      final body = e.response?.data;
      String msg = '불러오지 못했습니다.';
      if (body is Map && body['error'] != null) msg = '${body['error']}';
      setState(() {
        _error = msg;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  bool _boolKey(String k, {bool defaultValue = true}) {
    final v = _prefs[k];
    if (v is bool) return v;
    return defaultValue;
  }

  String _strKey(String k, String def) {
    final v = _prefs[k];
    if (v is String && v.isNotEmpty) return v;
    return def;
  }

  Future<void> _save() async {
    final dio = ref.read(dioProvider);
    try {
      final res = await dio.patch<Map<String, dynamic>>(
        '/api/mobile/push-preferences',
        data: {
          'followUpTodayEnabled': _boolKey('followUpTodayEnabled'),
          'scheduleReminderEnabled': _boolKey('scheduleReminderEnabled'),
          'deleteRequestEnabled': _boolKey('deleteRequestEnabled'),
          'testNotificationEnabled': _boolKey('testNotificationEnabled'),
          'quietHoursEnabled': _boolKey('quietHoursEnabled'),
          'quietHoursStart': _strKey('quietHoursStart', '21:00'),
          'quietHoursEnd': _strKey('quietHoursEnd', '08:00'),
          'timezone': _strKey('timezone', 'Asia/Seoul'),
        },
      );
      if (!mounted) return;
      final data = res.data;
      setState(() {
        if (data != null) _prefs = Map<String, dynamic>.from(data);
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('저장했습니다.')));
    } on DioException catch (e) {
      final body = e.response?.data;
      String msg = '저장에 실패했습니다.';
      if (body is Map && body['error'] != null) msg = '${body['error']}';
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  void _setBool(String k, bool v) => setState(() => _prefs[k] = v);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('앱 알림 설정'),
        actions: [
          if (!_loading && _error == null)
            TextButton(onPressed: _save, child: const Text('저장')),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, textAlign: TextAlign.center)))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    SwitchListTile(
                      title: const Text('오늘 후속 알림'),
                      value: _boolKey('followUpTodayEnabled'),
                      onChanged: (v) => _setBool('followUpTodayEnabled', v),
                    ),
                    SwitchListTile(
                      title: const Text('일정 리마인더'),
                      value: _boolKey('scheduleReminderEnabled'),
                      onChanged: (v) => _setBool('scheduleReminderEnabled', v),
                    ),
                    SwitchListTile(
                      title: const Text('삭제 요청 알림'),
                      value: _boolKey('deleteRequestEnabled'),
                      onChanged: (v) => _setBool('deleteRequestEnabled', v),
                    ),
                    SwitchListTile(
                      title: const Text('테스트 알림'),
                      value: _boolKey('testNotificationEnabled'),
                      onChanged: (v) => _setBool('testNotificationEnabled', v),
                    ),
                    SwitchListTile(
                      title: const Text('조용한 시간 사용'),
                      value: _boolKey('quietHoursEnabled'),
                      onChanged: (v) => _setBool('quietHoursEnabled', v),
                    ),
                    ListTile(
                      title: const Text('조용한 시간 시작'),
                      subtitle: Text(_strKey('quietHoursStart', '21:00')),
                      trailing: const Icon(Icons.schedule),
                      onTap: () async {
                        final init = _parseTime(_strKey('quietHoursStart', '21:00'));
                        final t = await showTimePicker(context: context, initialTime: init);
                        if (t != null && mounted) {
                          setState(() => _prefs['quietHoursStart'] = '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}');
                        }
                      },
                    ),
                    ListTile(
                      title: const Text('조용한 시간 종료'),
                      subtitle: Text(_strKey('quietHoursEnd', '08:00')),
                      trailing: const Icon(Icons.schedule),
                      onTap: () async {
                        final init = _parseTime(_strKey('quietHoursEnd', '08:00'));
                        final t = await showTimePicker(context: context, initialTime: init);
                        if (t != null && mounted) {
                          setState(() => _prefs['quietHoursEnd'] = '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}');
                        }
                      },
                    ),
                    const SizedBox(height: 8),
                    Text('타임존: ${_strKey('timezone', 'Asia/Seoul')}', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  ],
                ),
    );
  }

  TimeOfDay _parseTime(String hhmm) {
    final parts = hhmm.split(':');
    if (parts.length >= 2) {
      final h = int.tryParse(parts[0]) ?? 21;
      final m = int.tryParse(parts[1]) ?? 0;
      return TimeOfDay(hour: h.clamp(0, 23), minute: m.clamp(0, 59));
    }
    return const TimeOfDay(hour: 21, minute: 0);
  }
}
