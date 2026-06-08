import 'package:boa/features/customers/customers_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class RecentCustomerEntry {
  const RecentCustomerEntry({
    required this.id,
    required this.name,
    this.consultStatus,
    this.priority,
    this.nextAction,
    this.phone,
  });

  final int id;
  final String name;
  final String? consultStatus;
  final String? priority;
  final String? nextAction;
  final String? phone;

  factory RecentCustomerEntry.fromRow(BoaCustomerRow row) => RecentCustomerEntry(
        id: row.id,
        name: row.name,
        consultStatus: row.consultStatus,
        priority: row.priority,
        nextAction: row.nextAction,
        phone: row.phone,
      );

  BoaCustomerRow toRow() => BoaCustomerRow(
        id: id,
        name: name,
        phone: phone,
        consultStatus: consultStatus,
        priority: priority,
        nextAction: nextAction,
      );
}

class RecentCustomersNotifier extends StateNotifier<List<RecentCustomerEntry>> {
  RecentCustomersNotifier() : super(const []);

  static const _max = 8;

  void record(BoaCustomerRow row) {
    final next = [
      RecentCustomerEntry.fromRow(row),
      ...state.where((e) => e.id != row.id),
    ].take(_max).toList();
    state = next;
  }

  void recordEntry(RecentCustomerEntry entry) {
    final next = [
      entry,
      ...state.where((e) => e.id != entry.id),
    ].take(_max).toList();
    state = next;
  }
}

final recentCustomersProvider = StateNotifierProvider<RecentCustomersNotifier, List<RecentCustomerEntry>>(
  (ref) => RecentCustomersNotifier(),
);

void recordRecentCustomer(WidgetRef ref, BoaCustomerRow row) {
  ref.read(recentCustomersProvider.notifier).record(row);
}
