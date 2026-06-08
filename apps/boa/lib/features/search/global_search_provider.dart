import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/features/customers/customers_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 전역 검색 전용 쿼리 — [customerSearchQueryProvider]와 분리.
final globalSearchQueryProvider = StateProvider<String>((ref) => '');

const int _globalSearchPageSize = 30;

class GlobalSearchState {
  const GlobalSearchState({
    this.items = const [],
    this.hasMore = false,
    this.loading = false,
    this.loadingMore = false,
    this.errorMessage,
    this.appliedQuery = '',
  });

  final List<BoaCustomerRow> items;
  final bool hasMore;
  final bool loading;
  final bool loadingMore;
  final String? errorMessage;
  final String appliedQuery;

  GlobalSearchState copyWith({
    List<BoaCustomerRow>? items,
    bool? hasMore,
    bool? loading,
    bool? loadingMore,
    String? errorMessage,
    String? appliedQuery,
    bool clearError = false,
  }) {
    return GlobalSearchState(
      items: items ?? this.items,
      hasMore: hasMore ?? this.hasMore,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      appliedQuery: appliedQuery ?? this.appliedQuery,
    );
  }
}

final globalSearchNotifierProvider =
    StateNotifierProvider.autoDispose<GlobalSearchNotifier, GlobalSearchState>((ref) {
  final notifier = GlobalSearchNotifier(ref);
  ref.listen<String>(globalSearchQueryProvider, (_, next) {
    notifier.search(next);
  });
  return notifier;
});

class GlobalSearchNotifier extends StateNotifier<GlobalSearchState> {
  GlobalSearchNotifier(this._ref) : super(const GlobalSearchState());

  final Ref _ref;
  int _requestGen = 0;

  Future<void> search(String query) async {
    final trimmed = query.trim();
    final gen = ++_requestGen;
    if (_ref.read(sessionProvider) == null) {
      state = const GlobalSearchState();
      return;
    }
    if (trimmed.isEmpty) {
      state = const GlobalSearchState(appliedQuery: '');
      return;
    }
    state = GlobalSearchState(loading: true, appliedQuery: trimmed);
    try {
      final bundle = await _fetchPage(trimmed, 0);
      if (gen != _requestGen) return;
      state = GlobalSearchState(
        items: bundle.items,
        hasMore: bundle.hasMore,
        appliedQuery: trimmed,
      );
    } on DioException catch (e) {
      if (gen != _requestGen) return;
      final msg = e.response?.data is Map && (e.response!.data as Map)['error'] != null
          ? '${(e.response!.data as Map)['error']}'
          : e.message ?? '검색에 실패했습니다.';
      state = GlobalSearchState(errorMessage: msg, appliedQuery: trimmed);
    } catch (e) {
      if (gen != _requestGen) return;
      state = GlobalSearchState(errorMessage: '$e', appliedQuery: trimmed);
    }
  }

  Future<void> loadMore() async {
    final q = state.appliedQuery;
    if (q.isEmpty || !state.hasMore || state.loadingMore || state.loading) return;
    final gen = _requestGen;
    state = state.copyWith(loadingMore: true);
    try {
      final bundle = await _fetchPage(q, state.items.length);
      if (gen != _requestGen) return;
      state = GlobalSearchState(
        items: [...state.items, ...bundle.items],
        hasMore: bundle.hasMore,
        appliedQuery: q,
      );
    } catch (_) {
      if (gen != _requestGen) return;
      state = state.copyWith(loadingMore: false);
    }
  }

  Future<_SearchPageBundle> _fetchPage(String search, int offset) async {
    final dio = _ref.read(dioProvider);
    final res = await dio.get<Map<String, dynamic>>(
      '/api/mobile/customers',
      queryParameters: <String, dynamic>{
        'limit': _globalSearchPageSize,
        'offset': offset,
        if (search.isNotEmpty) 'search': search,
      },
    );
    final raw = res.data?['items'];
    final items = raw is! List
        ? const <BoaCustomerRow>[]
        : raw
            .whereType<Object?>()
            .map((e) => e is Map<String, dynamic> ? BoaCustomerRow.fromJson(e) : null)
            .whereType<BoaCustomerRow>()
            .toList();
    final hasMore = res.data?['hasMore'] == true;
    return _SearchPageBundle(items: items, hasMore: hasMore);
  }
}

class _SearchPageBundle {
  _SearchPageBundle({required this.items, required this.hasMore});
  final List<BoaCustomerRow> items;
  final bool hasMore;
}
