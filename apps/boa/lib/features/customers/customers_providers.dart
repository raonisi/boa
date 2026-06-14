import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class BoaCustomerRow {
  const BoaCustomerRow({
    required this.id,
    required this.name,
    this.phone,
    this.consultStatus,
    this.priority,
    this.nextAction,
  });

  final int id;
  final String name;
  final String? phone;
  final String? consultStatus;
  final String? priority;
  final String? nextAction;

  factory BoaCustomerRow.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    return BoaCustomerRow(
      id: id is int ? id : int.tryParse('$id') ?? 0,
      name: (json['name'] as String?)?.trim().isNotEmpty == true ? (json['name'] as String).trim() : '(이름 없음)',
      phone: json['phone'] as String?,
      consultStatus: json['consultStatus'] as String?,
      priority: json['priority'] as String?,
      nextAction: json['nextAction'] as String?,
    );
  }
}

/// 서버 `search` 쿼리와 동기화된 적용 검색어(디바운스 후 반영).
final customerSearchQueryProvider = StateProvider<String>((ref) => '');

const int _customersPageSize = 50;

class CustomerListState {
  const CustomerListState({
    this.items = const [],
    this.hasMore = false,
    this.loadingInitial = false,
    this.loadingMore = false,
    this.errorMessage,
  });

  final List<BoaCustomerRow> items;
  final bool hasMore;
  final bool loadingInitial;
  final bool loadingMore;
  final String? errorMessage;

  CustomerListState copyWith({
    List<BoaCustomerRow>? items,
    bool? hasMore,
    bool? loadingInitial,
    bool? loadingMore,
    String? errorMessage,
    bool clearError = false,
  }) {
    return CustomerListState(
      items: items ?? this.items,
      hasMore: hasMore ?? this.hasMore,
      loadingInitial: loadingInitial ?? this.loadingInitial,
      loadingMore: loadingMore ?? this.loadingMore,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

final customersListNotifierProvider =
    StateNotifierProvider.autoDispose<CustomersListNotifier, CustomerListState>((ref) {
  final notifier = CustomersListNotifier(ref);
  ref.listen<String>(
    customerSearchQueryProvider,
    (_, next) {
      notifier.loadFirstPage(next);
    },
    fireImmediately: true,
  );
  return notifier;
});

class CustomersListNotifier extends StateNotifier<CustomerListState> {
  CustomersListNotifier(this._ref) : super(const CustomerListState());

  final Ref _ref;
  int _requestGen = 0;
  String _currentSearch = '';

  Future<void> refresh() => loadFirstPage(_ref.read(customerSearchQueryProvider));

  Future<void> loadFirstPage(String search) async {
    final gen = ++_requestGen;
    _currentSearch = search;
    if (_ref.read(sessionProvider) == null) {
      if (gen != _requestGen) return;
      state = const CustomerListState();
      return;
    }
    state = const CustomerListState(
      loadingInitial: true,
      loadingMore: false,
      items: <BoaCustomerRow>[],
      hasMore: false,
      errorMessage: null,
    );
    try {
      final bundle = await _fetchPage(search, 0);
      if (gen != _requestGen) return;
      state = CustomerListState(
        items: bundle.items,
        hasMore: bundle.hasMore,
        loadingInitial: false,
      );
    } on DioException catch (e) {
      if (gen != _requestGen) return;
      final msg = e.response?.data is Map && (e.response!.data as Map)['error'] != null
          ? '${(e.response!.data as Map)['error']}'
          : e.message ?? '고객 목록을 불러오지 못했습니다.';
      state = CustomerListState(
        loadingInitial: false,
        errorMessage: msg,
      );
    } catch (e) {
      if (gen != _requestGen) return;
      state = CustomerListState(
        loadingInitial: false,
        errorMessage: '고객 정보를 불러오지 못했습니다. 다시 시도해 주세요.',
      );
    }
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.loadingMore || state.loadingInitial) return;
    final search = _ref.read(customerSearchQueryProvider);
    if (search != _currentSearch) return;

    final gen = _requestGen;
    final offset = state.items.length;
    state = state.copyWith(loadingMore: true);
    try {
      final bundle = await _fetchPage(search, offset);
      if (gen != _requestGen || search != _ref.read(customerSearchQueryProvider)) {
        state = state.copyWith(loadingMore: false);
        return;
      }
      state = CustomerListState(
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

  Future<_CustomerPageBundle> _fetchPage(String search, int offset) async {
    final dio = _ref.read(dioProvider);
    final trimmed = search.trim();
    final res = await dio.get<Map<String, dynamic>>(
      '/api/mobile/customers',
      queryParameters: <String, dynamic>{
        'limit': _customersPageSize,
        'offset': offset,
        if (trimmed.isNotEmpty) 'search': trimmed,
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
}

class _CustomerPageBundle {
  _CustomerPageBundle({required this.items, required this.hasMore});
  final List<BoaCustomerRow> items;
  final bool hasMore;
}
