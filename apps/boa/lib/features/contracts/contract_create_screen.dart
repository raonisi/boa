import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/api/mobile_work_api.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:boa/features/contracts/contract_agents_provider.dart';
import 'package:boa/features/contracts/contract_create_logic.dart';
import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:boa/features/customers/customer_contracts_provider.dart';
import 'package:boa/features/customers/customer_detail_screen.dart';
import 'package:boa/features/customers/customers_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Native 신규 계약 등록 — [customerId]가 있으면 고객 고정, 없으면 검색 후 선택.
class ContractCreateScreen extends ConsumerStatefulWidget {
  const ContractCreateScreen({
    super.key,
    this.customerId,
    this.customerName,
  });

  final int? customerId;
  final String? customerName;

  @override
  ConsumerState<ContractCreateScreen> createState() => _ContractCreateScreenState();
}

class _ContractCreateScreenState extends ConsumerState<ContractCreateScreen> {
  final _companyController = TextEditingController();
  final _productNameController = TextEditingController();
  final _productGroupController = TextEditingController();
  final _premiumController = TextEditingController();
  final _memoController = TextEditingController();
  final _customerSearchController = TextEditingController();

  int? _selectedCustomerId;
  String? _selectedCustomerName;
  int? _customerAgentId;
  int? _selectedAgentId;
  DateTime _contractDate = DateTime.now();
  String _paymentStatus = '정상';
  String _contractStatus = '청약';
  bool _saving = false;
  String? _customerSearchQuery;
  List<BoaCustomerRow> _customerHits = const [];
  bool _searchingCustomers = false;

  @override
  void initState() {
    super.initState();
    _selectedCustomerId = widget.customerId;
    _selectedCustomerName = widget.customerName;
    if (widget.customerId != null) {
      _loadCustomerAgent(widget.customerId!);
    }
  }

  @override
  void dispose() {
    _companyController.dispose();
    _productNameController.dispose();
    _productGroupController.dispose();
    _premiumController.dispose();
    _memoController.dispose();
    _customerSearchController.dispose();
    super.dispose();
  }

  Future<void> _loadCustomerAgent(int customerId) async {
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get<Map<String, dynamic>>('/api/mobile/customers/$customerId');
      final c = res.data?['customer'];
      if (c is Map<String, dynamic> && mounted) {
        setState(() {
          _selectedCustomerName = (c['name'] as String?)?.trim().isNotEmpty == true
              ? (c['name'] as String).trim()
              : _selectedCustomerName;
          _customerAgentId = coerceAgentId(c['agentId']);
        });
      }
    } catch (_) {
      // 서버 검증이 최종 기준 — 로컬 agentId 미로딩은 저장 시 서버가 처리
    }
  }

  Future<void> _searchCustomers(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      setState(() {
        _customerSearchQuery = null;
        _customerHits = const [];
      });
      return;
    }
    setState(() {
      _customerSearchQuery = trimmed;
      _searchingCustomers = true;
    });
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get<Map<String, dynamic>>(
        '/api/mobile/customers',
        queryParameters: {'search': trimmed, 'limit': 20, 'offset': 0},
      );
      final raw = res.data?['items'];
      final items = raw is! List
          ? const <BoaCustomerRow>[]
          : raw
              .map((e) => e is Map<String, dynamic> ? e : (e is Map ? Map<String, dynamic>.from(e) : null))
              .whereType<Map<String, dynamic>>()
              .map(BoaCustomerRow.fromJson)
              .toList();
      if (mounted && _customerSearchQuery == trimmed) {
        setState(() {
          _customerHits = items;
          _searchingCustomers = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _searchingCustomers = false);
    }
  }

  void _selectCustomer(BoaCustomerRow row) {
    setState(() {
      _selectedCustomerId = row.id;
      _selectedCustomerName = row.name;
      _customerAgentId = null;
      _selectedAgentId = null;
      _customerHits = const [];
      _customerSearchController.clear();
      _customerSearchQuery = null;
    });
    _loadCustomerAgent(row.id);
  }

  bool get _requiresAgent {
    final session = ref.read(sessionProvider);
    return contractCreateRequiresAgentSelection(
      role: session?.user.role,
      customerAgentId: _customerAgentId,
    );
  }

  String get _screenTitle {
    final name = _selectedCustomerName?.trim();
    if (name != null && name.isNotEmpty) return '$name님의 신규 계약 등록';
    return '신규 계약 등록';
  }

  Future<void> _pickContractDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _contractDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365 * 3)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _contractDate = picked);
  }

  String _dioErrorMessage(Object e) {
    if (e is DioException) {
      final body = e.response?.data;
      if (body is Map && body['error'] != null) return '${body['error']}';
      return e.message ?? '저장에 실패했습니다.';
    }
    return '$e';
  }

  Future<void> _submit() async {
    final validation = validateContractCreateForm(
      customerId: _selectedCustomerId,
      requiresAgent: _requiresAgent,
      selectedAgentId: _selectedAgentId,
    );
    if (validation != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(validation)));
      return;
    }
    setState(() => _saving = true);
    try {
      await mobileCreateContract(
        ref,
        customerId: _selectedCustomerId!,
        company: _companyController.text.trim().isEmpty ? null : _companyController.text.trim(),
        productName:
            _productNameController.text.trim().isEmpty ? null : _productNameController.text.trim(),
        productGroup:
            _productGroupController.text.trim().isEmpty ? null : _productGroupController.text.trim(),
        contractDate: dateOnlyApi(_contractDate),
        monthlyPremium: parseMonthlyPremiumInput(_premiumController.text),
        paymentStatus: _paymentStatus,
        contractStatus: _contractStatus,
        memo: _memoController.text.trim().isEmpty ? null : _memoController.text.trim(),
        agentIdOverride: _requiresAgent ? _selectedAgentId : null,
      );
      final customerId = _selectedCustomerId!;
      ref.invalidate(customerContractsProvider(customerId));
      ref.invalidate(customerDetailProvider(customerId));
      await ref.read(contractsListNotifierProvider.notifier).refresh();
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_dioErrorMessage(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final agentsAsync = ref.watch(assignableAgentsProvider);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    if (!AppConfig.hasApiBase) {
      return Scaffold(
        appBar: AppBar(title: const Text('신규 계약 등록')),
        body: const Center(child: Text('BOA_API_BASE_URL 을 설정하세요.')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('신규 계약 등록')),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_selectedCustomerName != null && _selectedCustomerName!.isNotEmpty)
            Material(
              color: theme.colorScheme.primaryContainer.withValues(alpha: 0.35),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Text(
                  _screenTitle,
                  style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
            ),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + bottomInset),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (widget.customerId == null) ...[
                    Text('고객 선택', style: theme.textTheme.labelLarge),
                    const SizedBox(height: 8),
                    if (_selectedCustomerId != null)
                      Card(
                        child: ListTile(
                          title: Text(_selectedCustomerName ?? '고객 #$_selectedCustomerId'),
                          trailing: IconButton(
                            tooltip: '고객 변경',
                            icon: const Icon(Icons.close),
                            onPressed: _saving
                                ? null
                                : () => setState(() {
                                      _selectedCustomerId = null;
                                      _selectedCustomerName = null;
                                      _customerAgentId = null;
                                      _selectedAgentId = null;
                                    }),
                          ),
                        ),
                      )
                    else ...[
                      TextField(
                        controller: _customerSearchController,
                        decoration: InputDecoration(
                          hintText: '이름 또는 전화번호 검색',
                          prefixIcon: const Icon(Icons.search),
                          suffixIcon: _searchingCustomers
                              ? const Padding(
                                  padding: EdgeInsets.all(12),
                                  child: SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  ),
                                )
                              : null,
                          border: const OutlineInputBorder(),
                        ),
                        textInputAction: TextInputAction.search,
                        onSubmitted: _searchCustomers,
                        onChanged: (v) {
                          if (v.trim().length >= 2) _searchCustomers(v);
                        },
                      ),
                      if (_customerHits.isNotEmpty)
                        ..._customerHits.map(
                          (c) => Card(
                            margin: const EdgeInsets.only(top: 8),
                            child: ListTile(
                              title: Text(c.name),
                              subtitle: c.phone != null ? Text(c.phone!) : null,
                              onTap: _saving ? null : () => _selectCustomer(c),
                            ),
                          ),
                        ),
                    ],
                    const SizedBox(height: 20),
                  ],
                  TextField(
                    controller: _companyController,
                    decoration: const InputDecoration(
                      labelText: '보험사',
                      border: OutlineInputBorder(),
                    ),
                    textInputAction: TextInputAction.next,
                    enabled: !_saving,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _productNameController,
                    decoration: const InputDecoration(
                      labelText: '상품명',
                      border: OutlineInputBorder(),
                    ),
                    textInputAction: TextInputAction.next,
                    enabled: !_saving,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _productGroupController,
                    decoration: const InputDecoration(
                      labelText: '상품군',
                      hintText: '예: 종신, 실손',
                      border: OutlineInputBorder(),
                    ),
                    textInputAction: TextInputAction.next,
                    enabled: !_saving,
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('계약일'),
                    subtitle: Text(dateOnlyApi(_contractDate)),
                    trailing: const Icon(Icons.calendar_today_outlined),
                    onTap: _saving ? null : _pickContractDate,
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _premiumController,
                    decoration: const InputDecoration(
                      labelText: '월납보험료 (원)',
                      border: OutlineInputBorder(),
                      suffixText: '원',
                    ),
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    onChanged: (v) {
                      final formatted = formatMonthlyPremiumInput(v);
                      if (formatted != v) {
                        _premiumController.value = TextEditingValue(
                          text: formatted,
                          selection: TextSelection.collapsed(offset: formatted.length),
                        );
                      }
                    },
                    enabled: !_saving,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    key: ValueKey(_paymentStatus),
                    initialValue: _paymentStatus,
                    decoration: const InputDecoration(
                      labelText: '납입상태',
                      border: OutlineInputBorder(),
                    ),
                    items: kContractPaymentStatuses
                        .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                        .toList(),
                    onChanged: _saving ? null : (v) => setState(() => _paymentStatus = v ?? _paymentStatus),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    key: ValueKey(_contractStatus),
                    initialValue: _contractStatus,
                    decoration: const InputDecoration(
                      labelText: '계약상태',
                      border: OutlineInputBorder(),
                    ),
                    items: kContractStatuses
                        .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                        .toList(),
                    onChanged: _saving ? null : (v) => setState(() => _contractStatus = v ?? _contractStatus),
                  ),
                  if (_requiresAgent) ...[
                    const SizedBox(height: 12),
                    agentsAsync.when(
                      data: (agents) => DropdownButtonFormField<int>(
                        key: ValueKey(_selectedAgentId),
                        initialValue: _selectedAgentId,
                        decoration: const InputDecoration(
                          labelText: '담당 설계사',
                          border: OutlineInputBorder(),
                          helperText: '고객 담당자가 없어 설계사 선택이 필요합니다.',
                        ),
                        items: agents
                            .map(
                              (a) => DropdownMenuItem(
                                value: a.id,
                                child: Text(a.name),
                              ),
                            )
                            .toList(),
                        onChanged: _saving ? null : (v) => setState(() => _selectedAgentId = v),
                      ),
                      loading: () => const LinearProgressIndicator(),
                      error: (_, __) => Text(
                        '담당 설계사 목록을 불러오지 못했습니다.',
                        style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error),
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  TextField(
                    controller: _memoController,
                    decoration: const InputDecoration(
                      labelText: '메모',
                      border: OutlineInputBorder(),
                      alignLabelWithHint: true,
                    ),
                    maxLines: 3,
                    enabled: !_saving,
                  ),
                  const SizedBox(height: 88),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: FilledButton(
            onPressed: _saving ? null : _submit,
            child: _saving
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('저장'),
          ),
        ),
      ),
    );
  }
}
