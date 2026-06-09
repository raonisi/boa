import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:boa/features/customers/customers_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 전역 검색 전용 쿼리 — [customerSearchQueryProvider]와 분리.
final globalSearchQueryProvider = StateProvider<String>((ref) => '');

const int _globalSearchPageSize = 30;
const int _globalContractSearchLimit = 20;

class GlobalSearchState {
  const GlobalSearchState({
    this.items = const [],
    this.contractItems = const [],
    this.hasMore = false,
    this.loading = false,
    this.loadingMore = false,
    this.errorMessage,
    this.appliedQuery = '',
  });

  final List<BoaCustomerRow> items;
  final List<BoaContractRow> contractItems;
  final bool hasMore;
  final bool loading;
  final bool loadingMore;
  final String? errorMessage;
  final String appliedQuery;

  bool get hasAnyResults => items.isNotEmpty || contractItems.isNotEmpty;

  GlobalSearchState copyWith({
    List<BoaCustomerRow>? items,
    List<BoaContractRow>? contractItems,
    bool? hasMore,
    bool? loading,
    bool? loadingMore,
    String? errorMessage,
    String? appliedQuery,
    bool clearError = false,
  }) {
    return GlobalSearchState(
      items: items ?? this.items,
      contractItems: contractItems ?? this.contractItems,
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
      final customerFuture = _fetchCustomerPage(trimmed, 0);
      List<BoaContractRow> contracts = const [];
      try {
        contracts = (await _fetchContractPage(trimmed)).items;
      } catch (_) {
        contracts = const [];
      }
      if (gen != _requestGen) return;

      final customerBundle = await customerFuture;
      if (gen != _requestGen) return;
      state = GlobalSearchState(
        items: customerBundle.items,
        contractItems: contracts,
        hasMore: customerBundle.hasMore,
        appliedQuery: trimmed,
      );
    } on DioException catch (e) {
      if (gen != _requestGen) return;
      final msg = e.response?.data is Map && (e.response!.data as Map)['error'] != null
          ? '${(e.response!.data as Map)['error']}'
          : e.message ?? '검색 결과를 불러오지 못했습니다.';
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
      final bundle = await _fetchCustomerPage(q, state.items.length);
      if (gen != _requestGen) return;
      state = GlobalSearchState(
        items: [...state.items, ...bundle.items],
        contractItems: state.contractItems,
        hasMore: bundle.hasMore,
        appliedQuery: q,
      );
    } catch (_) {
      if (gen != _requestGen) return;
      state = state.copyWith(loadingMore: false);
    }
  }

  Future<_CustomerPageBundle> _fetchCustomerPage(String search, int offset) async {
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
    return _CustomerPageBundle(items: items, hasMore: hasMore);
  }

  Future<_ContractPageBundle> _fetchContractPage(String search) async {
    final dio = _ref.read(dioProvider);
    final res = await dio.get<Map<String, dynamic>>(
      '/api/mobile/contracts',
      queryParameters: <String, dynamic>{
        'limit': _globalContractSearchLimit,
        'offset': 0,
        if (search.isNotEmpty) 'search': search,
      },
    );
    final raw = res.data?['items'];
    final items = raw is! List
        ? const <BoaContractRow>[]
        : raw
            .map((e) => e is Map<String, dynamic> ? e : (e is Map ? Map<String, dynamic>.from(e) : null))
            .whereType<Map<String, dynamic>>()
            .map(BoaContractRow.fromJson)
            .toList();
    return _ContractPageBundle(items: items);
  }
}

class _CustomerPageBundle {
  _CustomerPageBundle({required this.items, required this.hasMore});
  final List<BoaCustomerRow> items;
  final bool hasMore;
}

class _ContractPageBundle {
  _ContractPageBundle({required this.items});
  final List<BoaContractRow> items;
}
