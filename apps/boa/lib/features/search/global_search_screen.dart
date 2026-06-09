import 'dart:async';

import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_quick_create_strip.dart';
import 'package:boa/features/customers/customer_detail_screen.dart';
import 'package:boa/features/customers/customers_providers.dart';
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
        appBar: AppBar(title: const Text('고객 검색')),
        body: const Center(child: Text('BOA_API_BASE_URL 을 설정하세요.')),
      );
    }

    final title = widget.pickOnly
        ? (widget.pendingAction != null
            ? '${quickCreateActionLabel(widget.pendingAction!)} — 고객 선택'
            : '고객 선택')
        : '고객 검색';

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          if (_controller.text.isNotEmpty)
            IconButton(
              tooltip: '지우기',
              icon: const Icon(Icons.clear),
              onPressed: _clearSearch,
            ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _controller,
              focusNode: _focusNode,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: '이름 또는 전화번호 검색',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: searchState.loading
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                      )
                    : (_controller.text.isNotEmpty
                        ? IconButton(icon: const Icon(Icons.clear), onPressed: _clearSearch)
                        : null),
                border: const OutlineInputBorder(),
                isDense: true,
              ),
              onChanged: (v) {
                setState(() {});
                _scheduleSearch(v);
              },
              onSubmitted: (v) {
                _debounce?.cancel();
                ref.read(globalSearchQueryProvider.notifier).state = v.trim();
              },
            ),
          ),
          if (!hasQuery) ...[
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: BoaQuickCreateStrip(),
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
      if (recent.isEmpty) {
        return ListView(
          padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + bottomInset),
          children: const [
            BoaEmptyState(
              icon: Icons.search,
              title: '고객을 검색하세요',
              message: '이름 또는 전화번호 일부로 검색할 수 있습니다.\n빠른 실행으로 바로 업무를 시작할 수도 있습니다.',
            ),
          ],
        );
      }
      return ListView(
        padding: EdgeInsets.fromLTRB(0, 0, 0, 16 + bottomInset),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text('최근 고객', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
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

    if (searchState.errorMessage != null && searchState.items.isEmpty) {
      return BoaErrorState(
        title: '검색에 실패했습니다',
        message: searchState.errorMessage!,
        onRetry: () => ref.read(globalSearchNotifierProvider.notifier).search(searchState.appliedQuery),
      );
    }

    if (searchState.loading && searchState.items.isEmpty) {
      return const BoaListLoadingSkeleton();
    }

    final rows = searchState.items;
    if (rows.isEmpty) {
      return ListView(
        padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + bottomInset),
        children: [
          BoaEmptyState(
            icon: Icons.person_search_outlined,
            title: '검색 결과가 없습니다',
            message: '이름 또는 전화번호를 다시 확인해 주세요.',
            actionLabel: '고객 등록',
            onAction: () => openCustomerRegistrationWeb(context, ref),
          ),
        ],
      );
    }

    return ListView.builder(
      padding: EdgeInsets.only(bottom: 16 + bottomInset),
      itemCount: rows.length + (searchState.hasMore ? 1 : 0),
      itemBuilder: (context, i) {
        if (i >= rows.length) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: searchState.loadingMore
                  ? const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2))
                  : const SizedBox.shrink(),
            ),
          );
        }
        final c = rows[i];
        return CustomerSearchResultTile(
          key: ValueKey('hit-${c.id}'),
          customer: c,
          showQuickActions: !widget.pickOnly && widget.pendingAction == null,
          onOpenDetail: () => _openCustomer(c),
          onQuickAction: widget.pickOnly ? null : (a) => _quickAction(c, a),
        );
      },
    );
  }
}
