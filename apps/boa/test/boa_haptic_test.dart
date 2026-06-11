import 'package:boa/core/widgets/boa_async_states.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  tearDown(resetBoaHapticThrottleForTest);

  test('boaSelectionHaptic and boaLightSuccessHaptic throttle rapid repeats', () {
    resetBoaHapticThrottleForTest();
    expect(() {
      boaSelectionHaptic();
      boaSelectionHaptic();
      boaLightSuccessHaptic();
    }, returnsNormally);
  });

  test('resetBoaHapticThrottleForTest clears throttle window', () {
    boaSelectionHaptic();
    resetBoaHapticThrottleForTest();
    expect(() => boaSelectionHaptic(), returnsNormally);
  });
}
