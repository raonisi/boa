import 'package:url_launcher/url_launcher.dart';

String? normalizePhoneForLaunch(String? phone) {
  if (phone == null) return null;
  final trimmed = phone.trim();
  if (trimmed.isEmpty) return null;
  final digits = trimmed.replaceAll(RegExp(r'[^\d+]'), '');
  return digits.isEmpty ? null : digits;
}

Future<bool> launchCustomerPhone(String? phone) async {
  final normalized = normalizePhoneForLaunch(phone);
  if (normalized == null) return false;
  final uri = Uri(scheme: 'tel', path: normalized);
  if (!await canLaunchUrl(uri)) return false;
  return launchUrl(uri);
}

Future<bool> launchCustomerSms(String? phone, {String? body}) async {
  final normalized = normalizePhoneForLaunch(phone);
  if (normalized == null) return false;
  final uri = Uri(
    scheme: 'sms',
    path: normalized,
    queryParameters: body != null && body.isNotEmpty ? {'body': body} : null,
  );
  if (!await canLaunchUrl(uri)) return false;
  return launchUrl(uri);
}
