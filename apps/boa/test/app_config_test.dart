import 'package:boa/core/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUpAll(TestWidgetsFlutterBinding.ensureInitialized);

  test('AppConfig provides non-empty API base and Google server client id', () {
    expect(AppConfig.hasApiBase, isTrue);
    expect(AppConfig.apiBaseUrl, isNotEmpty);
    expect(AppConfig.hasGoogleServerClientId, isTrue);
    expect(AppConfig.googleServerClientId, contains('.apps.googleusercontent.com'));
  });
}
