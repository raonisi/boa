import 'dart:async';

import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/features/contracts/contract_create_screen.dart';
import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:boa/features/customers/customer_detail_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ContractsTab extends ConsumerStatefulWidget {
  const ContractsTab({super.key});

  @override
  ConsumerState<ContractsTab> createState() => _ContractsTabState();
}

class _ContractsTabState extends ConsumerState<ContractsTab> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    final q = ref.read(contractSearchQueryProvider);
    if (q.isNotEmpty) {
      _searchController.text = q;
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _scheduleSearchApply(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 450), () {
      final next = value.trim();
      if (!mounted) return;
      final current = ref.read(contractSearchQueryProvider);
      if (next != current) {
        ref.read(contractSearchQueryProvider.notifier).state = next;
      }
    });
  }

  void _clearSearch() {
    _debounce?.cancel();
    _searchController.clear();
    ref.read(contractSearchQueryProvider.notifier).state = '';
    setState(() {});
  }

  bool _onScrollNearEnd(ScrollNotification n) {
    if (n.metrics.pixels < n.metrics.maxScrollExtent - 240) return false;
    ref.read(contractsListNotifierProvider.notifier).loadMore();
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final appliedQuery = ref.watch(contractSearchQueryProvider);
    final listState = ref.watch(contractsListNotifierProvider);

    if (!AppConfig.hasApiBase) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text('API 미설정', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(
            'BOA_API_BASE_URL 을 지정하세요.',
            style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
        ],
      );
    }

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              controller: _searchController,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: '상품명·보험사·고객번호 검색',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        tooltip: '지우기',
                        onPressed: _clearSearch,
                        icon: const Icon(Icons.clear),
                      )
                    : null,
                border: const OutlineInputBorder(),
                isDense: true,
              ),
              onChanged: (v) {
                setState(() {});
                _scheduleSearchApply(v);
              },
              onSubmitted: (v) {
                _debounce?.cancel();
                ref.read(contractSearchQueryProvider.notifier).state = v.trim();
              },
            ),
          ),
          Expanded(
            child: _buildListBody(context, theme, appliedQuery, listState),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final navigator = Navigator.of(context);
          final messenger = ScaffoldMessenger.of(context);
          final ok = await navigator.push<bool>(
            MaterialPageRoute<bool>(
              builder: (_) => const ContractCreateScreen(),
            ),
          );
          if (!context.mounted) return;
          if (ok == true) {
            await ref.read(contractsListNotifierProvider.notifier).refresh();
            if (!context.mounted) return;
            boaLightSuccessHaptic();
            messenger.showSnackBar(
              const SnackBar(content: Text('계약을 등록했습니다.')),
            );
          }
        },
        icon: const Icon(Icons.add),
        label: const Text('신규 계약'),
      ),
    );
  }

  Widget _buildListBody(
    BuildContext context,
    ThemeData theme,
    String appliedQuery,
    ContractListState listState,
  ) {
    if (listState.loadingInitial && listState.items.isEmpty) {
      return const BoaListLoadingSkeleton();
    }
    if (listState.errorMessage != null && listState.items.isEmpty) {
      return BoaErrorState(
        title: '계약 목록을 불러오지 못했습니다',
        message: listState.errorMessage!,
        onRetry: () => ref.read(contractsListNotifierProvider.notifier).refresh(),
      );
    }
    final rows = listState.items;
    if (rows.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => ref.read(contractsListNotifierProvider.notifier).refresh(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [
            SizedBox(
              height: MediaQuery.sizeOf(context).height * 0.65,
              child: BoaEmptyState(
                icon: Icons.description_outlined,
                title: appliedQuery.isNotEmpty ? '검색 결과가 없습니다.' : '계약 정보가 없습니다.',
                message: appliedQuery.isNotEmpty
                    ? '상품명·보험사·고객번호로 다시 검색해 보세요.'
                    : '고객 상세 또는 신규 계약 버튼으로 등록할 수 있습니다.',
              ),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: () => ref.read(contractsListNotifierProvider.notifier).refresh(),
      child: NotificationListener<ScrollNotification>(
        onNotification: _onScrollNearEnd,
        child: ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: rows.length + (listState.hasMore ? 1 : 0),
          itemBuilder: (context, i) {
            if (i >= rows.length) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: listState.loadingMore
                      ? const SizedBox(
                          width: 28,
                          height: 28,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const SizedBox.shrink(),
                ),
              );
            }
            final c = rows[i];
            final title = c.productName?.trim().isNotEmpty == true
                ? c.productName!.trim()
                : (c.company?.trim().isNotEmpty == true ? c.company!.trim() : '계약 #${c.id}');
            final sub = [
              if (c.customerId != null) '고객 #${c.customerId}',
              if (c.contractStatus != null) c.contractStatus,
              if (c.paymentStatus != null) c.paymentStatus,
              if (c.monthlyPremium != null) '월 ${c.monthlyPremium}원',
            ].join(' · ');
            final customerId = c.customerId;
            return Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: ListTile(
                title: Text(title, style: theme.textTheme.titleSmall),
                subtitle: Text(sub, style: theme.textTheme.bodySmall),
                trailing: customerId != null ? const Icon(Icons.chevron_right) : null,
                onTap: customerId == null
                    ? null
                    : () {
                        Navigator.of(context).push<void>(
                          MaterialPageRoute<void>(builder: (_) => CustomerDetailScreen(customerId: customerId)),
                        );
                      },
              ),
            );
          },
        ),
      ),
    );
  }
}
