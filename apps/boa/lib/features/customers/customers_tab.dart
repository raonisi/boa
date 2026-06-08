import 'dart:async';

import 'package:boa/core/config/app_config.dart';
import 'package:boa/core/widgets/boa_async_states.dart';
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final appliedQuery = ref.watch(customerSearchQueryProvider);
    final listState = ref.watch(customersListNotifierProvider);

    if (!AppConfig.hasApiBase) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            'API 주소가 설정되지 않았습니다.',
            style: theme.textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(
            '실행 시 --dart-define=BOA_API_BASE_URL=... 를 지정하세요. (에뮬레이터: http://10.0.2.2:포트)',
            style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: TextField(
            controller: _searchController,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: '이름 또는 전화번호 검색',
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
      return const BoaListLoadingSkeleton();
    }
    if (listState.errorMessage != null && listState.items.isEmpty) {
      return BoaErrorState(
        title: '고객 목록을 불러오지 못했습니다',
        message: listState.errorMessage!,
        onRetry: () => ref.read(customersListNotifierProvider.notifier).refresh(),
      );
    }
    final rows = listState.items;
    if (rows.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => ref.read(customersListNotifierProvider.notifier).refresh(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [
            SizedBox(
              height: MediaQuery.sizeOf(context).height * 0.65,
              child: BoaEmptyState(
                icon: Icons.people_outline,
                title: appliedQuery.isNotEmpty ? '검색 결과가 없습니다.' : '아직 등록된 고객이 없습니다.',
                message: appliedQuery.isNotEmpty
                    ? '이름 또는 전화번호를 다시 확인해 주세요.'
                    : '담당 고객이 배정되면 이곳에 표시됩니다.',
              ),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: () => ref.read(customersListNotifierProvider.notifier).refresh(),
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
            final subtitle = [
              if (c.consultStatus != null) c.consultStatus,
              if (c.phone != null && c.phone!.isNotEmpty) c.phone,
              if (c.priority != null && c.priority!.isNotEmpty) '우선순위 ${c.priority}',
            ].join(' · ');
            return Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                title: Text(c.name, style: theme.textTheme.titleSmall),
                subtitle: Text(
                  subtitle.isEmpty ? '탭하여 상세' : subtitle,
                  style: theme.textTheme.bodySmall,
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(
                      builder: (context) => CustomerDetailScreen(customerId: c.id),
                    ),
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
