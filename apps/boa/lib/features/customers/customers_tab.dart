import 'dart:async';

import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:boa/core/widgets/boa_pull_refresh.dart';
import 'package:boa/core/widgets/boa_ui.dart';
import 'package:boa/core/theme/app_theme.dart';
import 'package:boa/features/customers/customer_detail_logic.dart';
import 'package:boa/core/widgets/boa_customer_hero.dart';
import 'package:boa/features/customers/customer_detail_screen.dart';
import 'package:boa/features/customers/customers_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CustomersTab extends ConsumerStatefulWidget {
  const CustomersTab({super.key});

  @override
  ConsumerState<CustomersTab> createState() => _CustomersTabState();
}

class _CustomersTabState extends ConsumerState<CustomersTab> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    final q = ref.read(customerSearchQueryProvider);
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
      final current = ref.read(customerSearchQueryProvider);
      if (next != current) {
        ref.read(customerSearchQueryProvider.notifier).state = next;
      }
    });
  }

  void _clearSearch() {
    _debounce?.cancel();
    _searchController.clear();
    ref.read(customerSearchQueryProvider.notifier).state = '';
    setState(() {});
  }

  bool _onScrollNearEnd(ScrollNotification n) {
    if (n.metrics.pixels < n.metrics.maxScrollExtent - 240) return false;
    ref.read(customersListNotifierProvider.notifier).loadMore();
    return false;
  }

  Future<void> _refreshCustomers(BuildContext context) {
    return BoaPullRefresh.runListRefresh(
      context,
      () => ref.read(customersListNotifierProvider.notifier).refresh(),
      () => ref.read(customersListNotifierProvider).errorMessage != null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final appliedQuery = ref.watch(customerSearchQueryProvider);
    final listState = ref.watch(customersListNotifierProvider);

    if (!AppConfig.hasApiBase) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [BoaServerConfigHint()],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '고객 목록',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: BoaColors.navy,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '담당 고객의 상태와 다음 액션을 빠르게 확인합니다.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
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
              hintText: '고객명, 연락처를 검색하세요',
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
              final next = v.trim();
              ref.read(customerSearchQueryProvider.notifier).state = next;
            },
          ),
        ),
        Expanded(
          child: _buildListBody(context, theme, appliedQuery, listState),
        ),
      ],
    );
  }

  Widget _buildListBody(
    BuildContext context,
    ThemeData theme,
    String appliedQuery,
    CustomerListState listState,
  ) {
    if (listState.loadingInitial && listState.items.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => _refreshCustomers(context),
        child: boaRefreshScrollChild(
          context: context,
          child: const BoaListLoadingSkeleton(),
        ),
      );
    }
    if (listState.errorMessage != null && listState.items.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => _refreshCustomers(context),
        child: boaRefreshScrollChild(
          context: context,
          child: BoaErrorState(
            title: '고객 목록을 불러오지 못했습니다',
            message: listState.errorMessage!,
            onRetry: () => _refreshCustomers(context),
          ),
        ),
      );
    }
    final rows = listState.items;
    if (rows.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => _refreshCustomers(context),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [
            SizedBox(
              height: MediaQuery.sizeOf(context).height * 0.65,
              child: BoaEmptyState(
                icon: Icons.people_outline,
                title: appliedQuery.isNotEmpty
                    ? '현재 필터에 맞는 고객이 없습니다.'
                    : '표시할 고객이 없습니다.',
                message: appliedQuery.isNotEmpty
                    ? '검색어를 바꾸거나 초기화해 다시 확인해 보세요.'
                    : '권한 범위 안에서 확인할 수 있는 고객이 없습니다.',
              ),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: () => _refreshCustomers(context),
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
            final nextAction = (c.nextAction != null && c.nextAction!.isNotEmpty)
                ? c.nextAction!
                : '확인 필요';
            return BoaSurfaceCard(
              onTap: () {
                boaSelectionHaptic();
                pushCustomerDetailScreen(
                  context,
                  customerId: c.id,
                  heroLane: BoaCustomerHeroLane.customersList,
                  displayName: c.name,
                );
              },
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  BoaCustomerAvatarHero(
                    customerId: c.id,
                    lane: BoaCustomerHeroLane.customersList,
                    radius: 22,
                    displayName: c.name,
                    textStyle: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: BoaColors.navy,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        BoaCustomerNameHero(
                          customerId: c.id,
                          lane: BoaCustomerHeroLane.customersList,
                          name: c.name,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '다음: $nextAction',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: BoaColors.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: [
                            if (c.consultStatus != null)
                              _StatusChip(
                                label: c.consultStatus!,
                                color: theme.colorScheme.primary,
                              ),
                            if (c.priority != null && c.priority!.isNotEmpty)
                              _StatusChip(
                                label: priorityLabel(c.priority),
                                color: BoaColors.gold,
                              ),
                          ],
                        ),
                        if (c.phone != null && c.phone!.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            c.phone!,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: color,
            ),
      ),
    );
  }
}
