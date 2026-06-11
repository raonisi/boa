import 'dart:async';

import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_pull_refresh.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/features/contracts/contract_create_screen.dart';
import 'package:boa/features/contracts/contract_data_refresh.dart';
import 'package:boa/features/contracts/contract_summary_card.dart';
import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:boa/features/customers/customer_detail_logic.dart';
import 'package:boa/features/customers/customer_detail_screen.dart';
import 'package:boa/features/home/field_command_helpers.dart';
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

  Future<void> _refreshContracts(BuildContext context) {
    return BoaPullRefresh.runListRefresh(
      context,
      () => ref.read(contractsListNotifierProvider.notifier).refresh(),
      () => ref.read(contractsListNotifierProvider).errorMessage != null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final appliedQuery = ref.watch(contractSearchQueryProvider);
    final listState = ref.watch(contractsListNotifierProvider);

    if (!AppConfig.hasApiBase) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [BoaServerConfigHint()],
      );
    }

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('계약', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(
                  '보험사·상품명·월납보험료·계약 상태를 한곳에서 확인합니다.',
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant, height: 1.35),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              controller: _searchController,
              textInputAction: TextInputAction.search,
              decoration: boaSearchDecoration(
                context,
                hintText: '상품명·보험사·고객번호 검색',
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        tooltip: '지우기',
                        onPressed: _clearSearch,
                        icon: const Icon(Icons.clear),
                      )
                    : null,
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
            await refreshContractData(ref);
            if (!context.mounted) return;
            boaLightSuccessHaptic();
            messenger.showSnackBar(const SnackBar(content: Text('계약을 등록했습니다.')));
          }
        },
        icon: const Icon(Icons.add),
        label: const Text('계약 등록'),
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
      return RefreshIndicator(
        onRefresh: () => _refreshContracts(context),
        child: boaRefreshScrollChild(
          context: context,
          child: const Column(
            children: [
              SizedBox(height: 8),
              Center(child: Text('계약 정보를 불러오는 중입니다…')),
              SizedBox(height: 16),
              BoaListLoadingSkeleton(itemCount: 3),
            ],
          ),
        ),
      );
    }
    if (listState.errorMessage != null && listState.items.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => _refreshContracts(context),
        child: boaRefreshScrollChild(
          context: context,
          child: BoaErrorState(
            title: '계약 정보를 불러오지 못했습니다',
            message: '잠시 후 다시 시도해 주세요.',
            onRetry: () => _refreshContracts(context),
          ),
        ),
      );
    }
    final rows = listState.items;
    if (rows.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => _refreshContracts(context),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [
            SizedBox(
              height: MediaQuery.sizeOf(context).height * 0.65,
              child: BoaEmptyState(
                icon: Icons.description_outlined,
                title: appliedQuery.isNotEmpty ? '검색 결과가 없습니다' : '등록된 계약이 없습니다',
                message: appliedQuery.isNotEmpty
                    ? '상품명·보험사·고객번호로 다시 검색해 보세요.'
                    : '고객 상세 또는 계약 등록으로 정보를 추가할 수 있습니다.',
              ),
            ),
          ],
        ),
      );
    }
    final totalPremium = sumMonthlyPremium(rows);

    return RefreshIndicator(
      onRefresh: () => _refreshContracts(context),
      child: NotificationListener<ScrollNotification>(
        onNotification: _onScrollNearEnd,
        child: ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 88),
          itemCount: rows.length + (listState.hasMore ? 1 : 0) + 1,
          itemBuilder: (context, i) {
            if (i == 0) {
              return Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: BoaSurfaceCard(
                  margin: EdgeInsets.zero,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  child: Row(
                    children: [
                      Icon(Icons.description_outlined, size: 22, color: theme.colorScheme.primary),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('계약 요약', style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
                            Text(
                              '${rows.length}건 · 월납 합계 ${fieldCommaInt(totalPremium)}원',
                              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }
            final rowIndex = i - 1;
            if (rowIndex >= rows.length) {
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
            final c = rows[rowIndex];
            final customerId = c.customerId;
            return ContractSummaryCard(
              key: ValueKey('contract-${c.id}'),
              row: c,
              onTap: customerId == null
                  ? null
                  : () {
                      Navigator.of(context).push<void>(
                        MaterialPageRoute<void>(builder: (_) => CustomerDetailScreen(customerId: customerId)),
                      );
                    },
            );
          },
        ),
      ),
    );
  }
}
