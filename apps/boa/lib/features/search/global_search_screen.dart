import 'dart:async';

import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_quick_create_strip.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/features/customers/customer_detail_screen.dart';
import 'package:boa/features/customers/customers_providers.dart';
import 'package:boa/features/search/contract_search_result_tile.dart';
import 'package:boa/features/search/customer_search_result_tile.dart';
import 'package:boa/features/search/global_search_provider.dart';
import 'package:boa/features/search/quick_create_actions.dart';
import 'package:boa/features/search/recent_customers_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 앱 전역 고객 검색 화면 진입.
Future<BoaCustomerRow?> pushGlobalSearch(
  BuildContext context, {
  String? initialQuery,
  bool pickOnly = false,
  QuickCreateAction? pendingAction,
}) {
  return Navigator.of(context).push<BoaCustomerRow>(
    MaterialPageRoute<BoaCustomerRow>(
      builder: (_) => GlobalSearchScreen(
        initialQuery: initialQuery,
        pickOnly: pickOnly,
        pendingAction: pendingAction,
      ),
    ),
  );
}

void openGlobalSearch(BuildContext context, {String? initialQuery}) {
  pushGlobalSearch(context, initialQuery: initialQuery);
}

class GlobalSearchScreen extends ConsumerStatefulWidget {
  const GlobalSearchScreen({
    super.key,
    this.initialQuery,
    this.pickOnly = false,
    this.pendingAction,
  });

  final String? initialQuery;
  final bool pickOnly;
  final QuickCreateAction? pendingAction;

  @override
  ConsumerState<GlobalSearchScreen> createState() => _GlobalSearchScreenState();
}

class _GlobalSearchScreenState extends ConsumerState<GlobalSearchScreen> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    final initial = widget.initialQuery?.trim() ?? '';
    if (initial.isNotEmpty) {
      _controller.text = initial;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(globalSearchQueryProvider.notifier).state = initial;
      });
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _focusNode.requestFocus());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _scheduleSearch(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 450), () {
      if (!mounted) return;
      ref.read(globalSearchQueryProvider.notifier).state = value.trim();
    });
  }

  void _clearSearch() {
    _debounce?.cancel();
    _controller.clear();
    ref.read(globalSearchQueryProvider.notifier).state = '';
    setState(() {});
  }

  void _openCustomer(BoaCustomerRow customer) {
    recordRecentCustomer(ref, customer);
    if (widget.pickOnly) {
      Navigator.of(context).pop(customer);
      return;
    }
    if (widget.pendingAction != null) {
      runPendingQuickCreate(context, ref, widget.pendingAction!, customer);
      Navigator.of(context).pop(customer);
      return;
    }
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(builder: (_) => CustomerDetailScreen(customerId: customer.id)),
    );
  }

  void _quickAction(BoaCustomerRow customer, QuickCreateAction action) {
    recordRecentCustomer(ref, customer);
    runPendingQuickCreate(context, ref, action, customer);
  }

  bool _onScrollNearEnd(ScrollNotification n) {
    if (n.metrics.pixels < n.metrics.maxScrollExtent - 200) return false;
    ref.read(globalSearchNotifierProvider.notifier).loadMore();
    return false;
  }

  String get _screenTitle {
    if (!widget.pickOnly) return '통합 검색';
    if (widget.pendingAction != null) {
      return '${quickCreateActionLabel(widget.pendingAction!)} — 고객 선택';
    }
    return '고객 선택';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final searchState = ref.watch(globalSearchNotifierProvider);
    final recent = ref.watch(recentCustomersProvider);
    final query = ref.watch(globalSearchQueryProvider);
    final hasQuery = query.trim().isNotEmpty;

    if (!AppConfig.hasApiBase) {
      return Scaffold(
        appBar: AppBar(title: const Text('통합 검색')),
        body: const BoaServerConfigHint(),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_screenTitle),
        actions: [
          if (_controller.text.isNotEmpty)
            IconButton(
              tooltip: '지우기',
              icon: const Icon(Icons.clear),
              onPressed: _clearSearch,
            ),
        ],
      ),
      resizeToAvoidBottomInset: true,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SearchHeader(
            theme: theme,
            controller: _controller,
            focusNode: _focusNode,
            loading: searchState.loading && hasQuery,
            onChanged: (v) {
              setState(() {});
              _scheduleSearch(v);
            },
            onSubmitted: (v) {
              _debounce?.cancel();
              ref.read(globalSearchQueryProvider.notifier).state = v.trim();
            },
            onClear: _clearSearch,
          ),
          if (!hasQuery && !widget.pickOnly) ...[
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: BoaQuickCreateStrip(sectionTitle: '빠른 실행'),
            ),
            const SizedBox(height: 12),
          ],
          Expanded(
            child: NotificationListener<ScrollNotification>(
              onNotification: _onScrollNearEnd,
              child: _buildBody(context, theme, searchState, recent, hasQuery, bottomInset),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    ThemeData theme,
    GlobalSearchState searchState,
    List<RecentCustomerEntry> recent,
    bool hasQuery,
    double bottomInset,
  ) {
    if (!hasQuery) {
      return _buildIdleBody(context, theme, recent, bottomInset);
    }

    if (searchState.errorMessage != null && !searchState.hasAnyResults) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + bottomInset),
        children: [
          BoaErrorState(
            title: '검색 결과를 불러오지 못했습니다',
            message: '네트워크 상태를 확인한 뒤 잠시 후 다시 시도해 주세요.',
            onRetry: () => ref.read(globalSearchNotifierProvider.notifier).search(searchState.appliedQuery),
          ),
        ],
      );
    }

    if (searchState.loading && !searchState.hasAnyResults) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + bottomInset),
        children: const [
          SizedBox(height: 24),
          Center(child: CircularProgressIndicator()),
          SizedBox(height: 16),
          Center(child: Text('검색 중입니다…')),
          SizedBox(height: 24),
          BoaListLoadingSkeleton(itemCount: 3),
        ],
      );
    }

    final customers = searchState.items;
    final contracts = searchState.contractItems;
    if (!searchState.hasAnyResults) {
      return ListView(
        padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + bottomInset),
        children: [
          BoaEmptyState(
            icon: Icons.person_search_outlined,
            title: '검색 결과가 없습니다',
            message: '고객명이나 연락처 일부를 다시 확인해 주세요.\n'
                '신규 고객 등록 전에는 기존 고객과 중복되지 않는지 확인해 주세요.',
            actionLabel: widget.pickOnly ? null : '고객 등록',
            onAction: widget.pickOnly ? null : () => openCustomerRegistrationWeb(context, ref),
          ),
        ],
      );
    }

    return ListView(
      padding: EdgeInsets.only(bottom: 16 + bottomInset),
      children: [
        if (customers.isNotEmpty) ...[
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 4, 16, 6),
            child: BoaSectionHeader(title: '고객 결과'),
          ),
          ...customers.map(
            (c) => CustomerSearchResultTile(
              key: ValueKey('hit-${c.id}'),
              customer: c,
              showQuickActions: !widget.pickOnly && widget.pendingAction == null,
              onOpenDetail: () => _openCustomer(c),
              onQuickAction: widget.pickOnly ? null : (a) => _quickAction(c, a),
            ),
          ),
          if (searchState.hasMore)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: searchState.loadingMore
                    ? const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2))
                    : const SizedBox.shrink(),
              ),
            ),
        ],
        if (contracts.isNotEmpty) ...[
          Padding(
            padding: EdgeInsets.fromLTRB(16, customers.isNotEmpty ? 12 : 4, 16, 6),
            child: const BoaSectionHeader(title: '계약 결과'),
          ),
          ...contracts.map(
            (c) => ContractSearchResultTile(key: ValueKey('contract-hit-${c.id}'), contract: c),
          ),
        ],
      ],
    );
  }

  Widget _buildIdleBody(
    BuildContext context,
    ThemeData theme,
    List<RecentCustomerEntry> recent,
    double bottomInset,
  ) {
    if (recent.isEmpty) {
      return ListView(
        padding: EdgeInsets.fromLTRB(16, 4, 16, 16 + bottomInset),
        children: const [
          BoaEmptyState(
            icon: Icons.search,
            title: '검색어를 입력해 주세요',
            message: '고객명을 입력하면 관련 고객과 계약을 함께 확인할 수 있습니다.',
          ),
        ],
      );
    }

    return ListView(
      padding: EdgeInsets.only(bottom: 16 + bottomInset),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Text(
            '최근 고객',
            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
          ),
        ),
        ...recent.map(
          (e) => CustomerSearchResultTile(
            key: ValueKey('recent-${e.id}'),
            customer: e.toRow(),
            showQuickActions: !widget.pickOnly,
            onOpenDetail: () => _openCustomer(e.toRow()),
            onQuickAction: widget.pickOnly ? null : (a) => _quickAction(e.toRow(), a),
          ),
        ),
      ],
    );
  }
}

class _SearchHeader extends StatelessWidget {
  const _SearchHeader({
    required this.theme,
    required this.controller,
    required this.focusNode,
    required this.loading,
    required this.onChanged,
    required this.onSubmitted,
    required this.onClear,
  });

  final ThemeData theme;
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool loading;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final cs = theme.colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            '고객명, 연락처 일부, 계약 정보를 검색하세요',
            style: theme.textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant, height: 1.35),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: controller,
            focusNode: focusNode,
            textInputAction: TextInputAction.search,
            decoration: boaSearchDecoration(
              context,
              hintText: '검색어를 입력해 주세요',
              suffixIcon: loading
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                    )
                  : (controller.text.isNotEmpty
                      ? IconButton(icon: const Icon(Icons.clear), tooltip: '지우기', onPressed: onClear)
                      : null),
            ),
            onChanged: onChanged,
            onSubmitted: onSubmitted,
          ),
        ],
      ),
    );
  }
}
