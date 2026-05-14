import 'package:flutter/material.dart';

class CustomersTab extends StatelessWidget {
  const CustomersTab({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: 5,
      itemBuilder: (context, i) => Card(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          title: Text('고객 샘플 ${i + 1}', style: theme.textTheme.titleSmall),
          subtitle: Text('상담상태 · 담당 (목록 API 연동 예정)', style: theme.textTheme.bodySmall),
          trailing: const Icon(Icons.chevron_right),
          onTap: () {},
        ),
      ),
    );
  }
}
