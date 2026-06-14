import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:boa/features/more/push_preferences_logic.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class PushPreferencesState {
  const PushPreferencesState({
    this.prefs,
    this.loading = false,
    this.saving = false,
    this.errorMessage,
  });

  final PushPreferenceFields? prefs;
  final bool loading;
  final bool saving;
  final String? errorMessage;

  PushPreferencesState copyWith({
    PushPreferenceFields? prefs,
    bool? loading,
    bool? saving,
    String? errorMessage,
    bool clearError = false,
  }) {
    return PushPreferencesState(
      prefs: prefs ?? this.prefs,
      loading: loading ?? this.loading,
      saving: saving ?? this.saving,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

final pushPreferencesNotifierProvider =
    StateNotifierProvider.autoDispose<PushPreferencesNotifier, PushPreferencesState>((ref) {
  return PushPreferencesNotifier(ref);
});

class PushPreferencesNotifier extends StateNotifier<PushPreferencesState> {
  PushPreferencesNotifier(this._ref) : super(const PushPreferencesState(loading: true)) {
    _ref.listen(sessionProvider, (_, __) => load());
    load();
  }

  final Ref _ref;

  Future<void> load() async {
    if (!AppConfig.hasApiBase || _ref.read(sessionProvider) == null) {
      state = const PushPreferencesState(
        loading: false,
        errorMessage: '서버 연결 또는 로그인이 필요합니다.',
      );
      return;
    }
    state = state.copyWith(loading: true, clearError: true);
    try {
      final dio = _ref.read(dioProvider);
      final res = await dio.get<Map<String, dynamic>>('/api/mobile/push-preferences');
      final data = res.data;
      state = PushPreferencesState(
        prefs: data != null ? PushPreferenceFields.fromJson(data) : const PushPreferenceFields(),
        loading: false,
      );
    } on DioException catch (e) {
      state = PushPreferencesState(
        loading: false,
        errorMessage: _dioMessage(e, '불러오지 못했습니다.'),
      );
    } catch (e) {
      state = PushPreferencesState(loading: false, errorMessage: '알림 설정을 불러오지 못했습니다. 다시 시도해 주세요.');
    }
  }

  void updateLocal(PushPreferenceFields prefs) {
    state = state.copyWith(prefs: prefs);
  }

  Future<bool> save(PushPreferenceFields prefs) async {
    if (state.saving) return false;
    state = state.copyWith(saving: true, clearError: true);
    try {
      final dio = _ref.read(dioProvider);
      final res = await dio.patch<Map<String, dynamic>>(
        '/api/mobile/push-preferences',
        data: prefs.toPatchJson(),
      );
      final data = res.data;
      state = PushPreferencesState(
        prefs: data != null ? PushPreferenceFields.fromJson(data) : prefs,
        saving: false,
      );
      return true;
    } on DioException catch (e) {
      state = state.copyWith(
        saving: false,
        errorMessage: _dioMessage(e, '저장에 실패했습니다.'),
      );
      return false;
    } catch (e) {
      state = state.copyWith(saving: false, errorMessage: '알림 설정을 저장하지 못했습니다. 다시 시도해 주세요.');
      return false;
    }
  }

  String _dioMessage(DioException e, String fallback) {
    final body = e.response?.data;
    if (body is Map && body['error'] != null) return '${body['error']}';
    return e.message ?? fallback;
  }
}
