import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class BoaContractRow {
  const BoaContractRow({
    required this.id,
    this.customerId,
    this.productName,
    this.company,
    this.monthlyPremium,
    this.contractStatus,
    this.paymentStatus,
  });

  final int id;
  final int? customerId;
  final String? productName;
  final String? company;
  final int? monthlyPremium;
  final String? contractStatus;
  final String? paymentStatus;

  factory BoaContractRow.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final cid = json['customerId'];
    return BoaContractRow(
      id: id is int ? id : int.tryParse('$id') ?? 0,
      customerId: cid is int ? cid : int.tryParse('$cid'),
      productName: json['productName'] as String?,
      company: json['company'] as String?,
      monthlyPremium: (json['monthlyPremium'] as num?)?.toInt(),
      contractStatus: json['contractStatus'] as String?,
      paymentStatus: json['paymentStatus'] as String?,
    );
  }
}

/// 서버 `search` 쿼리와 동기화된 적용 검색어(디바운스 후 반영).
final contractSearchQueryProvider = StateProvider<String>((ref) => '');

const int _contractsPageSize = 50;

class ContractListState {
  const ContractListState({
    this.items = const [],
    this.hasMore = false,
    this.loadingInitial = false,
    this.loadingMore = false,
    this.errorMessage,
  });

  final List<BoaContractRow> items;
  final bool hasMore;
  final bool loadingInitial;
  final bool loadingMore;
  final String? errorMessage;

  ContractListState copyWith({
    List<BoaContractRow>? items,
    bool? hasMore,
    bool? loadingInitial,
    bool? loadingMore,
    String? errorMessage,
    bool clearError = false,
  }) {
    return ContractListState(
      items: items ?? this.items,
      hasMore: hasMore ?? this.hasMore,
      loadingInitial: loadingInitial ?? this.loadingInitial,
      loadingMore: loadingMore ?? this.loadingMore,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

final contractsListNotifierProvider =
    StateNotifierProvider.autoDispose<ContractsListNotifier, ContractListState>((ref) {
  final notifier = ContractsListNotifier(ref);
  ref.listen<String>(
    contractSearchQueryProvider,
    (_, next) {
      notifier.loadFirstPage(next);
    },
    fireImmediately: true,
  );
  return notifier;
});

class ContractsListNotifier extends StateNotifier<ContractListState> {
  ContractsListNotifier(this._ref) : super(const ContractListState());

  final Ref _ref;
  int _requestGen = 0;
  String _currentSearch = '';

  Future<void> refresh() => loadFirstPage(_ref.read(contractSearchQueryProvider));

  Future<void> loadFirstPage(String search) async {
    final gen = ++_requestGen;
    _currentSearch = search;
    if (_ref.read(sessionProvider) == null) {
      if (gen != _requestGen) return;
      state = const ContractListState();
      return;
    }
    state = const ContractListState(
      loadingInitial: true,
      loadingMore: false,
      items: <BoaContractRow>[],
      hasMore: false,
      errorMessage: null,
    );
    try {
      final bundle = await _fetchPage(search, 0);
      if (gen != _requestGen) return;
      state = ContractListState(
        items: bundle.items,
        hasMore: bundle.hasMore,
        loadingInitial: false,
      );
    } on DioException catch (e) {
      if (gen != _requestGen) return;
      final msg = e.response?.data is Map && (e.response!.data as Map)['error'] != null
          ? '${(e.response!.data as Map)['error']}'
          : e.message ?? '계약 목록을 불러오지 못했습니다.';
      state = ContractListState(
        loadingInitial: false,
        errorMessage: msg,
      );
    } catch (e) {
      if (gen != _requestGen) return;
      state = ContractListState(
        loadingInitial: false,
        errorMessage: '$e',
      );
    }
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.loadingMore || state.loadingInitial) return;
    final search = _ref.read(contractSearchQueryProvider);
    if (search != _currentSearch) return;

    final gen = _requestGen;
    final offset = state.items.length;
    state = state.copyWith(loadingMore: true);
    try {
      final bundle = await _fetchPage(search, offset);
      if (gen != _requestGen || search != _ref.read(contractSearchQueryProvider)) {
        state = state.copyWith(loadingMore: false);
        return;
      }
      state = ContractListState(
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

  Future<_ContractPageBundle> _fetchPage(String search, int offset) async {
    final dio = _ref.read(dioProvider);
    final trimmed = search.trim();
    final res = await dio.get<Map<String, dynamic>>(
      '/api/mobile/contracts',
      queryParameters: <String, dynamic>{
        'limit': _contractsPageSize,
        'offset': offset,
        if (trimmed.isNotEmpty) 'search': trimmed,
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
    final hasMore = res.data?['hasMore'] == true;
    return _ContractPageBundle(items: items, hasMore: hasMore);
  }
}

class _ContractPageBundle {
  _ContractPageBundle({required this.items, required this.hasMore});
  final List<BoaContractRow> items;
  final bool hasMore;
}
