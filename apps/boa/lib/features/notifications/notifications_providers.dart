import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/features/home/dashboard_provider.dart';
import 'package:boa/features/notifications/unread_count_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const int _notificationsPageSize = 50;

class NotificationListState {
  const NotificationListState({
    this.items = const [],
    this.hasMore = false,
    this.loadingInitial = false,
    this.loadingMore = false,
    this.errorMessage,
  });

  final List<Map<String, dynamic>> items;
  final bool hasMore;
  final bool loadingInitial;
  final bool loadingMore;
  final String? errorMessage;

  NotificationListState copyWith({
    List<Map<String, dynamic>>? items,
    bool? hasMore,
    bool? loadingInitial,
    bool? loadingMore,
    String? errorMessage,
    bool clearError = false,
  }) {
    return NotificationListState(
      items: items ?? this.items,
      hasMore: hasMore ?? this.hasMore,
      loadingInitial: loadingInitial ?? this.loadingInitial,
      loadingMore: loadingMore ?? this.loadingMore,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

final notificationsListNotifierProvider =
    StateNotifierProvider.autoDispose<NotificationsListNotifier, NotificationListState>((ref) {
  final notifier = NotificationsListNotifier(ref);
  ref.onDispose(() {});
  Future<void>.microtask(() => notifier.loadFirstPage());
  return notifier;
});

class NotificationsListNotifier extends StateNotifier<NotificationListState> {
  NotificationsListNotifier(this._ref) : super(const NotificationListState(loadingInitial: true));

  final Ref _ref;
  int _requestGen = 0;

  Future<void> refresh() => loadFirstPage();

  Future<void> loadFirstPage() async {
    final gen = ++_requestGen;
    if (_ref.read(sessionProvider) == null) {
      if (gen != _requestGen) return;
      state = const NotificationListState();
      return;
    }
    state = const NotificationListState(
      loadingInitial: true,
      loadingMore: false,
      items: [],
      hasMore: false,
      errorMessage: null,
    );
    try {
      final bundle = await _fetchPage(0);
      if (gen != _requestGen) return;
      state = NotificationListState(
        items: bundle.items,
        hasMore: bundle.hasMore,
        loadingInitial: false,
      );
    } on DioException catch (e) {
      if (gen != _requestGen) return;
      final body = e.response?.data;
      String msg = '알림을 불러오지 못했습니다. 다시 시도해 주세요.';
      if (body is Map && body['error'] != null) msg = '${body['error']}';
      state = NotificationListState(
        loadingInitial: false,
        errorMessage: msg,
      );
    } catch (e) {
      if (gen != _requestGen) return;
      state = const NotificationListState(
        loadingInitial: false,
        errorMessage: '알림 정보를 불러오지 못했습니다. 다시 시도해 주세요.',
      );
    }
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.loadingMore || state.loadingInitial) return;
    final gen = _requestGen;
    final offset = state.items.length;
    state = state.copyWith(loadingMore: true);
    try {
      final bundle = await _fetchPage(offset);
      if (gen != _requestGen) {
        state = state.copyWith(loadingMore: false);
        return;
      }
      state = NotificationListState(
        items: [...state.items, ...bundle.items],
        hasMore: bundle.hasMore,
        loadingInitial: false,
        loadingMore: false,
      );
    } on DioException catch (_) {
      if (gen != _requestGen) return;
      state = state.copyWith(loadingMore: false);
    } catch (_) {
      if (gen != _requestGen) return;
      state = state.copyWith(loadingMore: false);
    }
  }

  Future<_NotificationPageBundle> _fetchPage(int offset) async {
    final dio = _ref.read(dioProvider);
    final fetchLimit = _notificationsPageSize + 1;
    final res = await dio.get<Map<String, dynamic>>(
      '/api/mobile/notifications',
      queryParameters: <String, dynamic>{
        'limit': fetchLimit,
        'offset': offset,
      },
    );
    final raw = res.data?['items'];
    final list = raw is! List
        ? const <Map<String, dynamic>>[]
        : raw
            .map((e) => e is Map<String, dynamic> ? e : (e is Map ? Map<String, dynamic>.from(e) : null))
            .whereType<Map<String, dynamic>>()
            .toList();
    final hasMore = list.length > _notificationsPageSize;
    final items = hasMore ? list.sublist(0, _notificationsPageSize) : list;
    return _NotificationPageBundle(items: items, hasMore: hasMore);
  }
}

class _NotificationPageBundle {
  _NotificationPageBundle({required this.items, required this.hasMore});
  final List<Map<String, dynamic>> items;
  final bool hasMore;
}

Future<void> markMobileNotificationRead(WidgetRef ref, int notificationId) async {
  final dio = ref.read(dioProvider);
  await dio.post<void>('/api/mobile/notifications/$notificationId/read');
  ref.invalidate(notificationsListNotifierProvider);
  ref.invalidate(dashboardTodayWorkProvider);
  ref.invalidate(unreadNotificationCountProvider);
}

Future<void> markAllMobileNotificationsRead(WidgetRef ref) async {
  final dio = ref.read(dioProvider);
  await dio.post<void>('/api/mobile/notifications/read-all');
  ref.invalidate(notificationsListNotifierProvider);
  ref.invalidate(dashboardTodayWorkProvider);
  ref.invalidate(unreadNotificationCountProvider);
}
